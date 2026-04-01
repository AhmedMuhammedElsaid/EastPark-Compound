# EastPark App — Frontend Plan

## Free Stack Commitment

Every technology in this plan is either **open-source**, **self-hostable**, or on a **permanent free tier**. No paid subscriptions are required to build, run, or launch this app.

| Category | Free Choice |
|---|---|
| Mobile Framework | Expo + React Native (open-source) |
| Push Notifications | Expo Push + FCM + APNs (free) |
| Analytics | Posthog (free tier / self-hosted) |
| Error Monitoring | GlitchTip self-hosted or Sentry free tier |
| Payment | Cash on Delivery (free) + Paymob (no platform fee) |

> Backend infrastructure (NestJS, Neon, Upstash, Supabase Storage, Fly.io, Brevo) is documented in **BackendPlan.md**.

---

## App Identity

| | |
|---|---|
| **App Name** | EastPark App |
| **Concept** | Residential compound super-app: local marketplace + community governance hub |
| **Target Users** | Compound residents, visiting guests, shop owners, compound management company |
| **Languages** | Arabic (RTL primary) + English (LTR), switchable in-app |
| **Auth Model** | Guest-read-only by default; auth-wall bottom sheet on any write/interactive action |

---

## Tech Stack

| Layer | Tech | Version |
|-------|------|---------|
| Framework | Expo | 54.0.33 |
| Runtime | React Native | 0.81.5 |
| React | React | 19.1.0 |
| JS Engine | Hermes | Enabled |
| Architecture | New Architecture | Enabled |
| TypeScript | TypeScript strict | 5.9.2 |
| State | Redux Toolkit + redux-persist | 2.5.0 / 6.0.0 |
| Server State | TanStack React Query | 5.60.0 |
| Navigation | Expo Router + React Navigation | 6.0.23 / 7.0.0 |
| Forms | React Hook Form + Zod | 7.72.0 / 3.25.76 |
| Auth | expo-auth-session + expo-secure-store | 7.0.10 / 15.0.8 |
| Animation | react-native-reanimated | 4.1.1 |
| UI Components | Gluestack UI v2 (NativeWind-compatible primitives) | latest |
| Bottom Sheet | @gorhom/bottom-sheet | latest |
| Carousel | react-native-reanimated-carousel | latest |
| Lottie | lottie-react-native | latest |
| Testing | Jest + React Native Testing Library | 29.7.0 / 12.8.0 |
| Build | Local CI builds (Gradle/Xcode) + EAS Build/Submit | eas.json |

---

## User Roles

| Role | How they get in | Capabilities |
|---|---|---|
| **Guest** | No auth required | Browse directory, read announcements & reports, view poll results |
| **Resident** | Email + Phone + unit number + Email OTP | Full ordering, voting, elections, submitting feedback, comments |
| **Merchant** | Admin invitation | Manage own shop profile, menu, incoming orders |
| **Compound Admin** | Admin invitation | Post announcements, create polls/elections, view all feedback, manage merchants |

---

## Feature Modules

### Module 1 — Auth & Onboarding

- Default guest session with local state (no token)
- Auth-wall bottom sheet (Reanimated 4 swipe-up sheet) triggered on any restricted action — shows Login / Register / Continue as Guest
- Register flow: Name → Email → Phone → Unit Number → Password → Email OTP → Resident status auto-granted
- Login: Email + Password (no passwordless — password is always set during registration)
- Forgot password: email input → reset link → reset password screen
- Resend OTP: button on verify-otp screen → new code sent, old invalidated
- Merchant/Admin onboarding: invitation deep-link → `accept-invitation` screen → sets name + password → guided setup
- Token storage: `expo-secure-store` (access + refresh JWT — never AsyncStorage)
- Persisted auth state: `redux-persist`
- After login: immediately `PATCH /users/me/push-token` with current Expo push token

### Module 2 — Home Feed

- Hero carousel (promotions, urgent announcements)
- Quick-action grid: Shops, My Orders, Vote Now, Reports, Feedback
- "What's new" ribbon from compound company
- Personalized "Your recent shops" row (residents)
- Push notification permission request (soft prompt, first meaningful action)

