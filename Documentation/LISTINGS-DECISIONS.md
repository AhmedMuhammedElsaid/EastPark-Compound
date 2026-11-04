# Flat Listings: Decisions on the 4 open points

Branch `feature/flat-listings` (5 commits on top of `main` = `origin/main` = `f806451`, linear). Read-only analysis, 2026-11-02. Nothing implemented.

| # | Decision | Size | Blocks merge? |
|---|---|---|---|
| 1 | (a) Only flats in the caller's `resident_units` can be listed | M | **Yes** |
| 2 | Add an optional `expectedUpdatedAt` to approve and reject now | S | No, but ship it in the same batch |
| 3 | Orders gets a header back button and takes over hardware back; Profile is the default origin | S | Blocks the mobile OTA, not web/backend |
| 4 | Two pushes: web fix first, then the backend. Mobile is JS-only, so OTA is enough | n/a | Process |

## 1. Ownership check: option (a), with a legacy fallback

**Why**
- Today `create`/`update` (`apps/backend/src/modules/listings/listings.service.ts:129-189`) never check ownership. Option (b) still lets a squatter block the real owner, and it needs a new "override" flow. Option (c) keeps the griefing.
- `resident_units` is the real source of truth for every resident who joined the current way:
  - accept-invitation creates one row per INVITED lead (`apps/backend/src/common/auth/services/auth.service.ts:400-424`);
  - inviting an existing account adds the row (`apps/backend/src/modules/residents/residents.service.ts:272`);
  - migration `20261007100000_resident_units` backfilled every CONVERTED lead;
  - a SUPER_ADMIN can add a flat (`POST /v1/admin/user/:id/units`).
- **Gap:**
  - accounts from before the lead flow (self-registration with free-text `unitNumber`, removed in `2944e70`);
  - a manual RESIDENT invite with no lead (`findInvitationLeads`, `auth.service.ts:441-453`, returns `[]`).

  These accounts have no rows. Use the same fallback as orders (`apps/backend/src/modules/orders/orders.service.ts:278-281`): the flat label equals the trimmed `User.unitNumber`. I could not check prod. Ahmed should run this read-only query first:
  ```sql
  SELECT u.id, u."unitNumber" FROM users u
  WHERE u.role='RESIDENT' AND u."deletedAt" IS NULL
    AND NOT EXISTS (SELECT 1 FROM resident_units r WHERE r."userId"=u.id);
  ```
  For any rows it returns, a SUPER_ADMIN adds the flat. No data migration.
- **Tenants and relatives:**
  - The lead form does not separate owners from tenants. A tenant who joined through a lead holds the flat's row, so the tenant can list it, and admin review still applies.
  - A relative without an account cannot list today anyway. They ask the owner, or the admin adds the flat to their account.
  - This is the only safe rule while `resident_units` allows one holder per flat (`@@unique([building, floor, flatNumber])`).

**Plan (backend)**
1. `listings.module.ts`: import `ResidentUnitsModule`. Add a helper `assertOwnsFlat(userId, flat)`. It passes if `findOwner(flat)?.userId === userId` (`resident-units.service.ts:55`), or if the user has no rows and `formatUnitLabel(flat) === unitNumber.trim()`. Otherwise it throws 400 `listing.error.unitNotOwned`.
2. Call the helper in `create`, before the duplicate pre-check. Call it in `update` on every edit, so a flat removed from the account cannot be re-submitted.
3. `ResidentUnitsService.removeFromUser`: in the same transaction, withdraw that user's PENDING/APPROVED listing for the removed flat. Otherwise the old owner's listing keeps blocking the buyer.
4. Add the code to `src/languages/en/listing.json` and to `LISTINGS-CONTRACT.md` (§2 and the errors table).
5. Tests in `listings.service.spec.ts` and `listings.update.spec.ts`:
   - an owned flat passes;
   - a foreign flat gets 400;
   - the legacy `unitNumber` match passes;
   - a legacy account with a different label gets 400;
   - an edit that moves to a foreign flat gets 400;
   - `resident-units.spec.ts` checks the withdraw on remove.

