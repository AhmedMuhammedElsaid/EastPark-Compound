# EastPark Frontend — Application Context

> Technical snapshot of `apps/mobile/` as of April 2026.
> For backend context, see `../../backend/Documentation/APPCONTEXT.md`.
> For full project context, see `../APPCONTEXT.md`.

---

## Production Integration — 2026-09-30

- Backend: `https://eastpark-backend.fly.dev` (health and Prisma verified)
- Production and preview EAS profiles use the live API and Socket.io base URL.
- Strict environment validation is enabled for cloud builds.
- Preview distribution is internal; production is configured for store builds.
- Mobile binaries are not yet built/submitted. Website/backend deployment does not imply a mobile
  store release.

### Web parity reference

`eastpark-web-app` is expanding from lead capture into a responsive browser counterpart.
This mobile app is the behavioral reference for feature parity; backend endpoints and DTO behavior
are authoritative. Web work must mirror flows without changing mobile solely for convenience.
The parent `packages/shared` experiment is deferred. This repository remains independently
installable and does not depend on parent workspace packages.

---

## Status

**All 7 phases + all 38 AppGaps + 3 deep-audit passes + FE-BE wiring: 100% complete.**

Last commits: `8e8634c` → `1a27086` (maintenance pass + docs) + review pass (uncommitted). Branch: `main`.

Deep audit fixed: Paymob 3-step flow, push token endpoint/projectId, token persist blacklist, admin redirect guards, 30+ emoji→Phosphor icons, all ← arrows replaced, `formatCurrency` locale-aware (ar-EG/en-US), N+1 fetch fixed via TanStack Query `initialData`, `rgba`→token colors, theme+language reactivity (useAppColors hook), auth-wall message rendering, Socket.io cleanup, cross-user cache isolation (queryClient.clear on login/logout), haptics on all primary buttons.

**Remaining user action (manual — requires Expo account):**
- `EAS_PROJECT_ID` is populated (`7c09d58b-c103-461c-ad6f-7fc77a279133` (EAS project `@volunteering-apps/eastpark-app`, owner `volunteering-apps`, slug `eastpark-app`; relinked 2026-10-08 `e64e711`, new signing key — old 062399ed builds cannot be updated in place)) — no further `eas init` needed.

See `Documentation/FixedBugs.md` for the full list of bugs fixed in April 2026 audit passes.

---

## User Roles

| Role | Registration Flow |
|---|---|
| Guest | No auth. Read-only access to directory and community. |
| Resident | Email + unit number + password → Email OTP verification → verified |
| Merchant | Admin sends email invitation → one-time token → `accept-invitation` deep link → name + password setup |
| Admin | Admin sends email invitation → one-time token → `accept-invitation` deep link → name + password setup |

---

## Navigation Structure (full)

