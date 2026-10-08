# EastPark Frontend — Session Context

> Claude Code loads this file automatically when invoked in `apps/mobile/`.
> Root project context: see `/mnt/c/Unite/EastPark-App/CLAUDE.md`.

## Status

### Device audit + fix batches — 2026-10-08

- A72 walks (owner, resident, checkout/order) → findings + per-ID fix commits in `Documentation/ANDROID-UI-AUDIT-2026-10-07.md`
  (AUTH-*, RES-*, MA-*, LTR-*, DEV-*, RW-*). Preview versionCode 7 = `0aab2f5`. EAS project now `@volunteering-apps/eastpark-app`.
- Biometric sign-in is bound to ONE account (`src/lib/biometric-binding.ts`, `src/services/auth/session.ts`:
  `signInWithKeptBiometricSession`, `rehydrateSession`, `signOut` local-teardown-first). Only `completeLogin` writes the
  access token; relaunch restores only an access+refresh pair. Open: refresh in flight during sign-out can re-save a pair (`client.ts` `runTokenRefresh`).
- New: tab label key `profile.tab_label` (حسابي / Profile), Saved shops screen `(tabs)/profile/saved-shops.tsx` + `profile/shop/[shopId].tsx`,
  admin Elections & candidates + native date-time picker (`@react-native-community/datetimepicker@8.4.4`), `useOriginBack`,
  `useDiscardGuard`, `formatNumber`, Hermes plural fallback `src/lib/i18n/plural-rules.ts`, WhatsApp opener `openWhatsAppChat`.
- Rules learned: never put `*.test.tsx` under `src/app/` (bundled as a route → EAS bundle fails); run `npx expo export --platform android`
  before a build (restore the regenerated `uniwind-types.d.ts`); ask the owner before EVERY EAS build.


### Self-registration removed, card payments off — 2026-10-03

- The `(auth)/register` and `(auth)/verify-otp` screens, `authApi.register/verifyOtp/resendOtp`, their
  refresh-exempt paths and the Create Account buttons (login footer, auth-wall sheet) are gone. Login now
  says new residents register their unit on the EastPark website and get an email invitation; a 403
  (unverified) login shows `auth.errors.account_not_activated`.
- `CARD_PAYMENTS_ENABLED = false` in `src/lib/features.ts` hides the Card option on
  `checkout/payment.tsx` (Cash on delivery only). Backend rejects PAYMOB with 409
  `order.error.paymentsDisabled` while payments are disabled.

### Cross-platform parity handoff — 2026-09-30

The deployed `eastpark-web-app` is beginning feature parity with this completed mobile app. Treat this
mobile repository as the behavioral reference for routes, role guards, API use, cart/order rules,
community flows, and Arabic/English UX. Do not modify mobile merely to make web implementation
easier. Backend contracts remain authoritative when code and older docs disagree.

The parent repository has a deferred pnpm workspace experiment and private `packages/shared`
package. This mobile repository remains independently installable and does not consume it. Read
parent `restructure.md` before changing workspace resolution.

> **OTA updates are intentionally not configured.** `expo-updates`, EAS Update channels, and
> `runtimeVersion` are absent (the dangling `updates` block in `app.config.ts` and the `channel`
> fields in `eas.json` were removed). To add OTA later: `pnpm expo install expo-updates`, run
> `eas update:configure` (sets `updates.url` and `runtimeVersion`, e.g. `{ policy: "appVersion" }`),
> add `"channel"` to each `eas.json` build profile, then ship with `eas update --channel <name>`.
> Native builds are required once to embed the new config.

✅ **2026-09-30 production integration update:**

- Backend is live at `https://eastpark-backend.fly.dev`; health and Prisma are verified.
- EAS production and preview profiles now use the live API/socket URLs and strict env validation.
- Preview distribution is `internal`; production remains store distribution.
- `package-lock.json` is removed from this pnpm-only repository.
- Store binaries have not yet been built or submitted; mobile release remains a separate task.

✅ **2026-09-29 pass: 3 commits (`9fef982`, `9743231`, `03d13bd`), tree clean, nothing pushed.**
`pnpm type-check` exit 0 · tests **41/41** · lint 3915 errors → 37 (deferred by choice).