### Module 3 — Business Directory

- Category filter bar: All / Café & Food / Grocery / Butcher / Services / Other
- Shop cards: cover photo, name, category badge, star rating, open/closed status, delivery time
- Shop detail page: photo gallery, working hours, location pin (compound SVG map or Google Maps), WhatsApp/phone CTA, full menu/product listing, reviews
- Search with debounce + recent searches
- Favourite shops (auth required, synced to server)
- Star rating + text review submission (auth required)

### Module 4 — Ordering (full e-commerce flow)

- Product/menu browser per shop → item detail modal → add to cart
- Cart: persisted via `redux-persist`, multi-shop conflict guard
- Checkout: delivery unit address (pre-filled from profile) + optional free-text notes (no time slots — removed)
- Payment: **Cash on Delivery** (primary, zero fees) + Paymob card/wallet (standard transaction % only)
- Order confirmation + real-time status tracking (Socket.io)
  - Status states: Placed → Confirmed → Preparing → Ready / On the Way → Delivered
- Resident can cancel order only while status = Placed (cancel button hidden after)
- Order history with reorder shortcut
- Merchant side: receive orders in real-time, update status, push notification on new order

### Module 5 — Community Hub (Company → Residents)

- Paginated announcements feed (news, maintenance notices, events)
- Announcement detail with optional PDF attachment (react-native-pdf or WebView PDF)
- Official Reports section: monthly/quarterly compound reports (PDF list)
- Events calendar view
- Comments on announcements (auth required)
- Category-based push notification opt-in per user

### Module 6 — Governance (Votes, Polls, Elections)

- Active Polls list (guest: view results only; resident: vote once)
- Poll detail: question, options with percentage bars (after voting), countdown timer, total participants
- Elections module:
  - Candidates list with names, photos, statements
  - One-time vote per verified resident
  - Results published after deadline (live count or sealed)
- History of past polls/elections with archived results
- Admin creates and publishes via in-app admin tooling

### Module 7 — Feedback & Complaints

- Multi-category submission form (Maintenance, Security, Cleanliness, Noise, Suggestion, Other)
- Optional: photo/video attachments (up to 3 files)
- Compound company replies (thread view)
- Status timeline: Submitted → Acknowledged → In Progress → Resolved
- My Submissions list with filter by status
- Anonymous submission option (no user detail shown to admin)

### Module 8 — Profile & Settings

- Personal info: name, phone, unit number, profile photo
- Language toggle (AR ↔ EN) with instant RTL/LTR flip
- Theme: Light / Dark / System
- Notification preferences per category (toggle per module)
- My Orders, My Saved Shops, My Feedback
- Merchant: "Manage my shop" entry point
- Logout + **Delete Account** — confirmation bottom sheet: "This will permanently delete your account and all data. This cannot be undone." → [Cancel] / [Delete Account] (red destructive)
  → `DELETE /users/me` → clear `expo-secure-store` → `dispatch(logout())` → navigate to `/(auth)/login`

---

## Navigation Architecture (Expo Router — file-based)

