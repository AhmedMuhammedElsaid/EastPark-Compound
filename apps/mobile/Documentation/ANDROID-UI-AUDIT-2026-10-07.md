# Android UI audit — 2026-10-07

Device: Samsung A72 (SM-A725F), Android, 1080x2400, density override 384, 3-button navigation.
Build: `com.eastpark.app.preview` 1.0.0 (versionCode 6, installed 2026-10-04). Signed in as the owner, Arabic, dark.
Reference skin: the live web app (`apps/web`): Alexandria, sticky header with brand mark, bordered cards,
76px bottom nav on the page background with a hairline top border and safe-area padding.

## P0 — broken / blocking

1. **Bottom tabs sit under the Android navigation buttons.** `(tabs)/_layout.tsx` hard-codes
   `height: 64, paddingBottom: 8`, which overrides React Navigation's bottom safe-area inset. With
   edge-to-edge + 3-button nav, the system bar and its light contrast scrim cover the tabs; only a ~20px
   strip is tappable and labels are washed out.
2. **App icon and adaptive icon are the template React atom**, not the EastPark mark
   (`assets/icon.png`, `assets/adaptive-icon.png`). Non-production builds also stamp a banner/ribbon badge.
3. **Splash is the template React atom** (`assets/splash-icon.png`).
4. **Splash holds for up to 60 s on a cold backend.** `use-auth-rehydration.ts` hides the splash only after
   `GET /user/profile` returns; on a Render cold start the user stares at the splash for ~60 s.
   Persisted auth state is already available, so the splash should hide right after reading tokens and
   the profile should refresh in the background.

## P1 — wrong content / misleading

5. ~~Governance hub titled "الإدارة"~~ — matches the web wording (owner choice); not a bug.
6. Profile security row says **"Face ID"** on Android (Samsung reports face first). The switch was ON, but its
   near-black thumb on the gold track read as OFF.
7. Elections card badge: near-white text on a near-white chip (unreadable).
8. "2 المرشحون" — Latin digit next to Arabic-Indic digits elsewhere, and wrong grammar. Digits are mixed
   across the app (prices Arabic-Indic, rating "4.0" and counts Latin).
9. Greeting uses a Latin comma: "مساء الخير, أحمد".
10. Poll detail: options are plain boxes with no vote affordance (no radio, no submit, no hint).
11. Announcement detail: title repeated in the header and body; no date/category; empty comments list
    has no empty message; composer floats with a large gap above the tab bar.
12. Orders empty state has no "Browse shops" button.

## P2 — layout / polish (match the web skin)

13. Home and Directory-preview grids are off-center (left gutter ~70px vs right ~33px).
14. Home: no app header (brand mark, cart, notifications bell); large dead gap between quick actions
    and "Latest"; page ends abruptly.
15. Shop detail: hero image runs under the status bar with no scrim; back/heart buttons collide with
    status icons; Menu/Reviews tabs sit above the shop name; WhatsApp button has a bright green border
    (design forbids bright greens); "+" add button cramped under the thumbnail.
16. Directory: no screen title; cards have excess bottom padding.
17. Community: large gap between the category chips and the first card; cards show no date.
18. Profile: selected segment (language/theme) barely distinguishable; no edit-profile, flats, phone or
    notification-settings entries; no admin entry for admins.
19. Font: mobile uses Cairo, web uses Alexandria — the two apps do not look like the same product.
20. Tab bar uses `card` background and filled icons; web uses page background, hairline border, gold
    active state.

## Journey findings (cart, checkout, feedback, light theme)

21. Shop detail checkout bar is a ~230px solid gold block (double bottom inset inside tabs).
22. Cart header shows the shop name in English in the Arabic UI; quantity controls are a vertical stack with
    ~30px targets; "Clear" is a small red text link.
23. **Address step "Next" does nothing** for an account without a unit (silent validation failure).
24. Feedback: admin-reply badge unreadable (light chip); no photo attachment on mobile (web has it);
    anonymous switch state unclear; placeholder repeats the label; unlabeled "+" header button.
25. Light theme: status-bar icons white on the light background (system bars never styled); shop hero
    back/heart buttons invisible on light photos.
26. No entry to the admin / merchant dashboards from Profile.
27. Font family name `Cairo` was embedded via the expo-font config plugin (works); switched to Alexandria.

## New for this release (owner, 2026-10-07)

Orders are placed in the backend as today AND handed to the shop on WhatsApp (prefilled message with the
order number, items, total, flat, notes). Shops without WhatsApp fall back to a call button.

## Not yet covered on device

Notifications feed and admin/merchant screens (no entry point in the installed build), English LTR.

## Status — 2026-10-07 (uncommitted, not yet on a device)

Fixed in code: 1–4, 6–27 (5 was not a bug). Highlights: inset-aware web-style tab bar + transparent nav bar,
real EastPark icon/adaptive icon/splash, splash no longer waits on the API, Alexandria font (vendored in
`assets/fonts`), shared `AppHeader` (brand, cart badge, unread dot) and `ScreenHeader` (44px back) on every
screen, bordered card skin, localized digits/dates, poll/election radio affordance + residents-only note,
WhatsApp order hand-off (`WHATSAPP_ORDER_HANDOFF`, `src/lib/whatsapp.ts`), short order number `#XXXXXX`
shown to residents and merchants (same as web `shortId`), profile dashboard entries for admin/merchant.

Gates: type-check 0, jest 15 suites / 124 + whatsapp 7, translations ar/en key parity OK, no new lint errors
(baseline `max-lines-per-function` / react-hooks errors remain).

Open: feedback photo attachment (needs `expo-image-picker`; `pnpm add` blocked by the
virtual-store-dir-max-length mismatch), new EAS preview build + device re-walk, English LTR pass.

## Code audit of never-opened screens — 2026-10-07 (evening)

The EAS build is on hold, so these come from three read-only code reviews (resident, merchant+admin, auth+English), each checked against the backend. Totals: 1 P0 (AUTH-1, verified by hand), 14 P1, 47 P2. Nothing fixed yet.

### Device spot-check on the 2026-10-04 build (server behaviour only)

- Community, polls, election list + detail, reports (empty is correct: prod has 0) and notifications (deep link `eastpark.preview://notifications`) all load prod data.
- Election card reads "2 المرشحون": Latin digit plus awkward wording (same family as RES-9).
- Election detail back button has no accessibility label.
- Stopped before My Orders: the auto-mode classifier blocked further phone driving and a read-only prod DB check as production reads.


### Resident never-opened screens audit (read-only) — 2026-10-07

Scope: election detail, reports, notifications + AppHeader bell, order detail + Socket.io tracking + cancel,
checkout payment -> WhatsApp hand-off -> confirmation. Every finding below was checked against the mobile code
and the backend controller/service/DTO it talks to.