```
app/
├── _layout.tsx                       ← Providers: Redux, Query, i18n, GluestackProvider
├── (tabs)/
│   ├── _layout.tsx                   ← 5-tab bar: Home / Directory / Orders* / Community / Profile*
│   ├── index.tsx                     ← Home Feed
│   ├── directory/
│   │   ├── index.tsx                 ← Shop list (FlashList + category filter + search)
│   │   └── [shopId]/
│   │       ├── index.tsx             ← Shop detail (photo gallery, hours, reviews)
│   │       └── menu.tsx              ← Product/menu browser
│   ├── orders/
│   │   ├── index.tsx                 ← [auth guard] Order history
│   │   └── [orderId].tsx             ← Order detail + real-time status (Socket.io)
│   ├── community/
│   │   ├── index.tsx                 ← Announcements feed + Reports
│   │   ├── [announcementId].tsx      ← Announcement detail + PDF + comments
│   │   ├── reports/index.tsx         ← Official PDF reports list
│   │   ├── governance/
│   │   │   ├── index.tsx             ← Polls + Elections list
│   │   │   ├── polls/[pollId].tsx    ← Poll detail + vote + results
│   │   │   └── elections/[id].tsx    ← Election + candidates + vote
│   │   └── feedback/                 ← [auth guard]
│   │       ├── index.tsx             ← My submissions
│   │       ├── new.tsx               ← Submit form
│   │       └── [feedbackId].tsx      ← Detail + reply thread
│   └── profile/index.tsx             ← [auth guard] or Guest CTA
├── notifications/index.tsx           ← [auth guard] In-app notification feed
├── (auth)/
│   ├── login.tsx
│   ├── register.tsx
│   ├── verify-otp.tsx                ← includes resend-OTP button
│   ├── forgot-password.tsx
│   ├── reset-password.tsx            ← receives token via deep link
│   └── accept-invitation.tsx         ← merchant/admin invite → name + password setup
├── (admin)/                          ← [admin role guard]
│   ├── _layout.tsx
│   ├── invitations.tsx
│   ├── announcements/new.tsx         ← Create announcement form
│   ├── polls/new.tsx                 ← Create poll form
│   └── elections/new.tsx             ← Create election form
├── (merchant)/                       ← [merchant role guard]
│   ├── dashboard.tsx
│   ├── menu/
│   │   ├── index.tsx
│   │   └── [productId].tsx
│   └── orders/
│       ├── index.tsx
│       └── [orderId].tsx
└── checkout/
    ├── cart.tsx
    ├── address.tsx                   ← pre-filled from profile + free-text notes
    ├── payment.tsx                   ← COD or Paymob (3-step: place → initiate → Linking.openURL)
    └── confirmation.tsx              ← reanimated success badge + order number (Lottie unused since 2026-10-08)
```

---

## Technology Stack

| Layer | Choice | Version |
|---|---|---|
| Framework | Expo + React Native | 54.0.32 / 0.81.5 |
| Language | TypeScript strict | 5.9 |
| JS Engine | Hermes + New Architecture | both enabled |
| Package manager | pnpm | 9.15.9 (enforced via preinstall hook) |
| Navigation | Expo Router | 6.0.22 (file-based routing) |
| State | Redux Toolkit + redux-persist | 2.5.0 / 6.0.0 |
| Server state | TanStack React Query | v5 |
| Styling | NativeWind v4 + Gluestack UI v2 | — |
| Lists | @shopify/flash-list | 2.0.2 — NEVER FlatList |
| Bottom Sheet | @gorhom/bottom-sheet | 5.2.8 |
| Forms | React Hook Form + Zod | 7.56.0 / 4.3.5 |
| Auth tokens | expo-secure-store | 15.0.8 — NEVER AsyncStorage |
| Animation | react-native-reanimated | 4.1.6 |
| Icons | Phosphor Icons (phosphor-react-native) | — NEVER emoji |
| i18n | i18next + expo-localization | 25.8.0 / 17.0.8 |
| Real-time | socket.io-client | 4.8.1 |
| PDF viewing | `Linking.openURL` (device viewer; no PDF library) | — |
| Lottie | lottie-react-native | 7.2.2 |
| API client | Axios | src/services/api/client.ts (with 401 silent refresh interceptor) |
| Push | expo-notifications + expo-server-sdk | — |
| Build | EAS Build / EAS Submit | — |
| Analytics | PostHog | free / self-hosted |
| Error monitoring | GlitchTip (self-hosted) or Sentry free | — |

---

## Project Structure