```
app/
├── _layout.tsx                      ← Root layout, Providers (Redux, Query, i18n, GluestackProvider)
├── (tabs)/
│   ├── _layout.tsx                  ← Bottom tab bar: Home / Directory / Orders* / Community / Profile*
│   ├── index.tsx                    ← Home Feed (hero carousel, quick actions, recent shops)
│   ├── directory/
│   │   ├── index.tsx                ← Shop list (category filter, search, FlashList)
│   │   └── [shopId]/
│   │       ├── index.tsx            ← Shop detail (photo gallery, hours, reviews)
│   │       └── menu.tsx             ← Menu/product browser
│   ├── orders/                      ← [auth guard] Order history + tracking
│   │   ├── index.tsx
│   │   └── [orderId].tsx            ← Order detail + real-time status (Socket.io)
│   ├── community/
│   │   ├── index.tsx                ← Announcements feed + Reports
│   │   ├── [announcementId].tsx     ← Announcement detail + PDF + comments
│   │   ├── reports/
│   │   │   └── index.tsx            ← Official reports list (PDF links)
│   │   ├── events/
│   │   │   └── index.tsx            ← Events calendar view
│   │   ├── governance/
│   │   │   ├── index.tsx            ← Polls + Elections list
│   │   │   ├── polls/[pollId].tsx   ← Poll detail + vote + results
│   │   │   └── elections/[id].tsx   ← Election detail + candidates + vote
│   │   └── feedback/                ← [auth guard]
│   │       ├── index.tsx            ← My submissions list
│   │       ├── new.tsx              ← Submit feedback form
│   │       └── [feedbackId].tsx     ← Feedback detail + reply thread
│   └── profile/                     ← [auth guard] or Guest CTA
│       ├── index.tsx                ← Settings, notification prefs
│       └── saved-shops.tsx          ← [auth guard] Saved / favourite shops
│
├── notifications/
│   └── index.tsx                    ← In-app notification feed [auth guard]
│
├── (auth)/                          ← Auth modal/stack group
│   ├── login.tsx
│   ├── register.tsx
│   ├── verify-otp.tsx               ← Includes resend-OTP button
│   ├── forgot-password.tsx
│   ├── reset-password.tsx           ← Receives token via deep link
│   └── accept-invitation.tsx        ← Merchant/Admin invite deep link → name + password setup
│
├── (merchant)/                      ← [merchant role guard] separate stack
│   ├── dashboard.tsx
│   ├── menu/
│   │   ├── index.tsx
│   │   └── [productId].tsx
│   └── orders/
│       ├── index.tsx
│       └── [orderId].tsx
│
├── (admin)/                         ← [admin role guard] — Phase 6
│   ├── announcements/
│   │   ├── index.tsx
│   │   └── new.tsx
│   ├── polls/
│   │   └── new.tsx
│   └── elections/
│       └── new.tsx
│
└── checkout/                        ← Full-screen checkout flow
    ├── cart.tsx
    ├── address.tsx                  ← Pre-filled from profile, free-text notes
    ├── payment.tsx                  ← COD or Paymob
    └── confirmation.tsx             ← Lottie success animation
```

### Route Guard Pattern (Expo Router)

Auth-guarded routes use `Redirect` in the group's `_layout.tsx`:

```tsx
// app/(tabs)/orders/_layout.tsx
import { Redirect } from 'expo-router';
import { useSelector } from 'react-redux';

export default function OrdersLayout() {
  const isAuthenticated = useSelector(state => state.auth.isAuthenticated);
  if (!isAuthenticated) return <Redirect href="/(auth)/login" />;
  return <Slot />;
}
```

Merchant guard (`/(merchant)/_layout.tsx`):
```tsx
const role = useSelector(state => state.auth.user?.role);
if (role !== 'MERCHANT') return <Redirect href="/(tabs)" />;
```

**Auth-wall** (for in-screen actions like "Add to Cart" as guest):
`dispatch(showAuthWall({ redirectAction: pendingAction }))` → opens `AuthWallSheet` bottom sheet.
After login, `pendingAction` is re-dispatched automatically.

---

## Mobile Architecture

### State Management Split

- **Redux Toolkit slices:** `authSlice`, `cartSlice`, `preferencesSlice` (language, theme)

  **`authSlice`** — shape:
  ```ts
  interface AuthState {
    user: {
      id: string;
      name: string;
      email: string;
      role: 'RESIDENT' | 'MERCHANT' | 'ADMIN';
      isVerified: boolean;
      avatarUrl: string | null;
      unitNumber: string;
    } | null;
    accessToken: string | null;
    refreshToken: string | null;
    isAuthenticated: boolean;
  }
  // initialState: all null/false
  // Tokens stored in expo-secure-store; Redux holds in-memory copy for interceptors
  ```

  **`cartSlice` multi-shop conflict guard:**
  When user taps "Add to Cart" and cart already contains items from a different shop:
  1. Show bottom sheet (@gorhom/bottom-sheet): "Your cart has items from [currentShopName]. Start a new cart?"
  2. Two actions: [Cancel] (dismiss, do nothing) and [Clear & Add] (clear cart, add new item)
  3. `clearCart()` action resets items array and shopId to null
  4. Never silently replace — always ask the user