**Plan (mobile)**
- `listing-form.tsx:205-208`: replace the three text fields with a flat picker built from `getUnitLabels` (`src/lib/units.ts:9`), as chips like the checkout delivery-unit picker. With one flat it shows a read-only chip.
- Zero flats: "My listings" hides "List my flat" and shows "No flat on your account, contact the admin".
- An edit keeps the stored flat even if it is no longer in the list. The backend then rejects it with the new code.
- `listingErrorKey` (`src/lib/listings.ts:221`): add `listing.error.unitNotOwned`, plus en/ar copy.
- Tests in `listings.test.ts`.

**Size:** M. **Blocks merge: yes.** Once the backend is live without this check, any squatted rows would have to be cleaned up by hand.

## 2. Approve race: fix it now with an optional `expectedUpdatedAt`

**Why**
- `claim` matches only `id` and `status` (`listings.admin.service.ts:229-239`). The approve claim is at `:157`.
- The admin list card approves straight from the list query (`use-admin-listing-actions.ts:28`). That data can be minutes old, so the window is real and is not limited to a fast double edit.
- No client calls these endpoints yet: mobile listings are unreleased and the web has no admin listings UI. Adding the field costs almost nothing today, and it is additive later.
- Use `updatedAt` instead of `revisionCount`:
  - every change to the row bumps `@updatedAt` (`schema.prisma:287`);
  - every DTO already carries it (`listing.mapper.ts:54`, mobile `services/api/listings.ts:48`).

**Plan**
1. Add a new `ListingApproveDto { expectedUpdatedAt?: ISO string }` (`@IsOptional @IsISO8601`). Add the same optional field to `ListingRejectDto`. Approve has no body today, and `forbidNonWhitelisted` (`main.ts:66`) needs the field declared.
2. Pass the value into `claim`. When it is present, add `updatedAt: new Date(expected)` to the `where`. If 0 rows match, re-read the row: status still PENDING means 409 `listing.error.changedSinceLoaded`, anything else means `invalidStatus`.
3. Mobile `adminListingsApi.approve/reject` always send `listing.updatedAt`. Map the new code in `listingErrorKey` ("The owner edited this listing, review it again"). The existing `invalidateQueries` already refetches the list.
4. Update the contract §4 and the error table. Tests:
   - matching value: approve passes;
   - stale value: 409;
   - no value: works as today.

**Size:** S. **Blocks merge: no.** It is cheap, so ship it in the same batch as point 1.

## 3. Orders back: origin-aware header back on the Orders screen

**Why**
- Orders is a hidden tab (`(tabs)/_layout.tsx:107`). Its root screen still renders the tab-root `AppHeader`, which has no back button (`orders/index.tsx:128`, `components/ui/app-header.tsx:24`).
- Tabs use the default `firstRoute`, so hardware back goes to Home.
- Rejected alternatives:
  - `backBehavior="history"` changes back on every tab, and it interacts with `useOriginBack`'s pop-then-navigate.
  - Moving to `profile/orders` touches 9 route references: notification `ORDER_UPDATE` (`services/notifications/routing.ts:32`), `checkout/confirmation.tsx:122` `dismissTo`, `payment.tsx:175,224`, the Home tile and the `KNOWN_COLLISIONS` test. It is too much churn for a back button.
- The repo already solves this problem for Community sub-screens with `useOriginBack` (`lib/hooks/use-origin-back.ts:6-49`), and `?from=home|profile` already exists.

**Plan**
1. `useOriginBack(options?: { fallback?: "home" | "profile"; popFirst?: boolean })`.
   - With a fallback, it always returns a handler and always takes over hardware back.
   - `popFirst: false` skips the `router.back()` (`:31-32`). Orders index is its stack's root, and that `back()` would bounce to Home first.
   - Community callers stay unchanged.
