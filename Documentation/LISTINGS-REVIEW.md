# Flat Listings Review (`c606a85` backend, `830d69f` mobile vs `f806451`)

Independent read-only review, 2026-11-02. I verified each finding by reading the code. Findings marked "plausible" are not fully confirmed.

## Findings (most severe first)

### 1. High: the live web notifications page breaks as soon as the backend deploys
- `apps/web/src/lib/api/notifications.ts:3-9` is a strict `z.enum`. It has no `LISTING_UPDATE`.
- `NotificationsService.getPreferences` (`apps/backend/src/modules/notifications/notifications.service.ts:169`) returns `Object.values(NotificationType)`, so it now includes `LISTING_UPDATE`.
- Effect:
  - `parseNotificationPreferences` throws for every user.
  - In `apps/web/src/app/(resident)/notifications/page.tsx:24` the `Promise.all` then rejects, so `initialPage` AND `initialPreferences` both stay null.
  - Admins and merchants open `/notifications` and see both the list and the preferences as failed.
  - `GET /api/notifications/preferences` returns 502.
  - Any feed page that holds a `LISTING_UPDATE` row also fails `parseNotificationPage`.
- Fix:
  - Add `LISTING_UPDATE` to web `notificationTypes`, `typeDotStyles` (`NotificationCenter.tsx:35`) and the route switch (`:395`).
  - Better: drop unknown types instead of failing the whole parse.
  - Ship web with or before the backend.

### 2. Medium: a soft-deleted owner's active listing blocks the flat
- `UserService.deleteUser` (`apps/backend/src/modules/user/services/user.service.ts:176-221`) does not touch listings.
- Browse hides the listing (`listing.queries.ts:27-33`), but the row stays PENDING or APPROVED, so the partial unique index `listings_active_unit_key` still holds the flat.
  - APPROVED frees the flat only after up to 60 days, through the cron.
  - PENDING never expires. A new owner who bought the flat gets 409 `unitAlreadyListed` until an admin happens to reject it.
- `ListingsAdminService.approve` (`listings.admin.service.ts:137`) never checks `owner.deletedAt`. An admin can approve a listing that will never be visible, and the flat stays blocked for another 60 days.
- Fix:
  - In `deleteUser`, set the user's PENDING/APPROVED listings to WITHDRAWN.
  - Make approve refuse when the owner is soft-deleted, or show the deleted state in the admin DTO.
  - Restore can leave those listings WITHDRAWN.

### 3. Medium (product gap, confirm with owner): no ownership check on the flat
- `ListingsService.create` and `update` (`listings.service.ts:129-228`) accept any building, floor and flat. They never check `ResidentUnit` or `User.unitNumber`.
- Failure: any resident can create a PENDING listing for someone else's flat. The real owner then gets 409 `unitAlreadyListed` until an admin rejects it. That is griefing or squatting at 5 listings per hour.
- Fix: limit listings to flats in the caller's `resident_units`, or at least show the admin whether the owner holds that flat.

### 4. Low: Renew or Close can bring back an expired listing
- The compare-and-set in `transition` (`listings.service.ts:327-330`) checks only `status`.
- The cron runs hourly, so for up to an hour a listing past `expiresAt` is still APPROVED. Renew then gives it 60 more days, and Close marks it SOLD instead of EXPIRED.
- Fix: add `expiresAt: { gt: now }` to the `where` for renew and close.

### 5. Low: approve can approve content the admin never saw
- The `claim` in `listings.admin.service.ts:146` matches only `status: PENDING`.
- An owner edit (PENDING → PENDING with new content) that lands between the admin loading the listing and pressing approve is approved without review.
- Fix: pin `updatedAt` from the row the admin loaded.

### 6. Low: building case is not normalized on the backend
- The DTO only trims `building` (`listing.upsert.dto.ts:36`), and the unique index is case-sensitive.
- `a1-3-2` and `A1-3-2` can both be active at once. Mobile upper-cases (`lib/listings.ts:58`), so only direct API clients hit this.
- Fix: upper-case in the DTO transform.

### 7. Low: failed attempts burn the create quota
- `enforceCreateCap` (`listings.service.ts:130`) runs INCR before validation, so 409 and 400 attempts count toward the 5 per hour.
- A resident who retries a conflicting flat locks themselves out for an hour.

### 8. Low: the profile listings routes have no guard
- `apps/mobile/src/app/(tabs)/profile/_layout.tsx` has no guard for `profile/listings/*`.
- A guest who taps a `LISTING_UPDATE` notification after signing out, or a merchant on a deep link, gets the error or 401 path instead of a redirect.
- Fix: add a `canOwnListings` redirect in a `profile/listings/_layout.tsx`.

### 9. Low (plausible, UX): Orders is now a hidden tab
- `(tabs)/orders/index.tsx:128` uses `AppHeader`, which has no back button.
- From Profile → My orders, Android back follows the default tabs `backBehavior` (`firstRoute`) and lands on Home, not Profile. No tab is highlighted.
- Deep links and notification routes to `/(tabs)/orders/*` still resolve (`href: null` only hides the button). `checkout/confirmation.tsx:122` (`dismissTo`) and `payment.tsx` still work.

## Checked and OK
- **Migration:**
  - `ALTER TYPE ... ADD VALUE` inside the transaction is fine on PG 12+, because the new value is not used in the same migration.
  - The migration is purely additive and RLS is enabled on both tables.
  - `schema.prisma` matches `migration.sql`: columns, indexes, FKs and onDelete rules. The partial index is documented as unmodelled.
- **Backend authorization and status machine:**
  - Public and owner DTOs return the owner as id + name only; email and phone appear only for admins.
  - The owner check returns 404 on foreign listings.
  - Merchants get 403.
  - `mine` is registered before `:id`.
  - Every status change is a compare-and-set.
  - A P2002 on edit and approve maps to 409.
- **Notification preferences:** `getPreferences` iterates the enum, so `LISTING_UPDATE` defaults to enabled.
- **Mobile contract:**
  - `res.data.data` and `{items, nextCursor}` match the backend.
  - The codes handled by `listingErrorKey` match the backend.
  - Upload purpose is `listing`.
  - An edit keeps the stored URLs (`mime: null`), and the backend skips re-validating them.
  - A retry after a failed save does not upload again (`listing-form.tsx:138`).
- **Mobile query cache:** `listings` is NOT in `PERSISTED_QUERY_ROOTS`.
- **Mobile routes and i18n:**
  - No new route collisions: `/flats` vs `/profile/flats` and `/profile/listings` are all distinct.
  - Every `listings.*` key used in code exists in en and ar, including the dynamic `status_*`, `type_*` and plural keys, plus `home.teaser.popup_listings` and `notifications.type_LISTING_UPDATE`.
- **Guest gating:** guests get the Coming soon sheet from the tab, and a deep link redirects them to `/(tabs)` (`flats/_layout.tsx`).

**Verdict: safe to merge once #1 is fixed (web enum update deployed with or before the backend); #2 and #3 are recommended before launch.**