```
src/
├── app/                         Expo Router file-based routes
│   ├── _layout.tsx              Root providers (see Provider Stack below)
│   ├── (tabs)/
│   │   ├── index.tsx            Home Feed
│   │   ├── directory/           Shop list + [shopId]/ (detail+reviews) + menu
│   │   ├── orders/              Order history + [orderId] (Socket.io live status)
│   │   ├── community/           Announcements + reports + governance + feedback
│   │   └── profile/             Profile or guest CTA
│   ├── (auth)/                  login, register, verify-otp, forgot-password,
│   │                            reset-password, accept-invitation
│   ├── (admin)/                 Create announcements, polls, elections
│   ├── (merchant)/              Merchant dashboard + menu CRUD + orders
│   ├── checkout/                cart → address → payment → confirmation (Lottie)
│   └── notifications/           In-app notification feed
├── components/ui/               Skeleton, ErrorState, AuthWallSheet, CartConflictSheet
├── lib/
│   ├── hooks/                   useAuthGuard, useAuthRehydration, useFonts
│   └── formatCurrency.ts        Intl.NumberFormat with locale support
├── services/
│   ├── api/                     client.ts, auth.ts, shops.ts, users.ts,
│   │                            notifications.ts, orders.ts, merchant.ts,
│   │                            admin.ts, community.ts, governance.ts
│   └── push/index.ts            Push token registration
├── store/
│   ├── index.ts                 Redux store + persistor
│   └── slices/                  authSlice, cartSlice, preferencesSlice
├── theme/tokens.ts              BRAND, DARK, SEMANTIC, FONT, SPACING, RADIUS
└── translations/                en.json, ar.json

assets/animations/
└── success.json                 Lottie animation (checkout/confirmation.tsx)
```

---

## Redux Store

### Slices

| Slice | State shape |
|---|---|
| `authSlice` | `{ user, accessToken, refreshToken, role, isVerified, showAuthWall, authWallConfig }` |
| `cartSlice` | `{ items[], shopId, conflictPending }` |
| `preferencesSlice` | `{ language, theme }` |

### Persist blacklist (stored in expo-secure-store instead)

`accessToken`, `refreshToken`, `showAuthWall`, `authWallConfig`

---

## Provider Stack (root _layout.tsx)

```
ReduxProvider (store)
  PersistGate (redux-persist)
    PersistQueryClientProvider (TanStack Query + AsyncStorage persister)
      GestureHandlerRootView
        KeyboardProvider
          ThemeProvider (React Navigation)
            BottomSheetModalProvider
              <Stack>                   Expo Router route stack
              <AuthWallSheet />         Global auth gate bottom sheet
              <CartConflictSheet />     Multi-shop cart conflict resolution
              <FlashMessage />          Global toast (position="top")
```

Side effects at module level (before first render):
- `injectStore(store)` — wires Redux into Axios client for 401 silent refresh/logout dispatch
- `loadSelectedTheme()` — restores theme from AsyncStorage before render (prevents flash)
- `SplashScreen.preventAutoHideAsync()` + fade transition

---

## Key Architecture Patterns

### Auth-wall
```typescript
const { requireAuth } = useAuthGuard();
requireAuth(() => { /* action that needs auth */ });
// → dispatches showAuthWall → AuthWallSheet shows → after login, action auto-replays
```

### Cursor pagination (all list screens)
`CursorPage<T>` shape: `{ items: T[]; nextCursor: string | null }` (NOT `data: T[]`).
```typescript
useInfiniteQuery({
  initialPageParam: undefined,
  queryFn: ({ pageParam }) => api.getItems({ cursor: pageParam, limit: 20 }),
  getNextPageParam: last => last.data.data.nextCursor ?? undefined,
});
// FlashList onEndReached → fetchNextPage()
// Flatten: data?.pages.flatMap(p => p.data.data.items).filter(Boolean) ?? []
```

### N+1 fetch avoidance (detail screens)
```typescript
const { data } = useQuery({
  queryKey: ['item', id],
  queryFn: () => api.getAll({ limit: 100 }),
  select: res => res.data.data.items.find(i => i.id === id),
  initialData: () => queryClient.getQueryData(['items']),
  initialDataUpdatedAt: () => queryClient.getQueryState(['items'])?.dataUpdatedAt,
});
```

