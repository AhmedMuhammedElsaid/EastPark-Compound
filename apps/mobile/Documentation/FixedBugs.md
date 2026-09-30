# EastPark Frontend — Bug Fix Log

> Recorded after a comprehensive two-pass audit + maintenance pass (April 2026).
> All bugs were fixed in commits on branch `main`.
> Last commits: `0c74e20` through `41cc16e` + F-1 biometric login (this commit).

---

## April 2026 — F-1 Biometric Login (Post-Launch Roadmap → shipped)

**Files added:**
- `src/lib/hooks/use-biometric.ts` — wraps `expo-local-authentication`. Exposes `ready`, `isAvailable`, `kind` (face/fingerprint/iris/generic), `enabled`, `email`, plus `authenticate()`, `enable(email)`, `disable()`, `refresh()`.

**Files changed:**
- `package.json` — added `expo-local-authentication: ~17.0.7`.
- `app.config.ts` — registered `expo-local-authentication` plugin with iOS `faceIDPermission` (NSFaceIDUsageDescription).
- `src/services/api/client.ts` — new SecureStore keys `SECURE_KEY_BIOMETRIC_ENABLED`, `SECURE_KEY_BIOMETRIC_EMAIL`.
- `src/services/api/auth.ts` — added raw-axios `authApi.refresh(refreshToken)` that bypasses the 401 interceptor (used by biometric flow to swap stored refresh token for fresh access token).
- `src/app/(auth)/login.tsx` — when `biometric.enabled && isAvailable`, shows a "Sign in with Face ID/Fingerprint" Pressable above the email/password form. On success: `LocalAuthentication.authenticateAsync` → `authApi.refresh()` → `usersApi.getProfile()` → `dispatch(login(...))` → navigate. On failure (refresh expired/revoked): `biometric.disable()` + warning toast prompting password entry. After a successful **password** login, prompts the user once via `Alert.alert` to enable biometric for next time.
- `src/app/(tabs)/profile/index.tsx` — added `SecuritySection` with a `Switch` toggle (only rendered when hardware available + enrolled). `handleLogout` now branches: when `biometric.enabled`, skips server-side `/auth/logout` and keeps the refresh token in SecureStore so the user can re-auth via biometric. Delete-account flow calls `biometric.disable()` to nuke all biometric state.
- `src/translations/en.json` + `ar.json` — added `auth.biometric.*` (kind labels, prompts, sign-in-with copy, errors), `profile.security`, `profile.biometric_login*`, `profile.biometric_setup_failed`, `common.or`.

**Trade-off documented:** When biometric is on, logout does not call the backend `/auth/logout` (which would revoke the refresh token server-side). The refresh token remains valid until natural expiry. This is an opt-in convenience trade-off — users who don't enable biometric still get full server-side revocation on logout. Disabling biometric or deleting the account fully clears the stored refresh token.

**Why F-10 was deferred:** F-10 (merchant menu categories) was originally chosen but requires backend changes — `Product` entity has no `category` field and there's no category CRUD endpoint. Logged in `FRONTENDENHANCEMENTPLAN.md` Section 4 (B-6) instead.

---

## April 2026 — Jest Fix Pass

Commits: `23a39fe`, `a498a15`

### `immer` / `react-redux` ESM Parse Error in Jest — `commit 23a39fe` + `commit a498a15`
**Files:** `jest.config.js`, `jest-setup.ts`
**Problem:** `input.test.tsx`, `checkbox.test.tsx`, and `select.test.tsx` all failed with `SyntaxError: Unexpected token 'export'` when Jest tried to load `immer/dist/immer.legacy-esm.js` and `react-redux/dist/react-redux.legacy-esm.js`. The root cause: UI components transitively import `@/store` via `src/lib/i18n/utils.tsx` → `src/lib/i18n/index.tsx` → `src/components/ui/text.tsx` → component. Both `@reduxjs/toolkit` and `react-redux` ship ESM-only dist files that Jest's CJS environment cannot parse.
**Fix:**
- `jest.config.js`: Added `immer|@reduxjs/toolkit|redux-persist` to `transformIgnorePatterns` allowlist (partial fix — still failed on `react-redux`).
- `jest-setup.ts`: Added global `jest.mock('@/store', ...)` that provides a minimal in-memory store mock (`store.dispatch`, `store.getState`, `persistor.flush`, `useAppDispatch`, `useAppSelector`). Also mocked `@/store/slices/preferencesSlice` (for `setLanguage`) and `react-native-restart` (native module, unavailable in Jest). This prevents `store/index.ts` from ever being loaded in tests — no ESM chain ever reaches RTK/react-redux.