- **redux-persist:** auth tokens + cart + preferences survive app restarts
- **TanStack Query:** all server data (shops, orders, polls, announcements) — with `staleTime` + `gcTime` for offline reads

### i18n / RTL

- `expo-localization` for system locale detection
- `i18n-js` or `lingui` for translation strings
- `I18nManager.forceRTL(true/false)` on language switch + app restart prompt
- All UI text externalized from day 1 — no hardcoded strings

### Auth-Wall Pattern

- Global `useAuthGuard()` hook + `AuthWallSheet` (Reanimated bottom sheet)
- Guest actions trigger `dispatch(showAuthWall({ redirectAction }))` from the Redux slice
- After successful login, the intercepted action auto-replays

### Token Refresh Strategy

- Access token TTL: 15min. Refresh token TTL: 7d.
- **Proactive refresh:** Not used. Refresh is triggered only on 401 response.
- **Axios interceptor** catches 401 → calls `POST /auth/refresh { refreshToken }`.
- **On success:** stores new `accessToken` + `refreshToken` in `expo-secure-store`, updates Redux `authSlice`, retries original request.
- **On failure (refresh token expired):** clears `expo-secure-store`, dispatches `logout()`, navigates to `/(auth)/login`.
- **Queue:** Multiple concurrent 401s → only one refresh call fires; others queue and resolve when refresh completes.
- **Logout action** always: clear secure store + reset `authSlice` + navigate to login.

### Cursor Pagination

All list endpoints use cursor-based pagination (not offset). TanStack Query pattern:

```ts
useInfiniteQuery({
  queryKey: ['shops', filters],
  queryFn: ({ pageParam }) => api.getShops({ cursor: pageParam, limit: 20 }),
  getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
})
```

FlashList `onEndReached` triggers `fetchNextPage()`. `nextCursor: null` = no more pages.

### API Client Architecture

**HTTP Client:** Axios

**File:** `src/services/api/client.ts`

Base URL from `EXPO_PUBLIC_API_URL`.

**Request interceptor:**
- Read `accessToken` from `expo-secure-store`
- Attach `Authorization: Bearer <accessToken>` header to every request

**Response interceptor (401 handling):**
- On 401: check if already refreshing (use `isRefreshing` flag)
- If not refreshing: call `POST /auth/refresh` with `refreshToken` from secure store
  - On success: store new tokens, retry the original request
  - On failure: clear secure store, dispatch `logout` action, redirect to `/login`
- If already refreshing: queue the failed request, resolve when refresh completes

**Request queue pattern** (prevents multiple simultaneous refresh calls):
```ts
let isRefreshing = false;
let failedQueue: Array<{ resolve: Function; reject: Function }> = [];

const processQueue = (error: Error | null, token: string | null) => {
  failedQueue.forEach(({ resolve, reject }) =>
    error ? reject(error) : resolve(token)
  );
  failedQueue = [];
};
```

**Service files per module:**
- `src/services/api/auth.ts` — auth endpoints
- `src/services/api/shops.ts` — shop + product endpoints
- `src/services/api/orders.ts` — order endpoints
- `src/services/api/community.ts` — announcements, polls, elections, feedback
- `src/services/api/users.ts` — user profile + push token
- `src/services/api/notifications.ts` — notification feed

### Push Token Registration

After every successful login, register the Expo push token with the server:

```ts
const token = await Notifications.getExpoPushTokenAsync();
await api.patch('/users/me/push-token', { pushToken: token.data });
```

Store token in `authSlice`. Re-register on app foreground if token has changed.

### Push Notification Setup (expo-notifications)

**Registration flow (called after every successful login):**
```ts
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';

async function registerPushToken() {
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') return;

  const token = (await Notifications.getExpoPushTokenAsync({
    projectId: Constants.expoConfig?.extra?.eas?.projectId,
  })).data;

  await api.patch('/users/me/push-token', { pushToken: token });
}
```

**Foreground handler** (in root _layout.tsx):
```ts
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});
```

**Tap handler** (navigates to linked screen):
```ts
Notifications.addNotificationResponseReceivedListener(response => {
  const { screen, params } = response.notification.request.content.data;
  if (screen) router.push({ pathname: screen, params });
});
```