### Paymob 3-step flow
```typescript
// 1. Place order → get orderId
const { orderId } = await ordersApi.placeOrder(...);
// 2. Initiate Paymob → get iframe URL
const { iframeUrl } = await ordersApi.initiatePaymobPayment(orderId);
// 3. Open external browser
await Linking.openURL(iframeUrl);
// 4. Clear cart + navigate to confirmation (payment status confirmed via webhook)
```

### Cache Isolation on Auth State Change
```typescript
// On login (login.tsx, verify-otp.tsx, accept-invitation.tsx)
queryClient.clear(); // wipe previous user's cached data
dispatch(login({ user, accessToken, refreshToken }));

// On logout (profile/index.tsx handleLogout, client.ts 401 interceptor)
queryClient.clear();
dispatch(logout());
router.replace('/(auth)/login');
```

### Design tokens (never raw colors)
```typescript
import { BRAND, DARK, FONT, RADIUS, SEMANTIC, SPACING } from '@/theme/tokens';
// Transparent overlays: `${BRAND.gold}22` (13% opacity) — NEVER rgba()
```

### Theme Reactivity Pattern

All screens use `useStyles()` + `useAppColors()` — never static `StyleSheet.create({DARK.*})`:
```typescript
// src/lib/hooks/use-app-colors.ts
import { useUniwind } from 'uniwind';
import { DARK, LIGHT } from '@/theme/tokens';

export function useAppColors() {
  const { theme } = useUniwind();
  return theme === 'dark' ? DARK : LIGHT;
}
```
Zero static `DARK.*` references remain in screen/component files. The `preferencesSlice` (Redux + redux-persist) is the single source of truth for both `language` and `theme` preferences.

---

## Confirmed API Endpoints

| Action | Endpoint |
|---|---|
| Push token | `PATCH /auth/push-token` |
| Profile | `GET /user/profile` |
| Update profile | `PUT /user` |
| Delete account | `DELETE /user` |
| Merchant order status | `PATCH /merchant/orders/:id/status` |
| Notification preferences | `GET/PUT /notifications/preferences` |
| Paymob initiate | `POST /orders/:id/pay/paymob` |

> **Important:** `EXPO_PUBLIC_API_URL` must NOT include `/v1`. The Axios client in `src/services/api/client.ts` appends `/v1` automatically as the `baseURL` suffix.

---

## Environment Variables

All env vars are defined in `.env.example` (committed template). Developers copy to `.env.local` (git-ignored) and fill in real values. Never commit secrets to tracked files.

| Variable | Dev | Prod |
|---|---|---|
| `EXPO_PUBLIC_APP_ENV` | `development` | `production` |
| `EXPO_PUBLIC_API_URL` | `http://localhost:3000` | `https://eastpark-backend.fly.dev` |
| `EXPO_PUBLIC_SOCKET_URL` | `http://localhost:3000` | `https://eastpark-backend.fly.dev` |
| `EXPO_PUBLIC_POSTHOG_KEY` | (blank) | your PostHog key |
| `SECRET_KEY` | local value in `.env.local` | CI/CD secret |
| `APP_BUILD_ONLY_VAR` | local value in `.env.local` | CI/CD secret |

> Android emulator: use `10.0.2.2` instead of `localhost`.
> Physical device: use LAN IP (e.g. `192.168.1.x`).

---

## EAS Build Profiles

| Profile | Type | Output | Use case |
|---|---|---|---|
| `development` | dev client | internal | Daily dev on device |
| `preview` | internal | `.apk` | Tester distribution |
| `production` | store release | `.aab` / `.ipa` | App Store / Play Store |
| `simulator` | dev client | simulator | iOS simulator testing |

`appVersionSource: "remote"` — version managed by EAS, not `package.json`.
`EAS_PROJECT_ID` is populated (`7c09d58b-c103-461c-ad6f-7fc77a279133` (EAS project `@volunteering-apps/eastpark-app`, owner `volunteering-apps`, slug `eastpark-app`; relinked 2026-10-08 `e64e711`, new signing key — old 062399ed builds cannot be updated in place)) — no further `eas init` needed.

