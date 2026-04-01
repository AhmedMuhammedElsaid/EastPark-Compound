# EastPark Frontend — Compliance Audit (Fresh Review)

**Audit date:** 2026-03-30 | **Compliance at audit:** ~72% | **Total issues:** 38
**Resolution date:** 2026-04-01 | **Compliance now:** ~100% | **Resolved:** 37/38 (P1-05 requires `eas init` — user action)

### Resolution commits
| Phase | Commit | Description |
|---|---|---|
| P0 | `0e2270a` | All 6 ship-blockers |
| P1 | `bd4f500` | All 9 required features |
| P1+ | `6962cfc` | Admin creation screens (announcements, polls, elections) |
| P2 | `d9546d4` | All 17 design & i18n violations |
| P3 | `ce8c9d3`, `8533842` | All 6 polish gaps |

---

## ✅ Confirmed Compliant

| Area | Detail |
|---|---|
| Stack versions | Expo 54 / RN 0.81.5 / React 19.1.0 — exact match |
| Redux Toolkit + redux-persist (MMKV) | 3 slices, all persisted correctly |
| TanStack Query v5 | Confirmed |
| React Hook Form + Zod | Correct per CLAUDE.md (template swap complete) |
| Axios client + 401 refresh queue | Full implementation with queue pattern |
| SecureStore for JWT | Constants `SECURE_KEY_ACCESS` / `SECURE_KEY_REFRESH` used everywhere |
| FlashList on directory, orders, community, feedback, reports, notifications | ✅ |
| Cursor pagination (useInfiniteQuery) | Directory, orders, community, feedback, reports, notifications |
| `refreshing={isRefetching}` | directory ✅, orders ✅, community ✅ |
| authSlice shape | Matches spec exactly |
| cartSlice multi-shop conflict guard | Logic correct; wiring verified |
| Cart persistence | `cartSlice` wrapped in `persistReducer` with MMKV; transient fields blacklisted |
| CartConflictSheet Redux wiring | Connected correctly (one fix already applied: `pendingShopName` used over `shopName`) |
| preferencesSlice | language=`'ar'`, theme=`'dark'` defaults correct |
| Auth-wall bottom sheet | Global mount, Redux-driven, 3-button layout |
| useAuthGuard hook | `requireAuth` + `requireAuthNavigation` — correct |
| i18n (i18next + expo-localization) | 14 namespaces, AR+EN, RTL flag wired |
| Design tokens (`src/theme/tokens.ts`) | BRAND/LIGHT/DARK/SEMANTIC/SPACING/RADIUS/FONT — exact DESIGN.md match |
| Cairo + Cormorant Garamond fonts | Loaded via expo-font plugin |
| Skeleton shimmer on all list screens | `Skeleton` + `ShopCardSkeleton` — no spinners |
| Phosphor icons installed | `phosphor-react-native ^3.0.4` |
| Lottie installed | `lottie-react-native ^7.2.2` |
| Dark mode default | `preferencesSlice` defaults to `'dark'` |
| Socket.io order tracking | `getOrdersSocket`, `joinOrderRoom`, `leaveOrderRoom` — full lifecycle |
| formatCurrency utility | `src/lib/formatCurrency.ts` exists |
| ErrorState component | `src/components/ui/error-state.tsx` exists |
| push/index.ts | `src/services/push/index.ts` exists |
| Auth screens (login, register, verify-otp, forgot-password, reset-password, accept-invitation) | All exist and complete |
| Merchant screens (dashboard, menu CRUD, orders) | All exist |
| Admin layout guard | `(admin)/_layout.tsx` correctly guards ADMIN role |

---

## ✅ P0 — Runtime Crashes & Ship-Blockers (6) — ALL RESOLVED (commit `0e2270a`)

### P0-01 · `profile/index.tsx` — `SEMANTIC` used but NOT imported → runtime crash
`rowLabelDanger` StyleSheet on line 272 uses `color: SEMANTIC.error`. The import on line 16 only includes `{ BRAND, DARK, FONT, RADIUS, SPACING }` — `SEMANTIC` is absent. This crashes the profile screen on render for every authenticated user.
**Fix:** Add `SEMANTIC` to the import from `'@/theme/tokens'`.