Re-register on app foreground if token has changed (store last token in `expo-secure-store`).

### Offline Support

- TanStack Query persists cached data (via `AsyncStorage` queryClient persister)
- Read-heavy screens (directory, announcements) work offline from cache
- Cart persisted locally, synced on next online session

### Deep Link Scheme

App URL scheme: **`eastpark`**

**`app.json`:** `"scheme": "eastpark"` (already covered in app.json fix above)

**Handled deep links:**
- `eastpark://auth/reset-password?token=<jwt>` → `/(auth)/reset-password.tsx`
- `eastpark://auth/accept-invitation?token=<jwt>` → `/(auth)/accept-invitation.tsx`

**Expo Router handles these automatically** via file-based routing when the scheme is configured.
For universal links (email clients that open HTTPS): configure `Associated Domains` (iOS) and `App Links` (Android) in EAS build — add `intentFilters` to `app.json`.

### Socket.io Client

**File:** `src/services/socket/client.ts`

```ts
import { io, Socket } from 'socket.io-client';
import * as SecureStore from 'expo-secure-store';

let socket: Socket | null = null;

export const getOrdersSocket = async (): Promise<Socket> => {
  if (socket?.connected) return socket;
  const token = await SecureStore.getItemAsync('accessToken');
  socket = io(`${process.env.EXPO_PUBLIC_SOCKET_URL}/orders`, {
    auth: { token },
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 2000,
  });
  return socket;
};

export const joinOrderRoom = (orderId: string) => {
  socket?.emit('join_order', { orderId });
};

export const disconnectSocket = () => {
  socket?.disconnect();
  socket = null;
};
```

**Events:**
- Client emits: `join_order` with `{ orderId }` to subscribe to a specific order
- Server emits: `status_update` with `{ orderId, status: OrderStatus }`

**Cleanup:** call `disconnectSocket()` on logout and when order detail screen unmounts.

### Error Handling

**API errors:** All Axios errors flow through the response interceptor. Non-401 errors are re-thrown as-is. TanStack Query catches them and exposes via `isError` / `error` state.

**Global QueryCache error handler** (in `QueryClient` config):
```ts
new QueryClient({
  queryCache: new QueryCache({
    onError: (error) => {
      // Log to GlitchTip (Phase 7)
      // Show generic toast only for unexpected errors (not 4xx)
    },
  }),
});
```

**Network errors:** TanStack Query `retry: 2` with exponential backoff. After retries exhausted, show inline error state with "Try again" button — never a blank screen.

**React ErrorBoundary:** Wrap root layout in an `ErrorBoundary` that renders a fallback screen with a reload button. Catches uncaught render errors.

**API error shape** (from BE `transform.interceptor`):
```ts
interface ApiError {
  statusCode: number;
  message: string;
  error: string;
}
```

**Toast/snack:** Use Gluestack UI `Toast` component for transient user messages (max 3s). Only for user-facing success/error messages — never for order status (use Socket.io).

---

## Design System

Full reference: `CLAUDEDESIGN.md` (639 lines). Key rules that must never be re-debated:

| Token | Value | Rule |
|---|---|---|
| Primary gold | `#b8966a` | From logo. Use sparingly — it signals importance |
| Gold on light bg | `#7a5e38` | gold-500 fails WCAG AA on light — always use gold-700 |
| Dark bg | `#0d0c0b` | Warm near-black. Never pure #000 |
| Dark card | `#221f1c` | — |
| Light surface | `#faf8f5` | Warm off-white. Never cold zinc |
| Success | `#5A7A52` | Muted olive — not bright green |

- **Fonts:** Cairo (all UI + all Arabic) · Cormorant Garamond (English display/hero only — never functional UI, never Arabic)
- **Dark mode is the flagship** — light is a user toggle preference
- **Motion:** Rich and delightful — spring physics, Lottie on key moments (order placed, vote submitted, payment success), skeleton shimmer (never spinners), haptics on every tap
- **Impeccable skill pack:** 21 design commands installed. Per-screen workflow: `/arrange → /typeset → /colorize → /critique → /polish`

---

## Non-Functional Requirements