---

## April 2026 — Review Pass + Static Analysis + TS Fixes

Commits: `296b52f`, `5a66a0c`, `c2c52e6`, `262924c`, `712ef78`, `4fb6d3e`, `1e8a72a`

### Language Switch Race Condition
**File:** `src/lib/i18n/utils.tsx`
**Problem:** `changeLanguage()` dispatched `setLanguageAction` to Redux and immediately called `NativeModules.DevSettings.reload()`. Since redux-persist's AsyncStorage write is async, the reload completed before the new language preference was written to disk. On restart, redux-persist rehydrated the old language value — so clicking English while on Arabic appeared to do nothing.
**Fix:** Made `changeLanguage()` async. Added `await persistor.flush()` before the reload call to force redux-persist to complete its AsyncStorage write. Also removed the unused `AsyncStorage` import and dead `export const LOCAL = 'local'` constant.

### CursorPage API Response Shape Rename
**Files:** `src/services/api/shops.ts` (interface), all API service files, all 15+ screen files
**Problem:** The `CursorPage<T>` interface used `data: T[]` as the array field name, but the backend was updated to use `items: T[]`. This caused the triple-nested `.data.data.data` access pattern which was confusing and no longer matched the backend response shape.
**Fix:**
- Updated `CursorPage<T>` interface: `data: T[]` → `items: T[]`
- Updated all API service return types across 8 files (orders, notifications, merchant, community, governance, admin, shops)
- Updated all screen `flatMap` accessors: `.data.data.data` → `.data.data.items` (15 screen files)
- Updated all `useInfiniteQuery<...>` type generics: `{ data: T[]; nextCursor }` → `{ items: T[]; nextCursor }` (9 files, 18 occurrences)
- Updated `queryClient.getQueryData<...>` type in `[productId].tsx` initialData

### .env API URL Had `/v1` Appended
**File:** `.env`
**Problem:** `EXPO_PUBLIC_API_URL` was changed to `http://localhost:3000/v1`, but the Axios client (`src/services/api/client.ts` line 28) already appends `/v1` via `baseURL: \`${Env.EXPO_PUBLIC_API_URL}/v1\``. This would have made every API request target `/v1/v1/...` and 404.
**Fix:** Reverted to `http://localhost:3000` (no `/v1`).

### FlashList v2 `estimatedItemSize` Removed — `commit 4fb6d3e`
**Files:** 6 files (governance, community, directory, orders, select)
**Problem:** `@shopify/flash-list` v2.0.2 (New Architecture) removed `estimatedItemSize` from `FlashListProps` — item sizes are auto-measured. TS2322 errors on all 8 occurrences.
**Fix:** Removed the prop from all 8 occurrences across 6 files.

### Shop Photo `isPrimary` Field — `commit 1e8a72a`
**Files:** `src/services/api/shops.ts`, `src/components/directory/shop-card.tsx`
**Problem:** `Shop.photos` type was missing `isPrimary: boolean`. Cover photo was selected via `p.order === 0` which didn't match backend behavior.
**Fix:** Added `isPrimary` to the `ShopPhoto` interface. `shop-card.tsx` now uses `p.isPrimary` to find the cover photo.

### TS Type Fixes — `commit 262924c`
**Files:** dashboard, merchant orders, notifications, shop-card, translations
- Dashboard: `count` interpolation key fixed in translation usage
- Merchant orders: `InboxSimple` icon import (was missing/wrong)
- Notifications: `formatRelativeTime` t() callback cast fixed with `String(t(key as any, opts as any))` wrapper
- Translations: count interpolation keys updated in EN + AR