### P0-02 · `reports/index.tsx` — `ReportRow` Pressable has no `onPress`
The entire row is tappable visually but `onPress` is missing. Tapping a PDF report does nothing.
**Fix:** Add `onPress={() => Linking.openURL(report.pdfUrl)}` and import `Linking`.

### P0-03 · `[announcementId].tsx` — `pdfRow` View is not tappable
On the announcement detail screen, the PDF row is a plain `View`, not a `Pressable`, and has no `onPress`. PDF is unreachable on the detail page.
**Fix:** Wrap in `<Pressable onPress={() => Linking.openURL(announcement.pdfUrl)}>`.

### P0-04 · `[shopId]/index.tsx` — WhatsApp CTA button has no `onPress`
The WhatsApp button renders a label but has no handler. Phone CTA correctly calls `Linking`, WhatsApp does not.
**Fix:** Add `onPress={() => Linking.openURL(`https://wa.me/${shop.whatsapp}`)}`.

### P0-05 · `feedback/index.tsx` — `refreshing={false}` hardcoded
`onRefresh={refetch}` is wired but `refreshing` is always `false`. Pull-to-refresh spinner never appears.
**Fix:** Replace `refreshing={false}` with `refreshing={isRefetching}`.

### P0-06 · `reports/index.tsx` — `refreshing={false}` hardcoded
Same bug as P0-05.
**Fix:** Replace `refreshing={false}` with `refreshing={isRefetching}`.

---

## ✅ P1 — Missing Required Features (9) — ALL RESOLVED (commits `bd4f500`, `6962cfc`)

### P1-01 · `useAuthRehydration.ts` — does NOT exist
`src/hooks/useAuthRehydration.ts` is missing from the filesystem. On every cold launch `isAuthenticated = false` until redux-persist rehydrates from MMKV, creating a flash of unauthenticated state. A bootstrap hook must read tokens from SecureStore and dispatch `login()` if valid tokens exist.

### P1-02 · `push/index.ts` — never requests permissions, silently skips
`registerPushToken()` calls `getPermissionsAsync()` and only proceeds if `status === 'granted'`. It never calls `requestPermissionsAsync()`. On first launch after install, push tokens are never registered.
**Fix:** Call `requestPermissionsAsync()` when status is not granted.

### P1-03 · `verify-otp.tsx` — local `registerPushToken` missing `projectId`
The file still has a local copy of `registerPushToken` that calls `Notifications.getExpoPushTokenAsync()` without the required `projectId` argument. In production Expo SDK builds this silently fails.
**Fix:** Remove local definition; import from `@/services/push`.

### P1-04 · `app.config.ts` — no `intentFilters` for deep links
No Android `intentFilters` or iOS Associated Domains are configured. Deep links `eastpark://auth/reset-password` and `eastpark://auth/accept-invitation` will not open the app from email clients.
**Fix:** Add `intentFilters` array to the Android config in `app.config.ts`.

### P1-05 · `app.config.ts` — `EAS_PROJECT_ID` is empty string
`eas init` has not been run. Expo push notifications require a valid `projectId`. `registerPushToken()` will fail in production builds.

### P1-06 · Governance lists — no pagination (capped at 20)
`governance/index.tsx` uses `useQuery` with `limit: 20` for both polls and elections. No `useInfiniteQuery`, no FlashList, no "load more". Plan mandates cursor pagination on all list endpoints.
**Fix:** Convert to `useInfiniteQuery` + FlashList.

### P1-07 · Products on shop detail — no pagination (capped at 50)
`[shopId]/index.tsx` fetches products with `limit: 50` via `useQuery`. Menus with >50 items silently truncate.
**Fix:** Convert to `useInfiniteQuery` with FlashList replacing `.map()`.

### P1-08 · Admin portal screens — not implemented
`(admin)/_layout.tsx` exists (role guard only). No admin creation screens exist for announcements, polls, or elections. Plan requires `(admin)/announcements/new.tsx`, `(admin)/polls/new.tsx`, `(admin)/elections/new.tsx`.