2. `orders/index.tsx`: swap `AppHeader` for `ScreenHeader title={t("orders.title")} onBack={useOriginBack({ fallback: "profile", popFirst: false })}`. Drop the duplicate in-page title.
3. Profile row (`profile/index.tsx:352`) uses `/(tabs)/orders?from=profile`. The Home tile (`resident-home.tsx:217`) uses `?from=home`. Deep links, push notifications and the checkout confirmation have no `from`, so back goes to Profile.
4. Add `export const unstable_settings = { initialRouteName: "index" }` to `orders/_layout.tsx`. A notification deep link into `[orderId]` then goes back to the list and from there to Profile.
5. Tests: extend `use-origin-back.test.ts` (fallback, `popFirst`). `route-collisions.test.ts` stays unchanged (no new URLs).

**Size:** S. **Blocks merge: no** for web and backend. **It blocks the mobile OTA**: it fixes a regression this branch introduces, so land it before the OTA.

## 4. Release sequence

**Facts**
- Render (`render.yaml:10`, `autoDeployTrigger: commit`, no build filter) and Vercel both deploy every push to `main`. One push of the whole branch would race them, and the web CI is known to flake on Google Fonts.
- The web fix `7ee0161` touches only `apps/web/**`, so it cherry-picks cleanly onto `main`.
- **Mobile is JS-only:**
  - the diff vs `main` has no changes to `package.json`, `app.config.ts`, `eas.json` or the lockfile;
  - the only native imports are `expo-image` and `expo-image-picker`, both already in `main` (`package.json:78-79`).

  With `runtimeVersion: appVersion` (`app.config.ts:49`), OTA works if `version` is NOT bumped. The iOS `photosPermission` string (`app.config.ts:163`) still says "feedback". Change it only with the next EAS build, never in an OTA.
- **Old installed builds (code at `main`) do not break:**
  - Preferences: `normalizePreferences` maps over its own fixed list and drops unknown types (`git show main:apps/mobile/src/lib/notification-preferences.ts:13-18`).
  - Notification rows: the type colour falls back to `?? colors.textMuted`.
  - Taps: `getNotificationHref` returns `null` for `LISTING_UPDATE` (unknown type, no matching id key), so a tap or push only marks the item read (`routing.ts` at main, `_layout.tsx:136`).
  - Old builds keep the Orders tab and call no changed endpoint.
  - In practice old builds only receive `LISTING_UPDATE` if the same user also has a new build, because listings can only be created from new mobile code.

**Sequence** (each step on Ahmed's go; never print secrets)
1. On the branch: implement points 1–3, then run the gates:
   - web `check`;
   - backend typecheck, lint, test;
   - mobile type-check, jest, and `npx expo export --platform android`, then `git checkout` the generated `uniwind-types.d.ts`.
2. Run the read-only `resident_units` gap query from point 1 on prod and fix the gaps.
3. **Push A (web only):** cherry-pick `7ee0161` onto `main` and push.
   - Wait for Vercel to report Ready on that SHA.
   - Check that `/notifications` loads for an admin.
   - Render also redeploys the unchanged backend; that is harmless.
4. Back up prod (`pg_dump`, as in the 2026-10-03 runbook).
5. **Push B:** rebase the branch onto the new `main` (the cherry-picked commit drops out), fast-forward `main`, push.
   - Render runs `migrate deploy` (`20261031000000_flat_listings`, additive) on boot.
   - Verify `/health` 200, `prisma migrate status` clean, `GET /v1/notifications/preferences` lists `LISTING_UPDATE`, and `node scripts/smoke/run.mjs`.
6. **Mobile:** `eas update` on the `preview` channel (and on `production` once a store build exists). OTA on the A72 build v11 is not yet verified on the device. If the update does not apply, fall back to an EAS build, after asking first.

**Rollback**
- **Mobile:** republish the previous update (`eas update:republish`). It has no server coupling.
- **Backend:**
  - Redeploy the previous Render deploy. Leave the migration in place: its tables, enums and index are unused by the old code.
  - **Trap:** the old Prisma client fails to read any `notifications` or `notification_preferences` row with type `LISTING_UPDATE` (unknown enum value). Before rolling back, delete those rows. Take the backup first.
  - If old code ever runs `migrate deploy` against a DB that has the newer migration, it should apply nothing. Confirm in the deploy log.
- **Web:** never roll back past `7ee0161` while the backend runs listings code. The old strict parser breaks `/notifications`.