### Static Analysis Fixes — `commit c2c52e6`
- `shop-profile.tsx`: hardcoded `DAY_LABELS` removed — uses `t('merchant.days.{day}')` for RTL-correct Arabic day names
- `register.tsx` + `verify-otp.tsx`: haptics added to Eye toggle and resend Pressable
- `cart.tsx`: Trash icon color `#ffffff` → `LIGHT.bg` token
- `[shopId]/index.tsx`: `any` generics replaced with `AxiosResponse<{ data: CursorPage<Product|Review> }>`
- `en.json` + `ar.json`: `merchant.days.{mon-sun}` keys added

### Jest Setup — `commit 712ef78`
- `jest-setup.ts`: added `@react-native-async-storage/async-storage` mock
- `login-form.test.tsx`: cleaned up empty test suite

### Hardcoded `rgba()` Replaced (uncommitted)
**File:** `src/app/(tabs)/directory/[shopId]/index.tsx`
**Problem:** Two raw `rgba()` calls — `rgba(13,12,11,0.6)` and `rgba(0,0,0,0.2)` — violated token-only color rule.
**Fix:** Replaced with `` `${DARK.bg}99` `` (60% opacity photo overlay) and `` `${DARK.bg}33` `` (20% opacity cart badge). `DARK.bg` is intentionally pinned (not theme-reactive) because these are overlays on photos that need consistent contrast.

### Production `console.log` Guarded (uncommitted)
**File:** `src/components/ui/utils.tsx`
**Problem:** `showError()` had unguarded `console.log(JSON.stringify(error?.response?.data))` that would fire in production builds.
**Fix:** Wrapped with `if (__DEV__)` guard.

### `start:tunnel` Script Added
**File:** `package.json`
Added `start:tunnel` and `prestart:tunnel` scripts for Expo tunnel mode development.

---

## Cannot Fix Without Backend Changes

These are known gaps that require backend work before the frontend feature works end-to-end.

| Issue | Frontend Status | Backend Requirement |
|---|---|---|
| **Delete account self-service** | Frontend calls `DELETE /user` correctly via `usersApi.deleteAccount()` | Backend currently exposes this route as admin-only (`DELETE /admin/user/:id`). Needs a resident self-service `DELETE /user` endpoint |
| **Merchant pending order count** | ~~Dashboard fetches `limit: 5` and shows `.length`~~ → Now shows `5+` when `nextCursor` is truthy (commit `d9fcdf6`). Frontend workaround in place. | For an exact count, add `GET /merchant/orders/count?status=PLACED` or `totalCount` in list response |
| **Notification deep-link data payload** | `_layout.tsx` listener reads `{ type, referenceId }` from notification data (commit `43025a1`) | Backend must include structured `data: { type, referenceId }` in all `sendPushNotification()` calls |
| **Single product fetch** | Edit screen uses `initialData` from list cache (N+1 fixed in prior audit) | For cold-launch efficiency, add `GET /merchant/products/:id` |

---

## April 2026 — Maintenance Pass (Section 1 TD + Section 2 UX)

Commits: `0c74e20`, `bfcdf92`, `fb400e1`, `d9fcdf6`, `43025a1`

### TD-1: `getSavedShops` URL — No Change Needed
Backend confirmed: `UserSavedShopsController` uses `@Controller({ path: '/users/me/saved-shops', version: '1' })`. Frontend `shops.ts` line 73 already uses `/users/me/saved-shops`. Correct.

### TD-2: `use-auth-rehydration.ts` Bare Catch
**File:** `src/lib/hooks/use-auth-rehydration.ts` — `commit 0c74e20`
Replaced empty `catch {}` with a branching catch: 401 → pass through silently (interceptor already cleared tokens); any other error → `console.warn('[auth-rehydration] network error on startup', err)` in `__DEV__` without clearing tokens, so valid credentials survive network outages on cold launch.