- **Type-checking had NEVER run.** `tsconfig.json:4` set `ignoreDeprecations: "6.0"`, invalid for
  TypeScript 5.9.3, so `tsc` aborted with TS5103 at config parsing before reading a single file —
  every "TS clean" claim in these docs was unfounded. Now `"5.0"`; checks 3280 files, exit 0.
  The code was genuinely clean underneath; the tooling was the bug.
- **Four real bugs** surfaced once lint was readable: `merchant.pending_count_waiting` showed the
  literal `{{n}}` instead of the count (the i18n validator rejects single-char interpolation
  names — use `{{count}}`); `checkbox.tsx` used the nonexistent `bg-primary-300`; a suppressed
  `exhaustive-deps`; dead code in the merchant menu.
- **Kebab-case renames** via `git mv`: `format-currency.ts`, `{auth,cart,preferences}-slice.ts`.
  All 30 importers updated — including the `jest.mock()` path in `jest-setup.ts`, which is
  load-bearing.
- ESLint now ignores `README.md`/`claude.md`/`Documentation/*.md` — it was parsing their code
  fences as standalone TypeScript and inventing ~33 phantom errors.
- `src/theme/tokens.ts` was reformatted to double quotes, so it is **no longer byte-identical** to
  `eastpark-web-app`'s copy. Values are identical — diff values, not bytes. See `../../restructure.md`.

**Open:** store submit configuration/account credentials and the actual EAS build/submit remain.
Full list: `../backend/COMPLETION-ROADMAP.md` Part 3.

Earlier: 2026-07-19 audit gaps addressed 2026-07-26 (FE-1 fixed backend-side, FE-3 tests, FE-6
dead routes removed; FE-2 analytics descoped). See `frontend_review.md`.

✅ All 7 phases + all 38 AppGaps + deep-audit passes + FE-BE wiring + maintenance pass resolved.
Last commits: `3ea3f75` → `a498a15` (maintenance pass + review pass + TS fixes + Jest fix pass). Branch: main.
- Maintenance pass (April 2026): all 9 TD items + 7/9 UX items fixed — commits `0c74e20`–`43025a1`
- Review pass + static analysis + TS fixes — commits `2ab46a8`–`1e8a72a`
- Jest fix pass — commits `23a39fe`, `a498a15` (RTK/react-redux ESM fixed via global store mock)
- `EAS_PROJECT_ID` already populated (`7c09d58b-c103-461c-ad6f-7fc77a279133` (EAS project `@volunteering-apps/eastpark-app`, owner `volunteering-apps`, slug `eastpark-app`; relinked 2026-10-08 `e64e711`, new signing key — old 062399ed builds cannot be updated in place)) — `eas init` is done

### Audit 2026-07-19 → status 2026-07-26 (full detail in `frontend_review.md`)
- **FE-1 ✅ FIXED backend-side:** the backend now exposes a `/merchant/*` controller (`apps/backend/src/modules/merchant/`) that resolves the merchant's shop from the JWT. `src/services/api/merchant.ts` and all `(merchant)` screens work UNCHANGED — do NOT rewrite them to `/shops/:id`. Also solved B-7 (no way to discover own shopId).
- **FE-2 DESCOPED:** Posthog + Sentry/GlitchTip not wired — deferred pending product decision.
- **FE-3 ✅ FIXED:** real login-form tests added (`login-form.test.tsx`, 5 tests) — verified 5/5 passing on Node v24.
- **FE-4 tooling:** WSL default node is v12, but modern Node IS available via nvm (`. ~/.nvm/nvm.sh; nvm use 24`) — use it to run `pnpm test`/`type-check` (slow on the mounted drive, ~15min for a test file).
- **FE-6 ✅ FIXED:** removed dead obytes stubs (`app/login.tsx`, `app/onboarding.tsx`, `app/[...messing].tsx`); added `app/+not-found.tsx` (token/i18n-compliant).
- **FE-5:** whitespace-only working-tree drift (`.env.example`, `eslint.config.mjs`, `use-biometric.ts`) still uncommitted — harmless CRLF churn.

### Mobile backlog batch — 2026-10-03

- **Cart is session-scoped:** `cart-slice` handles `auth/logout` (reset to initial state) and `auth/login`
  (`ownerId`; a different account signing in empties it, a guest cart is kept). All forced sign-outs go
  through `teardownSession` -> `logout`, so they are covered.