Verified clean (no finding):
- Contracts: `GET /elections/:id`, `POST /elections/:id/vote {candidateId}`, `GET /reports` (`{items,nextCursor}`,
  `publishedAt`), `GET /notifications` (`{items,nextCursor,unreadCount}`), `PATCH /notifications/:id/read`,
  `PATCH /notifications/read-all`, `GET /orders/:id`, `PATCH /orders/:id/cancel`, `POST /orders` (deliveryUnit, notes),
  shop `whatsapp`/`phone` fields, money as numbers (`toOrderResponse` -> `toMoneyNumber`). Envelope `{ data }` from
  `ResponseInterceptor` matches `res.data.data` everywhere.
- Socket contract: namespace `/orders`, `auth.token`, `order:join`/`order:leave` with the bare id string,
  `order:status_update {orderId,status,timestamp}`; room re-join on connect; token-refresh recovery on
  `io server disconnect`.
- i18n: every `t()` key used by the audited files (plus all 7 `orders.<STATUS>` keys and the
  VOTE/CANCEL error maps) exists in both `ar.json` and `en.json`.
- No pure #000/#fff, no left/right physical styles, back arrows mirrored for RTL, 44px targets on header/back
  buttons; all audited screens use `ScreenHeader`/`AppHeader` (confirmation is a deliberate full-screen success).
- Loading (skeleton), empty and error states present on reports, notifications, orders list, order detail,
  election detail.
- WhatsApp numbers: backend validates `@IsPhoneNumber()` (international), so `toWhatsAppDigits` gets `+20...`.

---

#### P1 — wrong / misleading

### RES-1 (P1) Order detail "Paid" row reads "Paid: Unpaid"
- File: `apps/mobile/src/app/(tabs)/orders/[orderId].tsx:350-353`
- What: the row label is `t("orders.paid")` ("مدفوع" / "Paid") and the value is `t("orders.paid")` or
  `t("orders.unpaid")`. For every cash order (the only method in this release) the screen shows
  "مدفوع ........ غير مدفوع" — "Paid ... Unpaid".
- Scenario: resident opens any COD order -> the summary card literally says the order is paid and unpaid.
- Fix: add a `orders.payment_status` key (ar "حالة الدفع" / en "Payment status") and use it as the label; keep
  paid/unpaid as the value.

### RES-2 (P1) Back from the order confirmation lands on a stale checkout for an order already placed
- Files: `apps/mobile/src/app/checkout/payment.tsx:168` (only the payment screen is replaced),
  `apps/mobile/src/app/checkout/confirmation.tsx` (no `BackHandler`, no `gestureEnabled: false`),
  `apps/mobile/src/app/checkout/_layout.tsx:8`, `apps/mobile/src/app/checkout/address.tsx` (no empty-cart guard).
- What: checkout stack is `[cart, address, payment]`; `router.replace` swaps payment for confirmation, leaving
  `[cart, address, confirmation]`. The cart is already cleared.
- Scenario: resident places an order, WhatsApp opens, they come back and press Android Back (or swipe) on the
  success screen -> the address step for the order they just placed. "Next" goes to Payment showing total 0 and a
  disabled "Place order"; Back again shows the empty cart. Looks like the order failed.
- Fix: on confirmation, intercept hardware back (`BackHandler` -> `router.replace("/(tabs)")`) and set
  `gestureEnabled: false` for the confirmation route; or `router.dismissAll()` the checkout stack before
  `replace` to confirmation. Also make address/payment redirect to cart when `items.length === 0`.

---

#### P2 — polish / degraded behaviour

### RES-3 (P2) Guest "Orders" tab never shows the designed guest card; post-login return is lost
- Files: `apps/mobile/src/app/(tabs)/orders/_layout.tsx:14-16` vs `apps/mobile/src/app/(tabs)/orders/index.tsx:133,240-257`
- What: the layout returns `<Redirect href="/(auth)/login" />` for guests, so `OrdersScreen` (and its
  `GuestOrders` card that calls `setPendingRedirect("/(tabs)/orders")`) never renders.
- Scenario: guest taps the Orders tab -> thrown straight to login with no context; after signing in they are not
  returned to Orders. The guest card code is dead.
- Fix: drop the Redirect from the orders layout (the index already handles guests and disables the query), and
  keep `[orderId]` protected (e.g. redirect only when the current route is not the index).

### RES-4 (P2) Merchant's order notification opens the resident order screen
- Files: `apps/mobile/src/services/notifications/routing.ts:362`, used by `apps/mobile/src/app/notifications.tsx:121`
  and the push handler `apps/mobile/src/app/_layout.tsx:118`; backend `apps/backend/src/modules/orders/orders.service.ts:420-433`
  sends ORDER_UPDATE `{orderId}` to the MERCHANT when a resident cancels.
- What: ORDER_UPDATE always routes to `/(tabs)/orders/:id` regardless of role. `GET /orders/:id` allows the owning
  merchant, so it renders, but in the resident layout (no resident name/flat, resident tab bar) instead of
  `/(merchant)/orders/:id`.
- Fix: pass the role into `getNotificationHref` (or resolve in the two callers) and use
  `/(merchant)/orders/${id}` for MERCHANT.

### RES-5 (P2) WhatsApp re-send / "Call the shop" exists only on the confirmation screen
- Files: `apps/mobile/src/app/checkout/confirmation.tsx:103-125`, `apps/mobile/src/lib/whatsapp.ts:211-220`
  (in-memory only), `apps/mobile/src/app/(tabs)/orders/[orderId].tsx` (no WhatsApp/call action).
- What: the hand-off is a module variable; once the user leaves confirmation (e.g. "My Orders") or the app is
  killed while in WhatsApp, there is no way to re-send the order message or call the shop.
- Scenario: WhatsApp fails to open / user backs out of WhatsApp before sending, then taps "My Orders" -> the
  shop never receives the message and the order detail offers no way to send it.
- Fix: on order detail while status is PLACED, add "Send on WhatsApp" (rebuild the message from the order +
  `["shop", order.shopId]`) with the call fallback.

### RES-6 (P2) Election footer says "Closes <date>" for an election that already closed
- File: `apps/mobile/src/app/(tabs)/community/governance/elections/[id].tsx:186-191`
- What: always uses `governance.expires` ("ينتهي {{date}}" / "Closes {{date}}") even when `votingClosed`.
- Fix: when `votingClosed`, show `governance.closed` (exists in both locales) plus the date.

### RES-7 (P2) Sealed-results copy is wrong for ADMIN_CONTROLLED and missing for non-voters
- File: `apps/mobile/src/app/(tabs)/community/governance/elections/[id].tsx:164-168`; backend
  `apps/backend/src/modules/governance/services/elections.service.ts:111-118` (ADMIN_CONTROLLED stays hidden after
  the deadline until an admin publishes).