### TD-3: `registerPushToken` Silent Catch
**File:** `src/services/push/index.ts` — `commit 0c74e20`
Added `if (__DEV__) console.warn('[push] token registration failed', err)` in catch. Push failures remain non-fatal but now surface during development.

### TD-4: Role Badge in `accept-invitation.tsx` Reads URL Param
**File:** `src/app/(auth)/accept-invitation.tsx` — `commit fb400e1`
Added `confirmedRole` state set from `res.data.data.user.role` in `onSubmit`. Badge now only renders after API responds — reflects what the backend assigned, not the URL claim.

### TD-5: TypeScript `any` in Auth Form Props
**Files:** `login.tsx`, `register.tsx`, `reset-password.tsx`, `accept-invitation.tsx` — `commit fb400e1`
All sub-form components now use `Control<FormData>` and `FieldErrors<FormData>` from `react-hook-form` instead of `any`.

### TD-6: `forgot-password.tsx` No Retry Path
**File:** `src/app/(auth)/forgot-password.tsx` — `commit fb400e1`
Added "Try a different email" pressable on the success card that calls `setSent(false)`, returning to the email input without navigation. Translation key `auth.forgot.tryDifferentEmail` added to EN + AR.

### TD-7: `register.tsx` Generic Server Error Catch
**File:** `src/app/(auth)/register.tsx` — `commit fb400e1`
Replaced single `EMAIL_TAKEN` check with `errorMap` record covering `EMAIL_TAKEN`, `INVALID_PHONE`, `INVALID_UNIT`. Falls back to `common.error`. Added `auth.errors.invalid_unit` translation key (AR + EN). `auth.errors.invalid_phone` already existed — not duplicated.

### TD-8: Profile `useStyles()` Called Per Sub-Component
**File:** `src/app/(tabs)/profile/index.tsx` — `commit bfcdf92`
Found a pre-existing bug: `useStyles()` was calling `useMemo(() => StyleSheet.create(...))` but the `return { styles, colors }` was dead code after it. Fixed by introducing `buildStyles(colors)` as a plain function, with `useStyles()` as the only hook calling `useAppColors()` once. `ProfileScreen` is the sole caller — passes `styles` + `colors` as props to all 7 sub-components.

### TD-9: Merchant Order Status Progression Capped at READY
**File:** `src/app/(merchant)/orders/[orderId].tsx` — `commit d9fcdf6`
Removed `READY → ON_THE_WAY` and `ON_THE_WAY → DELIVERED` from `NEXT_STATUS` map. Merchants now control: `PLACED → CONFIRMED → PREPARING → READY` only. `ON_THE_WAY`/`DELIVERED` are set by delivery/logistics or webhook.

### UX-1: OTP Auto-Submit on 6th Digit
**File:** `src/app/(auth)/verify-otp.tsx` — `commit fb400e1`
`handleVerify(code?: string)` now reads `code ?? otp` to avoid stale-state closure on auto-submit. `OTPTextInput.handleTextChange` calls `setOtp(code)` + `handleVerify(code)` when `code.length === 6`. Manual confirm button still works via `handleVerify()` with no argument.

### UX-2: Merchant Dashboard Pending Count Overflow Indicator
**File:** `src/app/(merchant)/dashboard.tsx` — `commit d9fcdf6`
Added `hasMore = !!ordersData?.data.data.nextCursor` and `displayCount = hasMore ? "5+" : "5"`. Used in banner text and stat card. Translation key `merchant.pending_count_waiting` added.

### UX-3: Haptics on Auth + Profile Interactive Elements
**Files:** all auth screens, `profile/index.tsx` — `commits fb400e1`, `bfcdf92`
`Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)` added to every non-GoldButton `Pressable` that performs navigation or state change. Covered: forgot-password link, sign-up/sign-in links, retry-email pressable, password show/hide toggles, language segment, theme segment, Logout, Delete Account, ProfileRow nav items.