- **Form validation messages are translation keys** (`validation.*` in ar/en), rendered with
  `t(errors.x.message as any)`; admin announcement/poll/election forms now show them under the field,
  merchant product/shop forms use the same keys. Invalid working hours show a toast.
- **Order detail polling** (`getOrderPollInterval` in `services/api/orders.ts`): off while the orders socket
  is connected and for DELIVERED/CANCELLED; 15 s fallback only when the socket is down; one refetch on reconnect.
- Comment send icon mirrors in RTL and has `community.send_comment` label; PDF links use
  `openDocument()` (`lib/utils.ts`) with a `community.pdf_open_failed` toast; merchant shop profile sends
  `null` for cleared description/phone/whatsapp (`toNullable`; backend `@IsOptional` accepts null).

### Mobile review pass — 2026-10-03 (after web/backend went live; new EAS build pending)

- **Offline query cache never stores Axios metadata.** Query functions return whole `AxiosResponse`
  objects; `serializePersistedClient` now keeps only `{ data, status }` per response (the request
  `config` carried `Authorization: Bearer <accessToken>` and the native XHR) and drops cycles. The
  cache buster moved to `-public-3`, so caches written by older builds are discarded.
- Restored `polls`/`poll`/`elections`/`election` queries (vote fields redacted to null) are
  invalidated right after restore (`invalidateRedactedQueries`, `PersistQueryClientProvider onSuccess`).
- **Logout revokes server-side even after the 15-min access token expired:** `revokeRefreshToken()`
  (`src/services/api/auth.ts`) calls `/auth/logout`; on 401 it rotates once (raw refresh, no
  session-expiry side effects) and revokes the NEW refresh token. Biometric logout still keeps the
  refresh token locally and skips revocation by design.
- Cold start: persisted `isAuthenticated` with no SecureStore tokens now dispatches `logout()`.
- **Error states:** detail screens render `DetailErrorScreen` (back button + retry) when the query
  failed before any data; list screens render `ErrorState` instead of the empty state. Pattern:
  `if (isError && !data) return <DetailErrorScreen onRetry={() => refetch()} />` before the
  skeleton guard.
- **RTL:** directional icons (`ArrowLeft` back buttons, `CaretRight` row chevrons) pass
  `mirrored={I18nManager.isRTL}` — Phosphor does not mirror on its own.
- Remote images use `expo-image` (`contentFit`, `recyclingKey` in FlashList rows), not RN `Image`.
- Shop detail reads the resident's saved shop ids (`["saved-shop-ids"]`, `GET /users/me/saved-shops`)
  for the heart; the heart is hidden for merchants/admins (saving is RESIDENT-only).
- Merchant product mutations call `invalidateProductQueries()` (list, single-product editor,
  public `shop-products`). Shop profile saves through `PATCH /merchant/shop`.

### Backend-contract review pass — 2026-10-02

- **Reset-password and accept-invitation complete on the WEB app.** Backend emails link to
  `${WEB_APP_URL}/auth/reset-password?token=` and `/auth/accept-invitation?token=` (https). Mobile only
  registers the `eastpark://` scheme and has no universal/app links (they need hosted
  `apple-app-site-association` / `assetlinks.json`), so those links open
  `eastpark-web-app` (`apps/web/src/app/auth/{reset-password,accept-invitation}` → BFF
  `/api/auth/*`). The mobile screens remain for `eastpark://` deep links only.
- Auth: refresh sends `Authorization: Bearer <refreshToken>` (+ body); logout sends the ACCESS token as Bearer plus `{ refreshToken }` in the body. The 401 interceptor
  skips public `/auth/*` routes and guest requests, and only ends the session when `/auth/refresh`
  answers 401/403 (`setSessionExpiredHandler` → `teardownSession`). All logins go through
  `completeLogin()` (`src/services/auth/session.ts`): role routing + auth-wall replay via
  `auth.pendingRedirect`.
- Socket `/orders`: `order:join`/`order:leave` with the bare orderId; listen `order:status_update`;
  15 s `refetchInterval` fallback on active orders.
- Query cache persistence is limited to public keys (`PERSISTED_QUERY_ROOTS`) with a version buster.
- Push taps route via `getNotificationHref()` (`src/services/notifications/routing.ts`); the backend
  sends `{ orderId, status }` without `type`/`referenceId`, so the type is inferred from the id key.

## User Roles