- What: the banner shows only if the user voted, and always says "Results will be revealed after the deadline".
- Scenario: ADMIN_CONTROLLED election past its deadline -> voter sees "revealed after the deadline" although the
  deadline passed; a resident who did not vote / a guest sees candidates with no counts and no explanation.
- Fix: show the banner whenever `!showVotes`; choose copy by `visibilityMode` (add an "admin will publish results"
  key for ADMIN_CONTROLLED).

### RES-8 (P2) Election with zero candidates shows an empty "Candidates" section and "Pick a candidate"
- File: `apps/mobile/src/app/(tabs)/community/governance/elections/[id].tsx:144-150,170-182`; backend creates the
  election first and adds candidates separately (`POST /elections/:id/candidates`), so a 0-candidate election is
  publicly visible in between.
- Fix: when `candidates.length === 0`, render an empty state ("Candidates will be announced soon") and suppress
  the pick hint.

### RES-9 (P2) Latin digits inside Arabic UI (notifications time, header cart count)
- Files: `apps/mobile/src/app/notifications.tsx:276-288` (`{{count}}` interpolated as a raw number; i18n init at
  `src/lib/i18n/index.tsx:12-22` has no number formatter) -> "5 د", "3 س";
  `apps/mobile/src/components/ui/app-header.tsx:66` (`cartCount` / "9+").
- What: prior audit item 8 (localized digits) not applied here; rest of these screens use `toLocaleString("ar-EG")`.
- Fix: pass `count: n.toLocaleString(locale)` (keep a numeric `count` for plurals via a separate var) and format
  the badge with `toLocaleString`.

### RES-10 (P2) "Pay now" still shown for unpaid PAYMOB orders while card payments are off
- File: `apps/mobile/src/app/(tabs)/orders/[orderId].tsx:250-252`; flag `src/lib/features.ts` `CARD_PAYMENTS_ENABLED = false`;
  backend refuses (409 `order.error.paymentsDisabled`).
- Scenario: any pre-existing/legacy PAYMOB order -> button -> always "payment init failed" toast.
- Fix: also gate on `CARD_PAYMENTS_ENABLED`.

### RES-11 (P2) Live tracking silently degrades to polling for the rest of the session after a network drop
- File: `apps/mobile/src/services/socket/client.ts:94-120`
- What: `reconnectionAttempts: 5`; after the 5th failure socket.io-client emits `reconnect_failed` on the Manager,
  but the socket keeps `active === true` (`subs` still set — verified in socket.io-client 4.8.4
  `socket.js:180` / `manager.js:378`), so the `connect_error` handler never calls `scheduleRecovery`, and nothing
  listens to `reconnect_failed`. No AppState/foreground path reconnects it either (only `session.ts` calls
  `disconnectSocket` on logout). The socket stays dead until app restart or re-login.
- Effect: order detail falls back to 15 s polling (works), but status changes are no longer instant anywhere.
- Fix: `socket.io.on("reconnect_failed", () => scheduleRecovery(created))`, or `reconnectionAttempts: Infinity`
  with the existing capped delay; also reconnect on AppState "active".