### UX-4: Cart Swipe-to-Delete
**File:** `src/app/checkout/cart.tsx` — `commit 43025a1`
Wrapped `CartItemRow` in `Swipeable` from `react-native-gesture-handler`. Right action: 80px wide, `SEMANTIC.error` background, `Trash` Phosphor icon. On press: `Haptics.impactAsync(ImpactFeedbackStyle.Medium)` + `dispatch(removeItem(item.productId))`.

### UX-5: Contextual Empty States
**Files:** `notifications/index.tsx`, `community/feedback/index.tsx`, `translations/` — `commit 43025a1`
- Notifications: `BellSlash` icon + "You're all caught up" / "No new notifications"
- Feedback: `ChatCircle` icon + "No feedback submitted yet" / "Tap below to share"
- Orders: already used `Package` + correct keys — only translation values updated
- All keys added to `en.json` + `ar.json`

### UX-6: Notification Deep Linking
**File:** `src/app/_layout.tsx` — `commit 43025a1`
Added `Notifications.addNotificationResponseReceivedListener` in root layout. Routes based on `data.type` + `data.referenceId`: `ORDER_UPDATE` → orders/:id, `ANNOUNCEMENT` → community/:id, `FEEDBACK_REPLY` → feedback/:id, `POLL` → polls/:id, `ELECTION` → elections/:id. Subscription cleaned up on unmount.

### UX-8: Merchant Shop Profile Editor
**Files:** `src/app/(merchant)/shop-profile.tsx` (NEW), `src/services/api/merchant.ts`, `dashboard.tsx` — `commit d9fcdf6`
Full RHF + Zod screen: Basic Info (name/nameAr, description/descriptionAr), Contact (phone, WhatsApp), Working Hours (Mon–Sun toggle + HH:MM inputs). Backend note: `PATCH /merchant/shop` does not exist — correctly uses `PATCH /shops/:id` which accepts `MERCHANT` role with ownership enforcement. `merchantApi.updateShop()` added. Dashboard Storefront quick-action card restored. 7 new translation keys in EN + AR.

---

## P0 — Critical Bugs Fixed

### Theme + Language Reactivity (Root Cause)
**Problem:** All screens used `StyleSheet.create({ color: DARK.textColor })` at module level. This captures token values at import time and never updates when the user switches theme or language.

**Fix:**
- Created `src/lib/hooks/use-app-colors.ts` — new reactive hook reading `useUniwind()` and returning the correct DARK or LIGHT token set
- Converted all 49 screens + 10 shared components to `useStyles()` + `useAppColors()` pattern:
  ```typescript
  function useStyles() {
    const colors = useAppColors();
    return React.useMemo(() => StyleSheet.create({ ... }), [colors]);
  }
  ```
- Added `LIGHT.elevated` token to `src/theme/tokens.ts` (was DARK-only)
- Zero static `DARK.*` references remain in screen files

### Language Switching Broken
**Problem:** `useSelectedLanguage()` read language from AsyncStorage via `useEffect` — always returned `undefined` initially, then settled on wrong value. `changeLanguage()` didn't persist to Redux. RTL was applied from device locale on init, overriding the saved preference.

**Fix:**
- `src/lib/i18n/utils.tsx`: `changeLanguage()` now dispatches `setLanguageAction` to Redux; `useSelectedLanguage()` reads `useAppSelector(s => s.preferences.language)` directly
- `src/lib/i18n/index.tsx`: removed incorrect `I18nManager.forceRTL` calls from init (was overriding saved RTL state with device locale)
- `src/app/_layout.tsx`: added `useEffect([savedLanguage])` that applies `i18n.changeLanguage` + `I18nManager` after redux-persist rehydration

### Theme Switching Broken
**Problem:** `useSelectedTheme()` tried to read from AsyncStorage via `useEffect` — suffered same timing issue. `Uniwind.setTheme()` was called but Redux state wasn't updated.

**Fix:**
- `src/lib/hooks/use-selected-theme.tsx`: `persistedTheme` now reads `useAppSelector(s => s.preferences.theme)`; `setSelectedTheme` dispatches to Redux AND calls `Uniwind.setTheme()`