| Role | Registration Flow |
|---|---|
| Guest | No auth. Read-only: directory, announcements, governance. |
| Resident | Unit-registration lead (web `/register-unit`) → admin approval → invitation email → `accept-invitation` |
| Merchant | Admin email invitation → one-time token → `accept-invitation` deep link → name + password |
| Admin | Admin email invitation → one-time token → `accept-invitation` deep link → name + password |

## Stack (locked — do not change)

| Layer | Choice |
|---|---|
| Framework | Expo SDK 54 + React Native 0.81.5, Hermes + New Architecture |
| Language | TypeScript strict |
| Navigation | Expo Router 6 (file-based routing) |
| State | Redux Toolkit + redux-persist (NOT Zustand) |
| Server state | TanStack React Query v5 |
| Forms | React Hook Form + Zod (NOT TanStack Form) |
| Auth tokens | expo-secure-store (NOT AsyncStorage) |
| Lists | @shopify/flash-list — NEVER FlatList, NEVER View+.map() for lists |
| Styling | uniwind + `StyleSheet.create` (theme preference in AsyncStorage) |
| Icons | Phosphor Icons — NEVER emoji, NEVER unicode arrows/chevrons |
| i18n | expo-localization + i18n-js — AR RTL primary, EN LTR secondary |
| Animation | react-native-reanimated + lottie-react-native |
| Bottom Sheet | @gorhom/bottom-sheet |
| API client | Axios (src/services/api/client.ts) with 401 silent refresh queue interceptor |
| Push | expo-notifications + Expo Push Service |
| Real-time | socket.io-client |
| Build | EAS Build/Submit |

## Project Structure (actual)

```
src/
├── app/                         # Expo Router routes — all screens live here
│   ├── _layout.tsx              # Root providers: Redux, Query, i18n, Gluestack, PersistGate
│   ├── (tabs)/
│   │   ├── index.tsx            # Home feed
│   │   ├── directory/           # Shop list + [shopId]/ (detail+reviews) + menu
│   │   ├── orders/              # Order history + [orderId] detail (Socket.io live status)
│   │   ├── community/           # Announcements + reports + governance + feedback
│   │   └── profile/             # Profile or guest CTA
│   ├── (auth)/                  # login, forgot-password, reset-password, accept-invitation
│   ├── (admin)/                 # Admin dashboard + invitations management
│   ├── (merchant)/              # Merchant dashboard + menu CRUD + orders + shop-profile
│   ├── checkout/                # cart, address, payment, confirmation (reanimated success badge + order number)
│   └── notifications/           # In-app notification feed
├── components/ui/               # Skeleton, ErrorState, AuthWallSheet, CartConflictSheet
├── lib/
│   ├── hooks/                   # useAuthGuard, useAuthRehydration, useFonts
│   └── formatCurrency.ts        # Intl.NumberFormat with locale support
├── services/
│   ├── api/                     # client.ts, auth.ts, shops.ts, users.ts, notifications.ts, orders.ts, merchant.ts, admin.ts, community.ts, governance.ts
│   └── push/index.ts            # Push token registration (requestPermissionsAsync + getExpoPushTokenAsync + projectId)
├── store/
│   ├── index.ts                 # Redux store + persistor (blacklist: accessToken, refreshToken, showAuthWall, authWallConfig)
│   └── slices/                  # authSlice, cartSlice, preferencesSlice
├── theme/tokens.ts              # BRAND, DARK, SEMANTIC, FONT, SPACING, RADIUS
└── translations/                # en.json, ar.json — all UI strings, no hardcoded text ever
assets/animations/               # success.json (Lottie — UNUSED since RW-11 2026-10-08; confirmation uses a reanimated badge)
```

## Key Patterns

**No hardcoded strings.** Always `t('key')` via `useTranslation()`.

**No hardcoded currency.** Always `formatCurrency(amount)` — never `EGP ${price}` or `amount.toFixed(2)`.