### P1-09 · Notification tap — does not route anywhere
`notifications/index.tsx`: tapping a notification only marks it as read; it does not navigate to the linked screen. `notification.type` data is present but ignored.
**Fix:** Add routing logic based on `notification.type` (e.g. ORDER → `/orders/:id`, ANNOUNCEMENT → `/community/:id`).

---

## ✅ P2 — Design & i18n Violations (17) — ALL RESOLVED (commit `d9546d4`)

### P2-01 · `forgot-password.tsx` — `'#B03A2E'` hardcoded, `SEMANTIC` not imported
`showMessage` error call uses raw hex. `SEMANTIC` is not imported in this file.
**Fix:** Import `SEMANTIC`; replace `'#B03A2E'` with `SEMANTIC.error`.

### P2-02 · `[shopId]/index.tsx` — `'EGP'` hardcoded (2 locations)
Lines 252 and 332. `formatCurrency` utility exists but is not used here.
**Fix:** Import and use `formatCurrency(price)`.

### P2-03 · `cart.tsx` — `'EGP'` hardcoded (3 locations)
Lines 62, 122, 135. Same fix: use `formatCurrency`.

### P2-04 · `(merchant)/orders/index.tsx` — `'EGP'` hardcoded
Same fix.

### P2-05 · `(merchant)/orders/[orderId].tsx` — `'EGP'` hardcoded (3 locations)
Same fix.

### P2-06 · `(tabs)/index.tsx` — `ann.category` rendered raw (no `t()`)
The home screen preview renders the raw API enum (`"MAINTENANCE"`, `"NEWS"`) directly. The community namespace already has flat uppercase keys (`community.GENERAL`, `community.NEWS`, etc.) — use those.
**Fix:** Replace `{ann.category}` with `{t(`community.${ann.category}`)}`.

### P2-07 · `governance/index.tsx` + `polls/[pollId].tsx` + `elections/[id].tsx` — `"votes"` / `"votes ·"` hardcoded
All three screens hardcode English vote count text. `governance.votes` key does not exist in either translation file.
**Fix:** Add `"votes": "{{count}} votes"` to `en.json` and `"votes": "{{count}} أصوات"` to `ar.json` under `governance`; replace hardcoded text with `t('governance.votes', { count })`.

### P2-08 · `profile/index.tsx` — `AccountSection` title uses `t('auth.login')` (wrong key)
Renders "Login" as a section heading. `profile.account` key does not exist in translation files.
**Fix:** Add `"account": "My Account"` / `"account": "حسابي"` to translation files; update the call.

### P2-09 · `[announcementId].tsx` — `"Load more"` hardcoded
Line 111. Not wrapped in `t()`.
**Fix:** Use `t('common.load_more')` and add the key to both translation files.

### P2-10 · `feedback/[feedbackId].tsx` — `"Admin"` hardcoded + `'en-GB'` locale hardcoded
Line 110 renders `"Admin"` as a badge. Lines 36-40 and 100-104 use `toLocaleDateString('en-GB', ...)` ignoring Arabic locale.
**Fix:** Add `t('common.admin')` key; replace `'en-GB'` with `isAr ? 'ar-EG' : 'en-GB'`.

### P2-11 · `feedback/index.tsx` — `'en-GB'` locale hardcoded + `"+"` new button not in `t()`
Date formatting ignores Arabic locale. `"+"` new button label is a raw literal.
**Fix:** Same locale fix; replace `"+"` with a Phosphor `Plus` icon.

### P2-12 · Merchant screens — extensive hardcoded English strings
`dashboard.tsx`: alert banner (`new`, `order`, `orders`, `waiting`), StatCard labels (`"Open"`, `"Pending"`).
`menu/index.tsx`: delete confirmation alert.
`menu/[productId].tsx`: nav title `'New Product'`, all 6 form field labels.
`(merchant)/orders/index.tsx` + `[orderId].tsx`: `'Unit'` prefix (no space → renders `"Unit42"` not `"Unit 42"`), `'Total'` label.
**Fix:** All must go through `t()`. Add missing keys to `merchant` namespace in both translation files.