### PersistGate Not Blocking Render
**Problem:** `<PersistGate>` had no `loading` prop, so it rendered children immediately with the initial (empty) Redux state before rehydration completed.

**Fix:** `src/app/_layout.tsx`: `<PersistGate persistor={persistor} loading={null}>` — blocks render until persist rehydrates

### 401 Forced Logout Not Navigating
**Problem:** Axios 401 interceptor dispatched `logout()` but never navigated to login. User stayed on the current screen seeing an infinite error loop.

**Fix:** `src/services/api/client.ts`: catch block now calls `queryClient.clear()` + `dispatch(logout())` + `router.replace('/(auth)/login')`

### Merchant Layout Missing Auth Guard
**Problem:** `(merchant)/_layout.tsx` only checked `role !== 'MERCHANT'` — unauthenticated users (role = undefined) were redirected to `/(tabs)` instead of `/(auth)/login`.

**Fix:** Added `if (!isAuthenticated) return <Redirect href="/(auth)/login" />` before the role check

### Profile Logout Incomplete
**Problem:** `handleLogout` deleted tokens from SecureStore and dispatched Redux `logout()`, but never called `authApi.logout(refreshToken)` (server session remained active) or `queryClient.clear()` (stale data remained in cache) or navigated to login.

**Fix:** `src/app/(tabs)/profile/index.tsx`: `handleLogout` now calls `authApi.logout(refreshToken)` (fire-and-forget) + `queryClient.clear()` + `router.replace('/(auth)/login')`; `deleteAccount.onSuccess` also calls `queryClient.clear()` + `router.replace('/(auth)/login')`; added `onError` handler with flash message

### Stale Query Cache On Login (Cross-User Privacy)
**Problem:** When a different user logged in on the same device, cached data from the previous user (orders, profile, saved shops) was served immediately from persisted AsyncStorage cache.

**Fix:** `src/app/(auth)/login.tsx` + `src/app/(auth)/verify-otp.tsx`: call `queryClient.clear()` before `dispatch(login(...))` to wipe previous user's cache

### AuthUser Type — Non-Optional unitNumber/phone
**Problem:** `AuthUser.unitNumber: string` and `phone: string` were required, but MERCHANT/ADMIN users have no unit number or phone. TypeScript held `undefined` in a field typed as `string`.

**Fix:** `src/store/slices/authSlice.ts`: changed to `unitNumber?: string` and `phone?: string`

---

## P1 — Required Feature Fixes

### Push Token Not Registered After Invitation
**Problem:** `accept-invitation.tsx` dispatched `login()` and navigated but never called `registerPushToken()`. Merchants/admins who onboard via invitation never received push notifications.

**Fix:** Added `await registerPushToken()` before navigation in `onSubmit`

### Password Visibility Toggle Missing
**Problem:** `reset-password.tsx` and `accept-invitation.tsx` had no show/hide toggle on password fields. `login.tsx` and `register.tsx` used emoji (`👁`/`🙈`) instead of Phosphor icons.

**Fix:**
- `reset-password.tsx`: added `showPwd`/`showConfirm` state + `Eye`/`EyeSlash` Phosphor rightSlot
- `accept-invitation.tsx`: same pattern for both password fields
- `login.tsx` + `register.tsx`: replaced emoji with `Eye`/`EyeSlash` from `phosphor-react-native`

### verify-otp.tsx — Missing Email Null Guard + Keyboard Not Dismissed
**Problem:** `email` from `useLocalSearchParams` could be `undefined` if navigated to directly. `handleVerify()` did not dismiss the keyboard before submitting.

**Fix:** Added `useEffect` redirect if `!email`; `handleVerify()` calls `Keyboard.dismiss()` at start

### Auth-Wall Sheet Not Showing Context Message
**Problem:** `showAuthWall({ message })` was dispatched but `AuthWallSheet` never read or displayed `authWallConfig.message`.

**Fix:** `src/components/auth/auth-wall-sheet.tsx`: reads `authWallConfig` from Redux and renders `.message` as subtitle when present; button gap changed to `SPACING.sm` (was too tight at `SPACING.xs`)