| Concern | Approach |
|---|---|
| RTL | Full RTL/LTR aware layout, NativeWind `dir` classes, tested on both |
| Accessibility | `accessibilityLabel`, `accessibilityRole`, sufficient contrast, min 44px touch targets |
| Performance | Hermes + New Architecture, lazy route loading, FlashList for long lists |
| Security | Tokens in `expo-secure-store` (never AsyncStorage), Certificate Pinning (EAS), input sanitization, OWASP Top 10 compliance |
| Deep Linking | Expo Router universal links (share shop pages, announcements) |
| Analytics | **Posthog** (open-source, self-hostable or free cloud: 1M events/month free) |
| Error Monitoring | **GlitchTip** (open-source Sentry alternative, free to self-host) or Sentry free tier (5K errors/month) |

---

## Recommended Boilerplate

**[obytes/react-native-template-obytes](https://github.com/obytes/react-native-template-obytes)**
*(4.1k stars — last updated Jan 2026, v9.0.0)*

> Note: Previously named `react-native-starter`. The repo was renamed — the old bootstrap command (`--template react-native-starter`) is broken.

| Feature | Included | Action needed |
|---|---|---|
| Expo Router (file-based nav) | Yes | — |
| TypeScript strict | Yes | — |
| TanStack Query v4 | Yes | Upgrade to v5 |
| NativeWind v4 (Tailwind CSS for RN) | Yes | — |
| Jest + React Testing Library + Maestro E2E | Yes | — |
| EAS Build config | Yes | — |
| Husky + lint-staged (pre-commit hooks) | Yes | — |
| i18next (i18n) | Yes | Add RTL switching logic |
| Zod (schema validation) | Yes | — |
| React Native Reanimated | Yes | — |
| State management | Zustand | Swap to Redux Toolkit + redux-persist |
| Forms | TanStack Form | Swap to React Hook Form + @hookform/resolvers |
| Auth token storage | MMKV | Keep for general storage; add expo-secure-store for JWT tokens |
| RTL support | Not included | Add I18nManager + expo-localization |

> **Why not Ignite?** — 19.7k stars and RTL support, but uses MobX State Tree — directly conflicts with the Redux Toolkit requirement.
>
> **Why not bare `create-expo-app`?** — obytes gives you NativeWind, Expo Router, TanStack Query, Husky, EAS, Jest + Maestro, and i18next pre-wired, saving ~2 weeks of boilerplate.
>
> **Why not wataru-maeda/react-native-boilerplate?** — Already ships Redux Toolkit and exact Expo SDK 54 + RN 0.81 versions, but only 488 stars, missing TanStack Query and i18n/RTL entirely.

### Bootstrap Command

```bash
# Clone the template (create-expo-app template flag no longer works with this repo)
git clone https://github.com/obytes/react-native-template-obytes EastParkApp
cd EastParkApp
pnpm install
```

#### App Identity — Required Changes to app.json

```json
{
  "expo": {
    "name": "EastPark",
    "slug": "eastpark",
    "scheme": "eastpark",
    "ios": {
      "bundleIdentifier": "com.eastpark.app"
    },
    "android": {
      "package": "com.eastpark.app"
    }
  }
}
```

Also update `package.json` `"name"` field from `"obytes-starter"` to `"eastpark"`.

### Swap and Add Required Packages

```bash
# Remove Zustand, add Redux Toolkit
pnpm remove zustand
pnpm add @reduxjs/toolkit react-redux redux-persist

# Remove TanStack Form, add React Hook Form
pnpm remove @tanstack/react-form
pnpm add react-hook-form @hookform/resolvers

# Upgrade TanStack Query to v5
pnpm add @tanstack/react-query@5

# Add Expo-managed auth + notification packages
npx expo install expo-auth-session expo-secure-store expo-notifications expo-localization expo-linear-gradient

# Real-time
pnpm add socket.io-client

# UI components + animation
npx expo install @gluestack-ui/themed @gluestack-ui/config @gluestack-style/react
# Gluestack UI v2 — NativeWind-compatible. Uses @gluestack-ui/config for NativeWind preset.
pnpm add @gorhom/bottom-sheet
pnpm add react-native-reanimated-carousel
npx expo install lottie-react-native

# Async storage + offline persistence
pnpm add @react-native-async-storage/async-storage

# Lists + media
pnpm add @shopify/flash-list react-native-shimmer-placeholder react-native-fast-image

# PDF + image viewer
pnpm add react-native-pdf react-native-image-viewing

# OTP input
pnpm add react-native-otp-textinput

# TanStack Query offline persistence
pnpm add @tanstack/react-query-persist-client @tanstack/query-async-storage-persister
```

### Execution-Ready Setup Steps

#### 1) Enforce strict TypeScript and quality gates

- Keep `strict: true` in `tsconfig.json`
- Add CI checks for `lint`, `typecheck`, and `test`
- Fail pull requests when any of these checks fail

#### 2) Folder layout

```text
app/
  _layout.tsx
  (tabs)/
  (auth)/
  (merchant)/
  (admin)/
  checkout/
src/
  store/
    index.ts
    slices/
  services/
    api/
    socket/
    query/
  features/
    auth/
    directory/
    orders/
    governance/
    feedback/
    profile/
  components/
  hooks/
  i18n/
  types/
assets/
  animations/    ← Lottie JSON files
  fonts/
  images/
```

### Lottie Animation Assets

Source all animations from [LottieFiles.com](https://lottiefiles.com) — free JSON animations.

**Directory:** `assets/animations/`

| File | Used In | Search term on LottieFiles |
|---|---|---|
| `order-confirmed.json` | checkout/confirmation.tsx | "order success checkmark" |
| `vote-submitted.json` | polls/[pollId].tsx | "vote success" |
| `payment-success.json` | checkout/confirmation.tsx (Paymob) | "payment success" |
| `register-success.json` | verify-otp.tsx (on verification) | "welcome confetti" |
| `invite-accepted.json` | accept-invitation.tsx | "welcome celebration" |
| `notifications-empty.json` | notifications/index.tsx | "empty bell" |
| `cart-empty.json` | checkout/cart.tsx | "empty cart bag" |

Pick warm-toned or neutral animations that suit the gold/black brand. Avoid cold blue or neon animations.

#### 3) Scripts baseline

```json
{
  "scripts": {
    "dev": "expo start",
    "android": "expo run:android",
    "ios": "expo run:ios",
    "web": "expo start --web",
    "lint": "eslint . --ext .ts,.tsx",
    "typecheck": "tsc --noEmit",
    "test": "jest",
    "test:watch": "jest --watch"
  }
}
```

#### 4) First-run order

1. Configure providers in root layout (Redux, React Query, i18n).
2. Implement auth-wall guard and guest read-only behavior.
3. Build tab navigation and route groups.
4. Add directory and announcements read-only screens.
5. Add write actions (vote, feedback, checkout) behind auth-wall.

#### 5) Configure Babel and Metro for NativeWind v4 + Reanimated

**babel.config.js:**
```js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      'nativewind/babel',           // NativeWind v4 — must be before reanimated
      'react-native-reanimated/plugin', // must be LAST
    ],
  };
};
```

**metro.config.js:**
```js
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);
module.exports = withNativeWind(config, { input: './global.css' });
```

**global.css** (create at root):
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

---

## Environment Variables

### .env.local (development — never commit)
```
EXPO_PUBLIC_API_URL=http://localhost:3000
EXPO_PUBLIC_SOCKET_URL=http://localhost:3000
EXPO_PUBLIC_POSTHOG_KEY=phc_your_key_here
```

### .env.production (injected via EAS Secrets)
```
EXPO_PUBLIC_API_URL=https://api.eastpark.app
EXPO_PUBLIC_SOCKET_URL=https://api.eastpark.app
EXPO_PUBLIC_POSTHOG_KEY=phc_prod_key
```

**app.config.js** (replace static app.json for dynamic config reading):
```js
export default ({ config }) => ({
  ...config,
  extra: {
    apiUrl: process.env.EXPO_PUBLIC_API_URL,
    socketUrl: process.env.EXPO_PUBLIC_SOCKET_URL,
    posthogKey: process.env.EXPO_PUBLIC_POSTHOG_KEY,
    eas: { projectId: 'your-eas-project-id' },
  },
});
```

Note: `EXPO_PUBLIC_` prefix makes variables available at runtime without additional config.

---

## Implementation Phases

### Phase 1 — Foundation *(parallel work possible)*
1. Bootstrap from obytes starter, upgrade to exact stack versions
2. Set up EAS project + local CI build pipeline (`expo prebuild`, Gradle, Xcodebuild), configure `eas.json` (dev/staging/prod):
   ```bash
   # Initialize EAS project
   eas init
   eas build:configure
   # Create build profiles in eas.json:
   # development: internal distribution, dev client
   # preview: internal distribution, production API
   # production: store distribution
   ```
3. Add Redux Toolkit + redux-persist, remove Zustand
4. Create frontend API layer contract map (endpoints, DTO types, query keys)
5. Set up i18n with AR/EN strings and RTL switching logic

### Phase 2 — Auth & Core Shell *(depends on Phase 1)*
6. Auth flow: Register (email + phone + unit + OTP) → Login → token management
7. Auth-wall bottom sheet (Reanimated) + `useAuthGuard` hook
8. Tab bar navigation + role-based route guards
9. Push notification setup + permission flow

### Phase 3 — Business Directory *(parallel with Phase 4)*
10. Shops data integration in React Query (list/detail/search query hooks)
11. Directory UI: category tabs, FlashList of shop cards, search
12. Shop detail page: gallery, hours, reviews
13. Review submission UX (auth-wall guarded + optimistic states)

### Phase 4 — Community Hub *(parallel with Phase 3)*
14. Announcements + Reports client integration (React Query hooks)
15. Announcements feed UI + detail + PDF viewer
16. Governance module UI: polls + elections (view, vote flow, results view)
17. Feedback submission UI + status tracking + reply thread rendering

### Phase 5 — Ordering & Payments *(depends on Phase 3)*
18. Product/menu listing integration and mapping for mobile views
19. Cart UI → Checkout screens → Cash on Delivery + Paymob integration
20. Real-time order status client (Socket.io listener + UI state sync)
21. Merchant-facing mobile dashboard screens (role-gated UI)

### Phase 6 — Merchant & Admin Tools *(depends on Phase 5)*
22. Merchant in-app portal UI (shop profile, menu CRUD screens, orders)
23. Admin tooling UI (announcements, polls, moderation screens)

### Phase 7 — Polish & Launch *(depends on all above)*
24. Full AR/EN RTL QA pass
25. GlitchTip + Posthog integration
26. Performance profiling (Flipper / Perfetto)
27. EAS Submit to App Store + Play Store (or Fastlane for fully local submission)
28. OTA update pipeline via EAS Update

---

## Verification & QA Checklist

- [ ] Auth-wall triggers correctly for every guarded action as a guest
- [ ] Auth-wall: every guarded route redirects unauthenticated users correctly
- [ ] RTL layout correct on all screens with Arabic locale
- [ ] All screens render correctly in dark mode (test by toggling in Profile > Preferences)
- [ ] All screens render correctly in Arabic RTL (test each tab: Home, Directory, Orders, Community, Profile)
- [ ] Touch targets ≥ 44dp on all interactive elements (use Expo dev tools overlay)
- [ ] Cart persists across app restarts (redux-persist)
- [ ] Real order placed end-to-end with Cash on Delivery flow
- [ ] Real order placed end-to-end with Paymob sandbox
- [ ] Resident cannot vote twice in the same poll/election
- [ ] Socket.io order status updates reflect within 3 seconds
- [ ] PDF reports open inline without external app
- [ ] Deep links work: `eastpark://auth/reset-password?token=test` opens reset screen
- [ ] Deep links work: `eastpark://auth/accept-invitation?token=test` opens invite screen
- [ ] Account deletion: deletes user, clears auth, redirects to login
- [ ] Offline: Directory and Announcements load from cache when offline
- [ ] Jest unit test coverage ≥ 70% on business logic slices
- [ ] E2E Maestro flow: register → browse shop → add to cart → checkout
- [ ] App Store / Play Store review checklist (privacy policy, permissions justification)