### P2-13 · `notifications/index.tsx` — `formatRelativeTime` returns raw English
`'now'`, `'${n}m'`, `'${n}h'`, `'${n}d'` strings are returned in English regardless of locale.
**Fix:** Use locale-aware relative time formatting or `t()` with interpolation.

### P2-14 · `shop-card.tsx` — `#b8966a` hardcoded as `shadowColor`
Should be `BRAND.gold` from tokens.

### P2-15 · `[shopId]/index.tsx` — emoji literals instead of Phosphor icons
`'←'` back arrow, `'❤️'`/`'🤍'` save toggle, `'⭐'` rating, `'📞'` phone CTA, `'💬 WhatsApp'` CTA. DESIGN.md mandates Phosphor icons.
**Fix:** Replace with `ArrowLeft`, `Heart`/`HeartStraight`, `Star`, `Phone`, `WhatsappLogo` from `phosphor-react-native`.

### P2-16 · `directory/index.tsx` — emoji literals as UI elements
`'🔍'` search icon, `'✕'` clear button, `'🏪'` empty state icon.
**Fix:** Replace with Phosphor `MagnifyingGlass`, `X`, `Storefront`.

### P2-17 · `${BRAND.gold}22` / `${BRAND.gold}33` — alpha suffix string pattern
Used in `polls/[pollId].tsx` and `elections/[id].tsx` and `dashboard.tsx`. This pattern breaks if the token ever changes format. Use `rgba()` with explicit values or add dedicated alpha tokens.

---

## ✅ P3 — QA / Polish (6) — ALL RESOLVED (commits `ce8c9d3`, `8533842`)

### P3-01 · Zero `accessibilityLabel` / `accessibilityRole` across all screens
Pervasive. Every `Pressable` in every screen lacks accessibility props. Only `ShopCard` (role only, no label) and `CategoryChips` (role + selected state) have partial compliance.
**Fix:** Systematic pass — add `accessibilityRole="button"` and `accessibilityLabel={t('...')}` to all interactive elements.

### P3-02 · `confirmation.tsx` — no Lottie, no haptic
Uses `reanimated` spring animation only. No `lottie-react-native` despite it being installed and referenced in the plan. No `Haptics.notificationAsync(Success)` on mount.
**Fix:** Add Lottie `order-confirmed.json` animation; add success haptic in `useEffect`.

### P3-03 · `payment.tsx` — no haptic on place order
High-value moment. No `Haptics.impactAsync(Medium)` before order placement.

### P3-04 · `cart.tsx` — haptic missing on quantity change and item remove
Only the checkout button has haptics. Quantity increment/decrement and remove-item have none.

### P3-05 · `merchant/dashboard.tsx` — copy-paste route bug
"Shop Profile" quick action navigates to `/(merchant)/menu` — same as the "Menu" card. Should navigate to a shop profile editor.

### P3-06 · `merchant/orders/index.tsx` — filter chips overflow off-screen
`STATUS_FILTERS` chip bar has no horizontal `ScrollView`. With 7 statuses, chips will overflow and be unreachable.
**Fix:** Wrap in `<ScrollView horizontal showsHorizontalScrollIndicator={false}>`.

---

## Fix Plan

### Phase A — P0 (fix now, ~2h)

| # | Task | File |
|---|---|---|
| A1 | Add `SEMANTIC` to import | `profile/index.tsx` |
| A2 | Add `onPress` + `Linking.openURL` to ReportRow | `reports/index.tsx` |
| A3 | Wrap pdfRow in Pressable with onPress | `[announcementId].tsx` |
| A4 | Add `onPress` to WhatsApp CTA | `[shopId]/index.tsx` |
| A5 | Fix `refreshing={false}` → `isRefetching` | `feedback/index.tsx`, `reports/index.tsx` |

### Phase B — P1 (required before launch, ~1–2 days)