### RES-12 (P2) Socket room join can fail silently while the screen believes it is live
- Files: backend `apps/backend/src/modules/orders/orders.gateway.ts:57-83,90-98` (async `handleConnection` sets
  `client.data.user` after an awaited session-version lookup; Nest does not await `handleConnection` before
  binding message handlers — `@nestjs/websockets/web-sockets-controller.js:74-95`; socket.io 4.8.3
  `namespace.js:274-279` writes the CONNECT packet in `socket._onconnect()` before emitting `connection`, so the
  client's `connect` handler can emit `order:join` while `handleConnection` is still awaiting); mobile
  `src/services/socket/client.ts:107-110` (joins on `connect`, never listens for `exception`),
  `src/app/(tabs)/orders/[orderId].tsx:161-169` (polling off whenever `connected`).
- What: if `order:join` reaches the server before the session-version lookup resolves (memo miss -> Redis
  round-trip), the join throws `WsException('forbidden')`, the client ignores it, the socket is "connected", so
  polling is disabled and no updates arrive until the next reconnect. Timing-dependent (the in-process memo is
  usually warm right after the HTTP fetch), so low probability.
- Fix: backend — store the auth promise on `client.data` and await it in `handleJoinOrder`, or authenticate in
  `server.use()` middleware; mobile — listen for `exception` and retry the join / keep polling until the first
  update or ack (use an emit ack).

### RES-13 (P2) Payment total uses gold-500 text on the light theme (fails WCAG AA)
- File: `apps/mobile/src/app/checkout/payment.tsx:70` (`summaryValue: { color: BRAND.gold }`).
- Fix: use `"primaryText" in colors ? colors.primaryText : BRAND.gold` like the other screens.

### RES-14 (P2) Confirmation "My Orders" button opens one order, not the orders list
- File: `apps/mobile/src/app/checkout/confirmation.tsx:96-101`
- What: label `home.my_orders` but navigates to `/(tabs)/orders/:id`; if `orderId` is missing the button does nothing.
- Fix: label it "Track order" (new key) or route to `/(tabs)/orders` when `orderId` is absent.

### RES-15 (P2) Spinner in primary buttons (Place order, Pay now)
- File: `apps/mobile/src/components/auth/gold-button.tsx:3,70` (`ActivityIndicator`), used by
  `checkout/payment.tsx:245` and `orders/[orderId].tsx:251`.
- What: DESIGN.md says "skeleton shimmer, never spinners". App-wide pattern; owner call whether in-button
  progress is an accepted exception.

---

Counts: P0 0 · P1 2 · P2 13 (total 15).

### Merchant + Admin screens audit (code-only, 2026-10-07)

Scope: `apps/mobile/src/app/(merchant)/*`, `apps/mobile/src/app/(admin)/*`, `src/services/api/merchant.ts`,
`src/services/api/admin.ts`, Profile `ManagementSection`, role guards. Each finding verified against the
backend controller/DTO/service. Paths below are relative to `apps/mobile/` unless prefixed `backend/`
(= `apps/backend/src/`).

Verified OK (no finding):
- Every merchant route matches `backend/modules/merchant/merchant.controller.ts` (GET/PATCH `/merchant/shop`,
  GET/POST `/merchant/products`, PATCH/DELETE `/merchant/products/:id`, GET `/merchant/orders`,
  GET `/merchant/orders/:id`, PATCH `/merchant/orders/:id/status` with `{ status }`).
- Response envelopes `{ data: { items, nextCursor } }` and money fields: backend converts Decimal to numbers
  (`toMoneyNumber` in orders.service.ts:121/124 and products.service.ts:24), so mobile `number` types are right.
- Status chain `src/services/orders/status-transitions.ts` mirrors `ORDER_STATUS_TRANSITIONS`
  (backend/modules/orders/orders.service.ts:57-68), including "never cancel a paid order"; 409 is handled
  (refetch + `merchant.status_conflict` toast).
- Role guards: `(admin)/_layout.tsx` uses `isAdminRole` (ADMIN or SUPER_ADMIN), so there is no SUPER_ADMIN lockout.
  `(merchant)/_layout.tsx` is MERCHANT-only, which matches `@AllowedRoles([Role.MERCHANT])` (roles.guard lets
  SUPER_ADMIN through ADMIN routes only, not MERCHANT routes). Profile `ManagementSection` uses the same rules.
  Post-login routing sends SUPER_ADMIN to `/(admin)`.
- Invitation role options: ADMIN is offered only to SUPER_ADMIN, which matches invitations.service.ts:41.
  A 403 maps to `admin.invite_forbidden`.
- `ScreenHeader` back falls back to `/(tabs)` when there is no history, so landing on the dashboard after
  `router.replace` is not a dead end.
- RTL: hard-coded `textAlign="right"` on the Arabic inputs is correct. On Android, TextInput maps "right" to
  absolute `Gravity.RIGHT` (RN `ReactTextInputManager.kt:566`), which does not flip in RTL.
- Every screen uses the shared `ScreenHeader`. Touch targets are 44px or more. No pure #000/#fff. ar/en key
  parity holds for the `admin.*` and `merchant.*` namespaces.

---

#### P0 — broken

None found. Nothing in this area crashes on a normal path or calls a non-existent endpoint.

#### P1 — wrong

### MA-1 · P1 · `src/app/(merchant)/shop-profile.tsx:51-52` (schema) vs `backend/modules/shops/dtos/request/shop.update.dto.ts:44-50`
**What:** The backend validates `phone` and `whatsapp` with `@IsPhoneNumber()` and no region, so it only accepts
international format (`+20…`). The mobile Zod schema accepts any string (`z.string().optional()`), and
`onSubmit` always sends both fields. A 400 shows only the generic `common.error` toast.
**Scenario:** A merchant types a local number such as `01012345678` into Phone or WhatsApp and taps Save. The
request returns 400 and the toast says "Something went wrong", with no field error. Every later save also fails
(for example a name or hours edit) because the bad value is sent again. WhatsApp order hand-off depends on this
field, so the shop cannot set it from mobile.
**Fix:** Validate in Zod as international E.164 (`/^\+\d{8,15}$/`). Better: accept a local Egyptian `01xxxxxxxxx`
and normalise it to `+20…` before sending. Show a field error with a hint such as "+20 10 1234 5678". Map a 400
to an inline message.
(Severity check: both seed scripts store `+20…` numbers, so existing seeded shops are not locked out. The
failure only happens when a merchant types a local number. It stays P1, not P0.)

### MA-2 · P1 · `src/app/(merchant)/menu/[productId].tsx:118-121`
**What:** On edit, empty optional fields are sent as `undefined` (`values.description || undefined`, same for
`descriptionAr` and `imageUrl`). `undefined` is dropped from JSON, so the backend keeps the old value. The
`ProductUpdateDto` fields are `@IsOptional`, which accepts `null`.
**Scenario:** A merchant clears a product's image URL or description and taps Save. The success toast appears
and the screen goes back, but the old image and description are still there. A merchant cannot remove a broken
or wrong image from mobile.
**Fix:** In update mode send `null` for cleared fields, as shop-profile already does with `toNullable`. Keep
`undefined` only for create. The columns are nullable (`schema.prisma` Product `description`, `descriptionAr`
and `imageUrl` are `String?`), and the service passes the DTO straight to Prisma. Widen the
`merchantApi.updateProduct` type (`services/api/merchant.ts:108-116`) to `string | null` for those three fields.

### MA-3 · P1 · `src/app/(merchant)/orders/[orderId].tsx:137-145, 276-284`
**What:** Reject/Cancel calls `PATCH …/status {status:"CANCELLED"}` straight away, with no confirmation.
Cancelling is terminal (`ORDER_STATUS_TRANSITIONS.CANCELLED = []`) and the backend push-notifies the resident.
The button sits right next to Accept/Advance, and each button is disabled only by its own pending flag.
**Scenario:** A merchant aims for "Accept" (or "Mark delivered" on an `ON_THE_WAY` order) and hits the
neighbouring red "Reject" or "Cancel order". The order is cancelled for good and the resident gets a
"cancelled" push. The merchant cannot undo it.
**Fix:** Add an `Alert.alert` confirmation (destructive style), as the product delete has. Disable both buttons
while either mutation is pending.

### MA-4 · P1 · `src/app/(admin)/invitations.tsx:148, 215, 309`
**What:** Role labels are built as `t(\`auth.role_${role.toLowerCase()}\`)`. Only `auth.role_merchant` and
`auth.role_admin` exist; `role_resident` is under `profile.*`. `GET /admin/invitations` lists every invitation,
and lead approval creates RESIDENT invitations (backend/modules/residents/residents.service.ts:241-242).
**Scenario:** An admin opens Invitations. Every row for an approved resident shows the raw key text
`auth.role_resident` in the role pill, in both Arabic and English. This is the most common invitation type.
**Fix:** Add `auth.role_resident` (ar `ساكن`, en `Resident`) or map through `profile.role_*`. Widen
`InvitationRole` in `services/api/admin.ts:3` to include `"RESIDENT"` so the type matches
`InvitationResponseDto.role`.

### MA-5 · P1 · `src/app/(admin)/elections/new.tsx` (whole flow) — no way to add candidates
**What:** Mobile can create an election but never calls `POST /elections/:id/candidates`
(backend/modules/governance/controllers/elections.controller.ts:67). `governanceApi` has no candidate method and
no candidates screen exists. Elections are `@PublicRoute` and show up for residents straight away. The web admin
does have candidates (`apps/web/src/app/api/admin/elections/[id]/candidates`).
**Scenario:** An admin creates an election on the phone and gets "Election created". Residents see an election
with zero candidates and nothing to vote for, until someone adds candidates on the web.
**Fix:** After creation, open an "Add candidates" step (name, nameAr, statement, statementAr, optional photoUrl,
matching `CandidateCreateDto`). At minimum, tell the admin to add candidates on the web. Also consider an
admin-only "Open results" action for `ADMIN_CONTROLLED` (`PATCH /elections/:id/results-open`); mobile has no UI
for it either, so results stay sealed unless the web is used.

### MA-6 · P1 · `src/app/(admin)/polls/new.tsx:24,107` and `src/app/(admin)/elections/new.tsx:24,124`
**What:** `expiresAt` is a free-text field (placeholder `YYYY-MM-DD`). Zod only checks `min(1)`. The backend
does `@Type(() => Date) @IsDate()` and has no "must be in the future" check (polls.service.ts:37,
elections.service.ts:68).
**Scenario:** (a) Text like `20/10/2026` or Arabic-Indic digits `٢٠٢٦-١٠-٢٠` becomes an Invalid Date, the
backend returns 400, and the toast is generic. (b) A past date such as `2025-10-20` is accepted: the poll is
already expired when published, and the election cron (`elections.service.ts:39-45`) opens its results within
5 minutes. (c) A date-only value parses as UTC midnight (02:00/03:00 Cairo), so the deadline is earlier than
the admin expects.
**Fix:** Use a native date/time picker, or at least a Zod refine that parses `YYYY-MM-DD[ HH:mm]`, requires a
future time and sends `toISOString()` built from local time. Show a field error.

#### P2 — polish

### MA-7 · P2 · `src/app/(merchant)/orders/[orderId].tsx:224` and `orders/index.tsx:217`
Item names always use `productNameSnapshot` (English), even in Arabic. The backend sends
`productNameArSnapshot`, and the web uses it (`MerchantOrderDetail.tsx`). **Fix:** pick it by `i18n.language`.

### MA-8 · P2 (style nit) · `src/app/(merchant)/orders/[orderId].tsx:244`
`{order.notes && (…)}`: React does not create a text node for an empty string, so this does not crash. Prefer
a ternary to match the rest of the file. No behaviour change.

### MA-9 · P2 · `src/app/(merchant)/orders/[orderId].tsx:236-251`
Payment status (`isPaid`) is not shown. The web shows paid/unpaid. Since cancel is hidden for paid orders, the
merchant cannot tell why. **Fix:** add a Paid/Unpaid meta row.

### MA-10 · P2 · `src/app/(merchant)/dashboard.tsx:91-94, 112-118`
The shop open/close `Switch` has no `onError` and no optimistic update. The switch shows the server value, so
it snaps back while the request runs, and a failure is silent. `thumbColor={colors.text}` is a near-black thumb
in light theme (the same issue as on-device finding #6). **Fix:** optimistic `setQueryData` with rollback plus
an error toast; use the thumb colour from the fixed Profile switch.

### MA-11 · P2 · `src/app/(merchant)/dashboard.tsx:80-89, 131`
The pending count comes from a `limit: 5` page. With 7 pending orders the banner says "5 new orders waiting"
while the stat card says "5+". The en copy also reads "1 new orders waiting" (no plural forms). **Fix:** pass
`displayCount` into the banner, or use a count endpoint; add `_one`/`_other` plural keys.

### MA-12 · P2 · `src/app/(merchant)/dashboard.tsx:96-97`
A merchant with no shop (or a soft-deleted one) gets 404 `shop.error.notFound` from `resolveShopId`, and the
screen shows a generic error with Retry, which loops forever. **Fix:** on 404, show "No shop is linked to your
account — contact the administrator".

### MA-13 · P2 · `src/app/(merchant)/shop-profile.tsx:42-43` vs `backend/modules/shops/dtos/request/working-hours.dto.ts:9-14`
Zod allows `open`/`close` to be `""`, but the backend requires `HH:mm` on every day, including closed days. If a
merchant clears a time and marks the day closed, the save returns 400 with a generic toast. **Fix:** require
`HH:mm` always, or fill closed days with the last valid times before sending.

### MA-14 · P2 · `src/app/(merchant)/shop-profile.tsx:290-297`
A shop with no `workingHours` is pre-filled with 09:00–22:00 open every day. Any save (even a name change) sends
the full object, so it publishes hours the merchant never entered. Residents' "open now" is then computed from
them. **Fix:** leave days empty or unset until edited, or send `workingHours` only when that section is dirty.

### MA-15 · P2 · `src/app/(merchant)/shop-profile.tsx:323-335`
`reset()` runs whenever the `shop` object identity changes (any refetch of `["merchant-shop"]`, for example on
reconnect, focus, or the dashboard toggle invalidating it). This wipes unsaved edits. **Fix:** reset once (track
a `hydrated` ref) or only when `!isDirty`.

### MA-16 · P2 · `src/app/(merchant)/shop-profile.tsx:11, 352-354`
`ActivityIndicator` spinner in the save button. The design system says never use spinners. **Fix:**
pressed/disabled state, or a skeleton pulse.

### MA-17 · P2 · `src/app/(merchant)/shop-profile.tsx:480-486`
The per-day `Switch` means "closed": ON is a red track and OFF is green. This is the reverse of the usual mental
model. **Fix:** make the switch mean "Open" (ON = open), or use a labelled segmented control.

### MA-18 · P2 · `src/app/(merchant)/menu/[productId].tsx:26, 95`
Price: (a) a new product starts with `price: 0`, so the field shows "0" and the merchant has to delete it;
(b) `z.coerce.number` gives `NaN` for a decimal comma `12,5` or Arabic-Indic digits `١٢` (Arabic keyboard), and
shows "Enter a price greater than zero"; (c) 3 decimal places pass Zod but fail
`@IsNumber({ maxDecimalPlaces: 2 })` with a generic error. **Fix:** default to `""`, normalise Arabic-Indic
digits and commas, and add `multipleOf(0.01)` or a 2-decimal refine.

### MA-19 · P2 · `src/app/(merchant)/menu/[productId].tsx:78-111`
In edit mode there is no loading or not-found state. On a cold open, or when the product was deleted elsewhere,
the form is blank and Save sends a full update that 404s (generic error). **Fix:** show a skeleton while
`!isNew && !data`, and a not-found message when the list has loaded but has no match.

### MA-20 · P2 · `src/app/(merchant)/menu/[productId].tsx:27`, `src/app/(merchant)/menu/index.tsx`
The image is a pasted URL field (no picker). The URL error copy says "must start with https://", but Zod's
`.url()` also accepts `http:`/`ftp:`. This is a known backlog item; listed for completeness.

### MA-21 · P2 · `src/app/(merchant)/menu/index.tsx:74-79`
The availability `Switch` has no optimistic update. It snaps back until `getAllMyProducts` (up to 20 pages)
refetches. **Fix:** optimistic `setQueryData` on `["merchant-products"]`.

### MA-22 · P2 · `src/app/(merchant)/orders/index.tsx:22, 196`
The filter has no DELIVERED/CANCELLED chips, and cards show only the time (no date), so yesterday's orders look
like today's. `refreshing={false}` (`orders/index.tsx:146`, `menu/index.tsx:128`) means pull-to-refresh shows no
feedback. **Fix:** add the two chips, show a relative date and time, and bind `refreshing` to `isRefetching`.

### MA-23 · P2 · `src/app/(admin)/polls/new.tsx:113-136`
"Add option" goes up to 6, but there is no remove control. Extra rows are registered with `undefined`, so an
unwanted empty option blocks submit with "This field is required" until the admin leaves the screen. "+ Add
option" has no `accessibilityRole`. The option placeholders use hard-coded `(EN)`/`(AR)`. **Fix:** use
`useFieldArray` with append/remove and translated placeholders.

### MA-24 · P2 · `src/app/(admin)/invitations.tsx:260-266`
There is no empty state: with zero invitations the list is blank under the header. **Fix:** add the
standard empty view.

### MA-25 · P2 · `src/app/(admin)/index.tsx:49-54` — admin parity gap
The mobile admin hub has only invitations and three "create" forms. There is no lead approval (the only way
residents join), no candidates (MA-5), no results-open, no poll/election/announcement edit or delete, and for
SUPER_ADMIN no activity log or recycle bin. If these stay web-only, add a short "More tools on the web" row
linking to the web admin, so admins are not left looking for them.

### Mobile audit: auth flows and English LTR (read-only, 2026-10-07)

Scope: `apps/mobile` at HEAD (e9916a0 plus later commits). Every finding below was checked against the code. Backend contracts were read in
`apps/backend/src/common/auth/**`, `modules/invitations`, `modules/residents` and `common/response/filters/response.exception.filter.ts`.
Nothing here was run on a device. Where a finding depends on library behaviour, the library source was read (expo-router 6.0.24 `Redirect`).

Severity: P0 = broken, P1 = wrong, P2 = polish.

---

#### AUTH

### AUTH-1. P0/P1: turning biometric login off in Profile deletes the live session's refresh token
- **Where:** `src/lib/hooks/use-biometric.ts:136-143` (`disable()` deletes `SECURE_KEY_REFRESH`); called from `src/app/(tabs)/profile/index.tsx:494-507` (`handleToggle(false)`) while the user is signed in.
  Related: `src/services/api/client.ts:137-163`.
- **What's wrong:** `runTokenRefresh` throws a plain `Error("No refresh token available")`, which has no `response`. So `isAuthRejection()` is false and the session-expired teardown never runs. The interceptor just re-rejects the original 401.
- **Scenario:**
  1. A signed-in resident switches "Fingerprint login" OFF.
  2. Up to 15 minutes later the access token expires.
  3. Every authenticated request (orders, feedback, notifications, votes, profile) now fails with 401 and error states. The UI still shows the user as signed in.
  4. Nothing recovers until a cold restart. On restart, rehydration sees the missing refresh token and calls `logout()`.
  5. Logout from Profile also cannot revoke anything, because there is no refresh token left to revoke.
- **Fix:** `disable()` should delete the refresh token only when it was kept for a signed-out biometric session, i.e. not while `auth.isAuthenticated`. Split it into `disablePreference()` and `forgetKeptSession()`. Also treat "no refresh token" in `runTokenRefresh` as an auth rejection, so the session ends cleanly.

### AUTH-2. P1: accept-invitation shows "enter your current password" for a flat already owned by someone else
- **Where:** `src/lib/api-error.ts:35-39` (`acceptInvitationErrorKey`); backend `common/auth/services/auth.service.ts:386-389` throws `ConflictException('unit.error.alreadyOwned')`. The exception filter emits it as `code`.
- **What's wrong:** every 409 except `user.error.accountDeleted` maps to `auth.errors.invitation_existing_account`.
- **Scenario:** a resident whose invited flat is already registered to another account gets told to type their current password. They retry with different passwords and keep getting the same message. The real cause, a flat already owned, is never shown.
- **Fix:** map `unit.error.alreadyOwned` to new copy, e.g. "This flat is already registered to another account. Contact the administration." Add it to en and ar. Map only the existing-account 409 (whose message is prose, so it has no code) to the current-password copy.

### AUTH-3. P1: login shows "Incorrect email or password" for every server error
- **Where:** `src/app/(auth)/login.tsx:227-232`.
- **What's wrong:** only `undefined` (no response) and 429 are special-cased. Every other status, including 500, 502 and 503, falls into `auth.errors.login_failed`.
- **Scenario:** Redis is down, so the backend fails closed with 503 (documented owner decision). Or Cloudflare/Render return 502/503/52x during a deploy or cold edge. Residents with correct passwords are told their credentials are wrong. They then try more passwords, which burns the per-email lockout (10 failures / 15 min).
- **Fix:** use `login_failed` only for 401. Map 5xx to `errors.server` (exists in en/ar) or `common.server_waking`. Map 400 to `auth.errors.invalid_email`.

### AUTH-4. P1: accept-invitation for an EXISTING account forces "new password" rules on the current password
- **Where:** `src/app/(auth)/accept-invitation.tsx:23-27`, `:108-161`. Backend: `auth.service.ts:306-315`. `AcceptInvitationDto` also regex-checks `password`.
- **What's wrong:**
  - The form only reads as "create an account": name, new password and confirm, validated with `newPasswordSchema`.
  - The owner decision says an existing account must enter its CURRENT password, but nothing tells the user that up front. They only find out from a 409 toast after submitting.
  - The name field is required (min 2), yet the backend ignores it for existing accounts.
  - The role badge (`:94-100`) is set only after success, just before `completeLogin` navigates away. It labels a RESIDENT invitation as "Merchant" (`isAdminRole ? admin : merchant`).
- **Scenario:** an existing resident is invited as a merchant. They type a fresh password (the screen asks for one), get the 409 toast, retype, and confirm again.
- **Fix:**
  - Add a hint line above the password: "Already have an EastPark account? Enter its current password."
  - Drop the stale badge, or map RESIDENT to `profile.role_resident`.
  - Note that this screen is currently unreachable from email (AUTH-6), so this matters once deep links work.

### AUTH-5. P1: accept-invitation shows a generic error for used, expired or unknown invitations
- **Where:** `src/lib/api-error.ts:38`. Backend `auth.service.ts:291-297` returns 404 "Invitation not found", 400 "Invitation already used" and 400 "Invitation expired".
- **Scenario:** a user taps an old invite. They see "Something went wrong" and retry forever, instead of being told to ask for a new invitation.
- **Fix:** map 400/404 to `auth.invitation_invalid` + `auth.contact_administrator`, 429 to `errors.rate_limited`, and no response to `errors.unreachable`.

### AUTH-6. P1: the mobile reset-password and accept-invitation screens cannot be reached from the emails
- **Where:**
  - Backend link builders: `auth.service.ts:231` (`${app.webUrl}/auth/reset-password?token=`) and `modules/invitations/invitations.service.ts:139` (`${webUrl}/auth/accept-invitation?token=`).
  - Mobile `app.config.ts:66-73` has only a custom-scheme intent filter (`eastpark` / `eastpark.preview`). It has no https host, no `ios.associatedDomains`, and no `+native-intent` rewrite.
  - expo-router serves the screens at `/reset-password` and `/accept-invitation` (inside the `(auth)` group), not `/auth/...`.
- **What's wrong:** every emailed link opens the web app. `src/app/(auth)/reset-password.tsx` and `accept-invitation.tsx` are effectively dead code. `autoVerify: true` on a custom scheme does nothing.
- **Not P0:** the web pages `apps/web/src/app/auth/reset-password` and `/auth/accept-invitation` exist and complete the flow. The user then signs in on mobile.
- **Fix (choose one):**
  - Accept that web owns these flows: remove or hide the mobile screens and say so in the docs.
  - Or add Android App Links: an https intent filter for the web host with `pathPrefix /auth/`, plus `assetlinks.json` on Vercel. Add iOS associated domains, and a `+native-intent.tsx` that rewrites `/auth/reset-password` to `/(auth)/reset-password`.

### AUTH-7. P1: guest or forced-logout navigation dead-ends on Login (back exits the app, no "continue as guest")
- **Where:**
  - `<Redirect href="/(auth)/login" />` guards in `src/app/(tabs)/orders/_layout.tsx:14-16`, `src/app/(tabs)/community/feedback/_layout.tsx:11` and `src/app/notifications.tsx:111`.
  - `teardownSession()` in `src/services/auth/session.ts:72` does `router.replace("/(auth)/login")`.
  - expo-router `build/link/Redirect.js:34-37` calls `router.replace` inside `useFocusEffect`.
  - `src/components/auth/auth-screen-wrapper.tsx`: Login has no back or close control.
- **What's wrong:**
  - `replace` swaps the root-stack `(tabs)` entry for Login. Android hardware back then leaves the app, and iOS has no way back at all.
  - Login offers no "Continue as guest".
  - The Redirect guards don't set `pendingRedirect`, so after signing in the user lands on the role home, not on Orders or Notifications.
  - The guest prompt in `orders/index.tsx:230` can never render, because the layout redirects first.
- **Scenarios:**
  - A guest taps the Orders tab and is sent to Login. Back closes the app.
  - After Sign Out, or a session expiry, the user cannot browse as a guest without killing and relaunching the app.
  - A guest taps an order push, logs in, and lands on Home instead of the order.
- **Fix:**
  - For the Orders tab, render the existing guest prompt in the layout or index instead of redirecting.
  - For the other guards, dispatch `showAuthWall({ redirectAction: pathname })` or `router.push`, not `replace`.
  - Add a "Continue as guest" link or back button to Login that does `router.replace("/(tabs)")`.
  - *Device check recommended* for the exact back-stack result, though the code path is certain.

### AUTH-8. P2: login email is not trimmed
- **Where:** `src/app/(auth)/login.tsx:29-32` and `forgot-password.tsx:21-23` use `z.string().email(...)` without `.trim()`.
  Verified: `z.string().email().safeParse("a@b.com ").success === false`.
- **Scenario:** an email pasted or autofilled with a trailing or leading space shows "Enter a valid email address" even though it looks correct. The web `RegisterUnitForm` trims; mobile does not.
- **Fix:** `z.string().trim().toLowerCase().email(...)` and `autoCorrect={false}` on email inputs. Also store the normalised email for biometric (`login.tsx:212`).

### AUTH-9. P2: reset-password reports every failure as "link expired"
- **Where:** `src/app/(auth)/reset-password.tsx:119-125`.
- **Scenario:** an offline or timed-out request (the token has NOT been consumed) or a 429 tells the user the link expired. They request a new email unnecessarily, which counts toward the 3-per-15-min forgot cap.
- **Fix:** keep the expired copy for 400 only. Use `errors.unreachable` for no response and `errors.rate_limited` for 429.
- Same screen: the invalid-link card (`:82-99`) shows `auth.contact_administrator` ("…for a new invitation link"), which is invitation copy on a password-reset screen. Offer a "Request a new link" button to `/(auth)/forgot-password` instead.

### AUTH-10. P2: forgot-password has no 429 copy, no cold-start hint and a fragile back link
- **Where:** `src/app/(auth)/forgot-password.tsx:154-167` and `:208-218`.
- **What's wrong:**
  - Every failure shows `common.error`.
  - There is no `common.server_waking` hint, unlike login.
  - `router.back()` does nothing when the screen has no history.
- **Fix:** reuse login's waking-timer pattern and status mapping. Use `router.canGoBack() ? back() : replace("/(auth)/login")`.

### AUTH-11. P2: biometric state is per-device, not per-account
- **Where:** `src/app/(auth)/login.tsx:166-168` and `:204-213`; `src/lib/hooks/use-biometric.ts:125-134`.
- **Scenario:**
  1. User A enables biometric and signs out. The refresh token is kept and not revoked server-side.
  2. User B signs in with a password on the same phone. `completeLogin` overwrites the stored refresh token with B's.
  3. `maybePromptEnableBiometric` returns early because biometric is already enabled.
  4. The login screen still shows "Sign in with Fingerprint" with **A's email**, but tapping it signs in **B**.
  5. A's kept refresh token is never revoked and stays valid for up to 7 days.
- **Fix:** on password login, if `biometric.email !== normalisedEmail`, disable biometric (or re-prompt) before saving the new tokens. Revoke the previously kept refresh token.

### AUTH-12. P2: navigation after login waits for push registration
- **Where:** `src/services/auth/session.ts:52-53` (`await registerPushToken()` before `router.replace`).
- **Scenario:** on first sign-in on Android 13+ the OS permission dialog appears over Login while the button spins. On a slow network the `PATCH /auth/push-token` (60 s timeout) holds the user on the login screen after a successful login.
- **Fix:** navigate first, then call `void registerPushToken()`.

### AUTH-13. P2: forced logouts are silent
- **Where:** `src/app/_layout.tsx:38` (`setSessionExpiredHandler(() => teardownSession(...))`). `errors.session_expired` exists in en/ar but nothing in `src` uses it.
- **Scenario:** after a password reset on the web (session version bump), an account delete elsewhere, or 7-day refresh expiry, the user is suddenly on Login with no explanation.
- **Fix:** show `errors.session_expired` in the expired handler.

### AUTH-14. P2: login on a cold backend has no retry
- **Where:** `src/services/api/client.ts:47` (`API_TIMEOUT_MS = 60_000`); `login.tsx:204-237`.
- **Scenario:** Render cold start is about 60 s, which is the same as the timeout. If the app-launch `warmUpServer()` didn't land (app resumed from background after a long idle), the first login can time out and show "couldn't reach the server". The web app added a retry for this (commit 01057ce); mobile has none.
- **Fix:** on a no-response error during login, ping `/health` once, then retry the login once.

### AUTH-15. P2: the login screen's "register your unit on the website" is plain text
- **Where:** `src/app/(auth)/login.tsx:272-274`.
- **Scenario:** a new resident has nothing to tap and has to find the website on their own.
- **Fix:** make it a link that calls `Linking.openURL(\`${WEB_URL}/register-unit\`)`.

### AUTH-16. P2: AuthInput's focus border sticks after the first focus
- **Where:** `src/components/auth/auth-input.tsx:41-48`. `{...props}` is spread after `onFocus` and `onBlur`. Every auth form passes react-hook-form's `onBlur`, which replaces the internal `setFocused(false)`.
- **Scenario:** each field keeps its gold "focused" border after the user moves to the next field. Email and password both look focused.
- **Fix:** chain the handlers: `onBlur={e => { setFocused(false); props.onBlur?.(e); }}`, and the same for `onFocus`.

### AUTH-17. P2 (known backlog REV-17, recorded for completeness): logout leaves the server push token bound
- **Where:** `src/services/auth/session.ts:60-73` only clears the local "last sent" marker. Biometric logout (`profile/index.tsx:238-241`) also keeps the session.
- **Scenario:** a signed-out device keeps receiving that user's order and feedback pushes.

Checked and OK:
- Single-flight refresh, Bearer refresh header, and the body token matching the header (backend `refresh()` rejects a mismatch, and mobile sends the same token).
- Rotated pair persisted before waiters are released.
- Logout revoke with a rotate-once fallback.
- 401/403/429 on login are handled.
- 403 copy for unverified accounts.
- Tokens only in SecureStore (redux-persist blacklists tokens).
- Auth-wall replay keeps `pendingRedirect` through the sheet dismissal.
- Reset token single use (GETDEL server-side).
- `PASSWORD_REGEX` matches the backend.

---

#### LTR / i18n

Key parity: en and ar both have 406 leaf keys, with no key present in only one file. Interpolation variables match.
Every literal key in `src` (any `"ns.key"` string, not only `t("…")` calls) exists in both files. Dynamic keys were checked against the Prisma enums: ShopCategory, OrderStatus, AnnouncementCategory, FeedbackCategory/Status, ElectionVisibilityMode, merchant `advance_to_*`, `merchant.days.*` and biometric kinds. One exception follows.
Every directional icon (ArrowLeft, CaretRight, PaperPlaneTilt) passes `mirrored={I18nManager.isRTL}`. There are no physical `marginLeft`/`paddingRight`/`left:` values in active screens; the only ones are symmetric scrims and unused obytes template components.

### LTR-1. P1: the admin invitations list renders the raw key `auth.role_resident`
- **Where:**
  - `src/app/(admin)/invitations.tsx:309` (and `:148` and `:215`): `t(\`auth.role_${invitation.role.toLowerCase()}\`)`.
  - `src/services/api/admin.ts:3` narrows `InvitationRole` to `"MERCHANT" | "ADMIN"`.
  - The backend `InvitationsService.findAll` (`invitations.service.ts:107-123`) has no role filter, and `residents.service.ts:242` creates `RESIDENT` invitations on every lead approval.
- **What's wrong:** `auth.role_resident` (and `auth.role_super_admin`) are missing from both en and ar.
- **Scenario:** an admin opens Invitations. Every resident approval shows the pill text "auth.role_resident", in both languages.
- **Fix:** add `RESIDENT` to the type and use the existing `profile.role_resident` / `profile.role_super_admin` keys, through a shared `roleLabelKey()` like the one at `profile/index.tsx:278-286`.

### LTR-2. P2: tapping the already-selected language restarts the app, with no confirmation
- **Where:** `src/app/(tabs)/profile/index.tsx:385-388` → `src/lib/i18n/utils.tsx:27-36`. `changeLanguage` always calls `reloadApp()`.
- **Scenario:** a user taps "العربية" while already in Arabic, or mis-taps English. The app restarts immediately and in-progress state (forms, scroll, open sheets) is lost. CLAUDE.md specifies a restart *prompt*.
- **Fix:** return early when `lang === language`. Show an `Alert` ("The app will restart to apply the language") before `changeLanguage`.

### LTR-3. P2: English plural and Arabic digits in count strings
- **Where:**
  - `merchant.pending_count_waiting` ("{{count}} new orders waiting"), used at `src/app/(merchant)/dashboard.tsx:131`.
  - `notifications.time_minutes|hours|days` at `src/app/notifications.tsx:276-288`.
- **What's wrong:**
  - There are no `_one`/`_other` variants, so English shows "1 new orders waiting".
  - Arabic has no `_zero/_one/_two/_few/_many` forms.
  - `count` is interpolated raw, so the Arabic UI shows Latin digits ("3 طلبات"). The 2026-10-07 audit fixed this elsewhere with `formatCount`.
- **Fix:** add plural keys (`_one`/`_other` in en; ar forms) and pass a localized count (`formatCount`) as a separate interpolation variable.

### LTR-4. P2: hardcoded language tags and format hints in admin forms
- **Where:**
  - `src/app/(admin)/polls/new.tsx:119` and `:126`: placeholder `` `${t("admin.option")} ${i + 1} (EN)` `` / `(AR)`, with the index not localized.
  - `polls/new.tsx:107` and `elections/new.tsx:124`: `placeholder="YYYY-MM-DD"`.
- **Scenario:** the Arabic admin UI shows "خيار 1 (AR)" with Latin tags and digits. This is minor in the English UI.
- **Fix:** move these into translation keys (`admin.option_en`/`admin.option_ar` with `{{n}}`), or reuse `validation.invalid_date` wording for the hint.

### LTR-5. P2: the SignOut icon is not mirrored
- **Where:** `src/app/(tabs)/profile/index.tsx:437`. Every other directional icon passes `mirrored={I18nManager.isRTL}`.
- **Scenario:** in Arabic RTL the sign-out arrow points "inward". Cosmetic.
- **Fix:** add `mirrored={I18nManager.isRTL}`.

### LTR-6. P2: the first frame renders in the device language, not the saved one
- **Where:** `src/lib/i18n/index.tsx:12-14` initialises with `getLocales()[0]?.languageTag`. The saved Redux language is applied later, in the `Providers` effect (`src/app/_layout.tsx:104-110`).
- **Scenario:** on an English-locale phone with Arabic saved (the default), the first render after the splash can flash English strings, then switch.
- **Fix:** gate the UI on PersistGate plus `i18n.changeLanguage(saved)` before hiding the splash, or initialise with `lng: "ar"` (the product default).

Not filed (checked and correct):
- `textAlign="right"` on Arabic-content admin and merchant inputs.
- Symmetric `left:0/right:0` scrims.
- `metaValue textAlign:"right"` (end-aligned value in LTR; RN swaps left/right in RTL).
- Date and number formatting uses `ar-EG` / `en-GB` consistently via `i18n.language`.
- `formatCurrency` uses `ar-EG` / `en-US`.
- No hardcoded user-facing English or Arabic strings in JSX apart from LTR-4.
- `ensureLayoutDirection` guards against a reload loop.