### auth-input.tsx Unconditional Right Padding
**Problem:** All `AuthInput` components had 48px right padding even without a `rightSlot`, pushing text unnecessarily left.

**Fix:** `src/components/auth/auth-input.tsx`: `paddingRight` is now conditional: `hasRightSlot ? SPACING['4xl'] : SPACING.base`

### Feedback Query Runs Unauthenticated
**Problem:** `useInfiniteQuery` in feedback/index.tsx ran even for guests, causing 401 errors on mount.

**Fix:** Added `enabled: isAuthenticated` to the query

### Governance Queries Both Running on Mount
**Problem:** Both polls and elections queries fired on mount regardless of which tab was active.

**Fix:** `governance/index.tsx`: `pollsQuery` has `enabled: tab === 'polls'`; `electionsQuery` has `enabled: tab === 'elections'`

### Poll/Election Vote Percentage Wrong
**Problem:** Percentages were calculated using `maxVotes` (max allowed votes) as denominator instead of `totalVotes` (actual cast votes).

**Fix:** Changed denominator to `poll.totalVotes` with `totalVotes > 0` guard. Added `showMessage` toast on successful vote submission.

### Socket.io Cleanup Leak in Order Detail
**Problem:** Socket handler was an anonymous function — `socket.off('order_status_updated', handler)` couldn't remove it. Room was not left on unmount.

**Fix:** `orders/[orderId].tsx`: named `handler` function + `socketRef.off('order_status_updated', handler)` + `leaveOrderRoom(orderId)` in cleanup

### Cart Conflict Sheet Showed Wrong Shop Name
**Problem:** Conflict message said "Your cart has items from [new shop]" — should say "Your cart has items from [existing cart's shop]".