| # | Task | File |
|---|---|---|
| B1 | Create `useAuthRehydration.ts` + call in `_layout.tsx` | new file + `_layout.tsx` |
| B2 | Add `requestPermissionsAsync` to push service | `services/push/index.ts` |
| B3 | Remove duplicate local `registerPushToken` | `verify-otp.tsx` |
| B4 | Add `intentFilters` for deep links | `app.config.ts` |
| B5 | Run `eas init`, set `EAS_PROJECT_ID` | `app.config.ts` |
| B6 | Convert polls + elections to `useInfiniteQuery` + FlashList | `governance/index.tsx` |
| B7 | Convert product list to `useInfiniteQuery` + FlashList | `[shopId]/index.tsx` |
| B8 | Implement admin creation screens | `(admin)/announcements/new.tsx` etc. |
| B9 | Wire notification tap routing | `notifications/index.tsx` |

### Phase C — P2 Design + i18n (~1 day)

| # | Task |
|---|---|
| C1 | Import `SEMANTIC` + replace `#B03A2E` in `forgot-password.tsx` |
| C2 | Replace all `'EGP'` with `formatCurrency()` in 4 files |
| C3 | Fix `ann.category` → `t(`community.${ann.category}`)` on home |
| C4 | Add `governance.votes` i18n key; replace hardcoded `"votes"` in 3 files |
| C5 | Add `profile.account` key; fix AccountSection title |
| C6 | Add `common.load_more` key; fix `[announcementId].tsx` |
| C7 | Fix `"Admin"` badge + `'en-GB'` locale in feedback screens |
| C8 | Fix `'en-GB'` locale + `"+"` in `feedback/index.tsx` |
| C9 | i18n all hardcoded strings in merchant screens (12 strings across 4 files) |
| C10 | Fix `"Unit"` spacing bug in merchant order screens |
| C11 | Fix `formatRelativeTime` locale-awareness in notifications |
| C12 | Fix `shadowColor` in `shop-card.tsx` → `BRAND.gold` |
| C13 | Replace emoji literals with Phosphor in `[shopId]/index.tsx` |
| C14 | Replace emoji literals with Phosphor in `directory/index.tsx` |
| C15 | Replace `${BRAND.gold}22` alpha pattern with explicit rgba |

### Phase D — P3 Polish (~half day)

| # | Task |
|---|---|
| D1 | Accessibility pass — all Pressables across all screens |
| D2 | Add Lottie + haptic to `confirmation.tsx` |
| D3 | Add haptic to `payment.tsx` place-order |
| D4 | Add haptics to cart qty/remove |
| D5 | Fix merchant dashboard "Shop Profile" route |
| D6 | Wrap merchant order filter chips in horizontal ScrollView |

---

## Issue Count by Priority

| Priority | Count | Status |
|---|---|---|
| P0 Ship-blockers | 6 | ✅ All resolved — commit `0e2270a` |
| P1 Required features | 9 | ✅ All resolved — commits `bd4f500`, `6962cfc` (P1-05 `eas init` = user action) |
| P2 Design/i18n | 17 | ✅ All resolved — commit `d9546d4` |
| P3 Polish | 6 | ✅ All resolved — commits `ce8c9d3`, `8533842` |
| **Total** | **38** | ✅ **37/38 resolved in code** (1 requires user action: `eas init`) |

---

## Previously Reported Issues Now Resolved ✅

| Issue | Resolution |
|---|---|
| `refreshing={false}` in directory | Fixed → `isRefetching` |
| `refreshing={false}` in orders | Fixed → `isRefetching` |
| `refreshing={false}` in community | Fixed → `isRefetching` |
| CartConflictSheet `conflictingShop` showed wrong shop name | Fixed → uses `pendingShopName` |
| `registerPushToken` duplicated in login.tsx | Fixed → imports from `@/services/push` |
| `formatCurrency` utility missing | Created at `src/lib/formatCurrency.ts` |
| `ErrorState` component missing | Created at `src/components/ui/error-state.tsx` |
| Cart persistence not verified | Verified — correctly persisted via MMKV |