**Design tokens only.** Import from `@/theme/tokens`:
- Colors: `BRAND.gold` (#b8966a), `DARK.bg` (#0d0c0b), `DARK.card` (#221f1c), `DARK.elevated` (#2e2a26), `DARK.text`, `DARK.textMuted`, `DARK.border`
- Semantic: `SEMANTIC.success`, `SEMANTIC.warning`, `SEMANTIC.error`, `SEMANTIC.info`
- `FONT.sans` (Cairo), `FONT.display` (Cormorant Garamond — display English only, never Arabic)
- `SPACING.xs/sm/md/base/lg/xl/2xl/3xl`, `RADIUS.sm/md/lg/full`
- Transparent overlays: use token + hex suffix (e.g. `` `${BRAND.gold}22` `` = 13% opacity) — NEVER raw `rgba()`

**Icons.** Always Phosphor (`phosphor-react-native`). NEVER:
- Emoji literals (`🔔`, `📦`, `✏️`, etc.)
- Unicode arrows/chevrons (`←`, `→`, `›`, `‹`, `✕`)
- Use: `ArrowLeft`, `ArrowRight`, `CaretRight`, `CaretLeft`, `X`, `Plus`, `Trash`, `Bell`, `Package`, etc.

**Auth-wall.** Guest action → `requireAuth(() => { ... })` from `useAuthGuard()` hook → dispatches `showAuthWall` with the current route → `<AuthWallSheet />` shows → after login `completeLogin()` returns the user to that route (`auth.pendingRedirect`).

**Cursor pagination.** All list screens use `CursorPage<T>` shape: `{ items: T[]; nextCursor: string | null }` (NOT `data: T[]`):
```typescript
useInfiniteQuery({
  initialPageParam: undefined,
  queryFn: ({ pageParam }) => api.getItems({ cursor: pageParam, limit: 20 }),
  getNextPageParam: last => last.data.data.nextCursor ?? undefined,
});
// FlashList onEndReached → fetchNextPage()
// Flatten: data?.pages.flatMap(p => p.data.data.items).filter(Boolean) ?? []
```

**N+1 fetch avoidance.** When a detail screen can reuse the list cache, use `initialData` + `initialDataUpdatedAt`:
```typescript
const { data } = useQuery({
  queryKey: ['item', id],
  queryFn: () => api.getAll({ limit: 100 }),
  select: res => res.data.data.items.find(i => i.id === id),
  initialData: () => queryClient.getQueryData(['items']),
  initialDataUpdatedAt: () => queryClient.getQueryState(['items'])?.dataUpdatedAt,
});
```

**After login:** Always `await authApi.updatePushToken(token)` → `PATCH /auth/push-token` (NOT `/users/me/push-token`).

**Push token registration:** Use `Constants.expoConfig?.extra?.eas?.projectId` in `getExpoPushTokenAsync({ projectId })`.

**Token storage:** expo-secure-store only (SECURE_KEY_ACCESS / SECURE_KEY_REFRESH). Blacklisted from redux-persist: `accessToken`, `refreshToken`, `showAuthWall`, `authWallConfig`.

**RTL:** `I18nManager.forceRTL(true/false)` on language switch + restart prompt. `changeLanguage()` is async — calls `await persistor.flush()` before reload to prevent race condition where the reload completes before redux-persist writes the new language to disk.

**Motion:** Spring physics via reanimated. Lottie on key moments (order confirmed, payment success). Skeleton shimmer (never spinners). Haptics on every interactive tap — `GoldButton` has haptics built-in, never double-add.

**useStyles() canonical pattern:**
```typescript
// Pure function — no hooks
function buildStyles(colors: ReturnType<typeof useAppColors>) {
  return StyleSheet.create({ ... });
}
// Only hook — call once at top-level component, pass styles+colors as props to sub-components
function useStyles() {
  const colors = useAppColors();
  return React.useMemo(() => ({ styles: buildStyles(colors), colors }), [colors]);
}
```
See `profile/index.tsx` as the reference. Never call `useStyles()` in sub-components — pass `styles`/`colors` as props.

**Swipeable cart rows:** `Swipeable` from `react-native-gesture-handler` wraps `CartItemRow`. Right action: `SEMANTIC.error` background + `Trash` Phosphor icon + `Haptics.ImpactFeedbackStyle.Medium`.

**Notification deep linking:** `_layout.tsx` routes push taps through `getNotificationHref(type, data)`; it accepts `{ type, <entity>Id }`, `referenceId`, or an id key alone.

**Merchant order status:** one step forward at a time through the full chain `PLACED → CONFIRMED → PREPARING → READY → ON_THE_WAY → DELIVERED`, plus `CANCELLED` from any non-terminal unpaid state (`src/services/orders/status-transitions.ts` mirrors the backend state machine).

**Paymob flow (3 steps):**
1. `ordersApi.placeOrder(...)` → returns `orderId`
2. `ordersApi.initiatePaymobPayment(orderId)` → returns `iframeUrl`  (endpoint: `POST /orders/:id/pay/paymob`)
3. `Linking.openURL(iframeUrl)` — opens external browser
4. Clear cart + navigate to confirmation regardless (actual payment status confirmed via webhook)

**API service URL conventions (confirmed against backend):**
- Profile: `GET /user/profile`, update: `PUT /user`, delete: `DELETE /user`
- Push token: `PATCH /auth/push-token`
- Merchant order status: `PATCH /merchant/orders/:id/status`
- Notification prefs: `GET /notifications/preferences`, update: `PUT /notifications/preferences/:type`
- Paymob: `POST /orders/:id/pay/paymob`

## Design System (locked — never re-debate)

Full reference: `Documentation/DESIGN.md` (in this directory). Core rules:

| Token | Value | Rule |
|---|---|---|
| Primary gold | `#b8966a` | From logo. Use sparingly |
| Gold on light bg | `#7a5e38` | gold-500 fails WCAG AA on light — always use gold-700 |
| Dark bg | `#0d0c0b` | Warm near-black. Never pure #000 |
| Dark card | `#221f1c` | — |
| Dark elevated | `#2e2a26` | Modals, sheets |
| Light surface | `#faf8f5` | Warm off-white. Never cold zinc |
| Success | `#5A7A52` | Muted olive — not bright green |
| Warning | `#C48B2F` | Deep amber |
| Error | `#B03A2E` | Deep muted red |
| Info | `#4A6B8A` | Slate blue — informational banners |

- **Fonts:** Cairo (all UI + all Arabic) · Cormorant Garamond (English display/hero only — never functional UI, never Arabic)
- **Dark mode is flagship** — light is a user toggle preference
- **Motion:** Rich and delightful — spring physics, Lottie on key moments (order placed, vote submitted, payment success, registration complete), skeleton shimmer (never spinners), haptics on every tap, respect `prefers-reduced-motion`
- **Accessibility:** WCAG AA — contrast ≥ 4.5:1 text, ≥ 3:1 large text. Touch targets 44dp min / 48dp preferred
- **Never:** pure #000/#fff surfaces · cold zinc grays · emerald green · neon colors · spinners

## Impeccable Skill Pack

21 design commands installed at project level.
- Source: `.agents/skills/` · Claude Code: `.claude/skills/`

**Per-screen workflow:** `/arrange → /typeset → /colorize → /critique → /polish`
**Before any PR:** `/audit → /harden → /clarify`
**Post-module:** `/normalize → /extract → /adapt`
**Pre-launch:** `/delight → /overdrive → /polish`

## FE Delivery Milestones (completed)

1. ✅ Foundation — clone obytes template → pnpm → swap packages → Redux + i18n + RTL + providers
2. ✅ Auth & Core Shell — register → OTP → login → JWT → auth-wall → tab nav → push token
3. ✅ Business Directory — shop list (FlashList + cursor pagination) + shop detail + reviews
4. ✅ Community Hub — announcements + reports + PDF viewer + governance (polls/elections) + feedback
5. ✅ Ordering — cart → checkout (COD + Paymob) → real-time tracking (Socket.io) + cancel
6. ✅ Merchant Tools — merchant dashboard + menu CRUD + order management
7. ✅ Polish & Launch prep — RTL QA + Lottie animations + EAS build config

## Commit Convention

Format: `[AhmedMuhammedElsaid][feat|fix|chore|docs]: description`
Always `--no-verify` (WSL cannot run node/pnpm hooks). Branch: main.

## Env Vars

Env template: `.env.example` (committed). Local overrides: `.env.local` (git-ignored).
Never commit real secrets to tracked files — use `.env.local` or CI/CD secrets.

```
EXPO_PUBLIC_API_URL=http://localhost:3000        # dev — NO /v1, Axios client appends it
EXPO_PUBLIC_API_URL=https://eastpark-backend.fly.dev  # prod — NO /v1
EXPO_PUBLIC_SOCKET_URL=http://localhost:3000    # dev — no /v1, Socket.io uses root
```

## Commands

```bash
pnpm start              # Start dev server
pnpm ios / pnpm android # Run on platform
pnpm lint               # ESLint
pnpm type-check         # TypeScript
pnpm test               # Jest
pnpm build:production:ios   # EAS production iOS
```

## Known Environment Notes

- All commits use `--no-verify` — WSL cannot run node/pnpm, pre-commit hook always fails
- `EAS_PROJECT_ID` is already populated (`7c09d58b-c103-461c-ad6f-7fc77a279133` (EAS project `@volunteering-apps/eastpark-app`, owner `volunteering-apps`, slug `eastpark-app`; relinked 2026-10-08 `e64e711`, new signing key — old 062399ed builds cannot be updated in place)) — `eas init` is done
- `apps/mobile/` is its own git repo — commits must be made from inside this directory
- `deleteAccount` (`DELETE /user`): the backend self-delete endpoint exists and is used by Profile.
- Shop profile editor uses `PATCH /merchant/shop` (shop resolved from the JWT); `PATCH /shops/:id` also accepts MERCHANT for its own shop.
- **Jest mocking:** `@reduxjs/toolkit` and `react-redux` ship ESM-only builds that Jest cannot parse. `jest-setup.ts` globally mocks `@/store` (minimal dispatch/getState/persistor/useAppDispatch/useAppSelector), `@/store/slices/preferencesSlice`, and `react-native-restart` to prevent the ESM chain from ever loading. `jest.config.js` `transformIgnorePatterns` also includes `immer|@reduxjs/toolkit|redux-persist`. Do NOT remove these mocks.

## Maintenance Pass — What Was Fixed (April 2026)

All 9 TD + 7/9 UX items from `FRONTENDENHANCEMENTPLAN.md`. Full detail in `Documentation/FixedBugs.md`.
Commits: `0c74e20`, `bfcdf92`, `fb400e1`, `d9fcdf6`, `43025a1`.

Key fixes: auth TS types, role badge from API response, forgot-pw retry, OTP auto-submit, haptics everywhere, profile useStyles dead-code bug, merchant status cap at READY, pending count 5+ overflow, merchant shop-profile.tsx (new), cart swipe-to-delete, contextual empty states, notification deep linking.

Remaining open: UX-7 (image upload), UX-9 (reorder) — both post-launch. B-1/2/3/5 blocked on backend.

---

## Deep Audit — What Was Fixed (reference)

All issues discovered across 3 audit passes on 2026-04-01:

### P0 — Ship-blockers (all fixed)
- `initiatePaymobPayment` URL: `/orders/:id/pay` → `/orders/:id/pay/paymob`
- `merchantApi.updateOrderStatus` URL: `/orders/:id/status` → `/merchant/orders/:id/status`
- Push token endpoint: `/users/me/push-token` → `/auth/push-token`
- Push token missing `projectId` in `getExpoPushTokenAsync()`
- `accessToken`/`refreshToken` persisted via redux-persist — blacklisted from persist (tokens live only in expo-secure-store)
- `payment.tsx` placed order but never called `initiatePaymobPayment` — full 3-step flow added
- `accept-invitation.tsx` sent ADMIN to `/(tabs)` — fixed to `/(admin)`
- `(admin)/_layout.tsx` sent unauthenticated to `/(tabs)` — fixed to `/(auth)/login`

### P1 — Required features (all fixed)
- `formatRelativeTime` in notifications used hardcoded Arabic — i18n'd with `t()` + 4 new translation keys
- Notifications FlashList missing `onRefresh`/`refreshing`
- Hardcoded `EGP X` in 3 screens — replaced with `formatCurrency()`
- `users.ts` had duplicate/wrong notification preference methods pointing to wrong URLs

### P2 — Design & quality (all fixed — 29+ files)
- `error-state.tsx` had 3 hardcoded English strings
- `formatCurrency.ts` used string concat — upgraded to `Intl.NumberFormat`
- Emoji icons replaced with Phosphor across all screens (30+ instances)
- Raw `←` / `›` / `✕` text arrows replaced with ArrowLeft/CaretRight/X from Phosphor
- Hardcoded `rgba(...)` colors replaced with token + hex opacity suffix
- `[shopId]/index.tsx` MenuTabContent: `View+.map()` → FlashList
- Reviews: `useQuery` capped at 20 → `useInfiniteQuery` + FlashList
- Merchant `[productId].tsx`: N+1 fetch (load all 100 to find 1) → `initialData` from list cache