**Fix:** `cart-conflict-sheet.tsx`: `conflictingShop = shopName ?? pendingShopName ?? ''` (existing cart's shop first)

---

## P2 — Design, Quality, and Consistency Fixes

### formatCurrency Not Locale-Aware
**Problem:** Always formatted in `en-US` — Arabic users saw Latin numerals and wrong decimal format.

**Fix:** `src/lib/formatCurrency.ts`: `locale = i18n.language === 'ar' ? 'ar-EG' : 'en-US'`

### Emoji Icons Used Instead of Phosphor
**Problem:** 30+ instances of emoji (`📦`, `🔔`, `✅`, etc.) and unicode arrows (`←`, `›`, `✕`) across screens. Violates design system and RTL rules.

**Fix:** Replaced all with appropriate Phosphor icons (`Package`, `Bell`, `Check`, `ArrowLeft`, `CaretRight`, `X`, etc.) across all affected files

### Raw rgba() Instead of Token + Hex Opacity
**Problem:** Several screens used `rgba(...)` directly, violating the token-only color rule.

**Fix:** Replaced all with token + hex suffix (e.g. `` `${BRAND.gold}22` `` for 13% opacity)

### Merchant Time Formatting Ignores Language
**Problem:** Merchant order screens hardcoded `'en-GB'` locale for time display.

**Fix:** `merchant/orders/index.tsx` + `merchant/orders/[orderId].tsx`: `locale = i18n.language === 'ar' ? 'ar-EG' : 'en-GB'`

### Merchant Mutations Missing onError Handlers
**Problem:** All merchant screen mutations (toggle availability, delete product, save product, update order status, reject order) had no `onError` callback — silent failures.

**Fix:** Added `onError: () => showMessage({ message: t('common.error'), type: 'danger' })` to all merchant mutations

### Edit Product Screen Nav Title Wrong
**Problem:** Edit product screen showed `t('common.save')` as the nav title instead of a descriptive title.

**Fix:** Nav title now uses `isNew ? t('merchant.new_product') : t('merchant.edit_product')`; added `merchant.edit_product` key to both `en.json` and `ar.json`

### Admin Dashboard Missing Quick Actions
**Problem:** Admin dashboard index had no navigation shortcuts.

**Fix:** `(admin)/index.tsx`: added Create Announcement (Megaphone), Create Poll (ChartBar), Create Election (Trophy) quick-action entries

### Merchant Dashboard Broken shop-profile Link
**Problem:** Quick-action "Shop profile" card navigated to `/(merchant)/shop-profile` which doesn't exist — would crash at runtime.

**Fix:** Removed the broken quick-action card from the merchant dashboard

### Paymob Error Doesn't Stop Navigation
**Problem:** If Paymob payment initiation threw, the catch block continued to clear cart and navigate to confirmation — leaving a broken order state.

**Fix:** `checkout/payment.tsx`: catch block now has `return` — on error shows toast and stops execution

### GoldButton Has No Haptics
**Problem:** CLAUDE.md requires haptics on every interactive tap. `GoldButton` (primary CTA used across the entire app) had none.

**Fix:** `src/components/auth/gold-button.tsx`: `onPressIn` calls `Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)`

### Cart Minus Icon Used Hardcoded DARK Token (Regression)
**Problem:** A previous audit pass re-introduced `DARK.textMuted` for the Minus icon color in `cart.tsx` — using a static token instead of the reactive `colors.textMuted`.

**Fix:** `checkout/cart.tsx`: `CartItemRow` now calls `useAppColors()` internally; Minus icon uses `colors.textMuted`; `DARK` removed from import

### profile/index.tsx Had Duplicate Return Statement
**Problem:** The `useStyles()` function in profile screen had both the memoized styles block and a trailing `return { styles, colors }` after the closing of `useMemo`. The code worked by luck (the second return was unreachable inside the function) but was confusing.

**Fix:** Cleaned up the function to have a single clean return

### profile/index.tsx Missing delete_account_error Translation
**Problem:** `deleteAccount.onError` called `t('profile.delete_account_error')` but the key didn't exist in translation files.

**Fix:** Added `profile.delete_account_error` to both `en.json` and `ar.json`

### Orphaned Legacy Auth Utility File
**Problem:** `src/lib/auth/utils.tsx` defined `getToken`/`setToken`/`removeToken` using AsyncStorage. Zero consumers remained — all token management uses `expo-secure-store` via `lib/secure-storage.ts`.

**Fix:** File deleted

---

## Files Changed Summary

| Category | Files |
|---|---|
| NEW | `src/lib/hooks/use-app-colors.ts` |
| DELETED | `src/lib/auth/utils.tsx` |
| Theme/Language | `src/lib/hooks/use-selected-theme.tsx`, `src/lib/i18n/utils.tsx`, `src/lib/i18n/index.tsx`, `src/app/_layout.tsx`, `src/theme/tokens.ts` |
| Auth screens | `src/app/(auth)/login.tsx`, `verify-otp.tsx`, `register.tsx`, `reset-password.tsx`, `accept-invitation.tsx` |
| Auth components | `src/components/auth/auth-wall-sheet.tsx`, `auth-input.tsx`, `gold-button.tsx` |
| Store | `src/store/slices/authSlice.ts` |
| API/Services | `src/services/api/client.ts`, `src/services/push/index.ts` |
| Profile | `src/app/(tabs)/profile/index.tsx` |
| Community | `src/app/(tabs)/community/feedback/index.tsx`, `governance/index.tsx`, `governance/polls/[pollId].tsx`, `governance/elections/[id].tsx` |
| Orders | `src/app/(tabs)/orders/[orderId].tsx` |
| Merchant | `src/app/(merchant)/_layout.tsx`, `dashboard.tsx`, `menu/index.tsx`, `menu/[productId].tsx`, `orders/index.tsx`, `orders/[orderId].tsx` |
| Admin | `src/app/(admin)/index.tsx` |
| Checkout/Cart | `src/app/checkout/cart.tsx`, `payment.tsx` |
| Cart conflict | `src/components/cart/cart-conflict-sheet.tsx` |
| i18n | `src/lib/formatCurrency.ts`, `src/translations/en.json`, `src/translations/ar.json` |
| All 49 screens + 10 components | Converted from static `DARK.*` to `useStyles()` + `useAppColors()` |