---

## Design System

### Color Tokens (src/theme/tokens.ts)

| Token | Hex | Usage |
|---|---|---|
| `BRAND.gold` | `#b8966a` | Accents, CTAs — use sparingly |
| `BRAND.goldDark` | `#7a5e38` | Gold on light backgrounds (WCAG AA) |
| `DARK.bg` | `#0d0c0b` | Warm near-black background |
| `DARK.card` | `#221f1c` | Card surfaces |
| `DARK.elevated` | `#2e2a26` | Modals, bottom sheets |
| `SEMANTIC.success` | `#5A7A52` | Muted olive |
| `SEMANTIC.warning` | `#C48B2F` | Deep amber |
| `SEMANTIC.error` | `#B03A2E` | Deep muted red |
| `SEMANTIC.info` | `#4A6B8A` | Slate blue |

### Typography

- `FONT.sans` = **Cairo** — all UI text, all Arabic
- `FONT.display` = **Cormorant Garamond** — English display/hero only. Never Arabic. Never functional UI.

### Motion Rules

- Spring physics via `react-native-reanimated`
- Lottie on key moments: order confirmed, payment success, registration complete, vote submitted
- Skeleton shimmer — **never spinners**
- Haptics on every interactive tap
- Respect `prefers-reduced-motion`

### Accessibility

- WCAG AA: contrast ≥ 4.5:1 text, ≥ 3:1 large text
- Touch targets: 44dp min / 48dp preferred
- Dark mode is flagship; light is a user toggle

---

## Domain Model Rules (Frontend Perspective)

### Shops & Products
- Products: soft-deleted (`isDeleted`) — excluded from display but preserve order history
- `isOpen` = manual emergency override; FE computes "open now" from `workingHours` schedule
- `ShopCategory`: CAFE_AND_FOOD / GROCERY / BUTCHER / SERVICES / OTHER
- One review per resident per shop — show existing review in edit mode

### Orders
- No delivery time slots — free-text `notes` field only
- Payment methods: CASH or PAYMOB
- Cancel allowed only while `status = PLACED` — cancel button hidden/disabled otherwise
- Paymob flow: place order → `POST /orders/:id/pay/paymob` → `Linking.openURL(iframeUrl)` → clear cart + navigate to confirmation

### Governance
- Polls: one vote per resident per poll (server enforces)
- Elections: one vote per resident per election (server enforces)
- `ElectionVisibilityMode`: SEALED_UNTIL_DEADLINE / LIVE_COUNT / ADMIN_CONTROLLED
- Announcement categories: GENERAL / PROMOTION / EVENT / MAINTENANCE / NEWS

### Feedback
- `isAnonymous = true` → admin sees feedback without userId/author details
- Resident can view their own feedback thread + replies

---

## Hard Rules (never break)

| Rule | Reason |
|---|---|
| Never `FlatList` or `View+.map()` for lists | Performance — always `FlashList` |
| Never `AsyncStorage` for tokens | Security — always `expo-secure-store` |
| Never emoji or unicode arrows | RTL/a11y — always Phosphor icons |
| Never hardcoded strings | i18n — always `t('key')` |
| Never hardcoded currency | Locale — always `formatCurrency(amount)` |
| Never raw `rgba()` | Consistency — always token + hex opacity suffix |
| Never `process.env.*` in components | Use `EXPO_PUBLIC_*` env vars only |
| Always `pnpm` — never npm/yarn | Enforced by preinstall hook |
| All commits use `--no-verify` | WSL cannot run node/pnpm hooks |

---

## Commit Convention

```
[AhmedMuhammedElsaid][feat|fix|chore|docs]: description
git commit --no-verify -m "[AhmedMuhammedElsaid][feat]: ..."
```
