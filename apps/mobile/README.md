# EastPark Frontend

**EastPark** is a residential compound super-app for the MENA region — a local marketplace (shops, ordering, real-time tracking) combined with a community governance hub (announcements, polls, elections, feedback). Arabic RTL is a first-class experience throughout.

---

## Table of Contents

1. [Tech Stack](#tech-stack)
2. [Architecture Overview](#architecture-overview)
3. [Navigation Structure](#navigation-structure)
4. [Design System](#design-system)
5. [Features by Module](#features-by-module)
6. [State Management](#state-management)
7. [API Services](#api-services)
8. [Authentication Flow](#authentication-flow)
9. [Internationalisation & RTL](#internationalisation--rtl)
10. [Environment Setup](#environment-setup)
11. [Development Commands](#development-commands)
12. [EAS Build](#eas-build)
13. [Code Quality](#code-quality)
14. [Commit Convention](#commit-convention)
15. [Build History](#build-history)

---

## Tech Stack

| Layer | Library | Version |
|---|---|---|
| Framework | Expo | ~54.0.32 |
| Runtime | React Native | 0.81.5 |
| Language | TypeScript strict | ^5.9.3 |
| JS Engine | Hermes + New Architecture | enabled |
| Navigation | Expo Router | ~6.0.22 |
| Server State | TanStack React Query v5 | ^5.90.19 |
| Global State | Redux Toolkit | ^2.5.0 |
| State Persist | redux-persist | ^6.0.0 |
| Forms | React Hook Form | ^7.56.0 |
| Validation | Zod | ^4.3.5 |
| Styling | Tailwind / Uniwind + NativeWind | ^1.2.4 |
| Lists | @shopify/flash-list | 2.0.2 |
| Bottom Sheet | @gorhom/bottom-sheet | ^5.2.8 |
| Carousel | react-native-reanimated-carousel | ^4.0.3 |
| Animations | react-native-reanimated + Moti | ~4.1.6 / ^0.30.0 |
| Lottie | lottie-react-native | ^7.2.2 |
| Icons | phosphor-react-native | ^3.0.4 |
| Gradients | expo-linear-gradient | ^55.0.9 |
| Auth Tokens | expo-secure-store | ~15.0.8 |
| Local Storage | react-native-mmkv | ~4.1.1 |
| HTTP Client | axios | ^1.13.2 |
| Real-time | socket.io-client | ^4.8.1 |
| Push | expo-notifications | ~0.29.14 |
| i18n | i18next + react-i18next | ^25.8.0 / ^16.5.3 |
| OTP Input | react-native-otp-textinput | ^1.1.5 |
| PDF Viewer | react-native-pdf | ^6.7.6 |
| Skeleton | react-native-shimmer-placeholder | ^2.0.9 |
| Image Viewer | react-native-image-viewing | ^0.2.2 |
| Flash Messages | react-native-flash-message | ^0.4.2 |
| Testing | Jest + React Native Testing Library | ^29.7.0 / ^13.3.3 |

---

## Architecture Overview

### Root Provider Stack

```
ReduxProvider
  └── PersistGate
        └── PersistQueryClientProvider   ← TanStack Query + AsyncStorage offline cache
              └── GestureHandlerRootView
                    └── KeyboardProvider
                          └── ThemeProvider
                                └── BottomSheetModalProvider
                                      └── Stack (Expo Router)
                                            ├── <AuthWallSheet />      ← global auth gate
                                            ├── <CartConflictSheet />  ← multi-shop cart guard
                                            └── <FlashMessage />       ← global toast
```

### Key Patterns

**Auth-Wall** — Guests browse freely. Any auth-required action calls `dispatch(showAuthWall({ redirectAction }))`, which slides up a bottom-sheet login/register prompt. After successful auth, the original action auto-replays.

**Cursor Pagination** — Every list screen uses `useInfiniteQuery` with cursor-based pagination:

```ts
useInfiniteQuery({
  queryFn: ({ pageParam }) => api.getShops({ cursor: pageParam, limit: 20 }),
  getNextPageParam: last => last.nextCursor ?? undefined,
  initialPageParam: undefined,
});
// FlashList onEndReached → fetchNextPage()
```

**Offline Cache** — TanStack Query + AsyncStorage persister. Directory and announcements are readable offline. The cart is persisted locally via redux-persist.

**Push Token Registration** — After every login, the app immediately calls `PATCH /users/me/push-token`. Re-registers on foreground resume if the token changed.

---

## Navigation Structure

All routes live under `src/app/` (Expo Router file-based routing):

```
src/app/
├── _layout.tsx                         Root provider stack + global sheets
│
├── (auth)/                             Public auth screens (no tab bar)
│   ├── login.tsx                       Email + password login
│   ├── register.tsx                    Name / email / phone / unit / password
│   ├── verify-otp.tsx                  6-digit email OTP + resend button
│   ├── forgot-password.tsx             Request password reset email
│   ├── reset-password.tsx              New password (token via deep link)
│   └── accept-invitation.tsx           Merchant/Admin invite → name + password setup
│
├── (tabs)/                             Main 5-tab navigation shell
│   ├── _layout.tsx                     Tab bar: Home / Directory / Orders* / Community / Profile*
│   ├── index.tsx                       Home feed — greeting, quick actions, announcements preview, shops preview
│   │
│   ├── directory/
│   │   ├── index.tsx                   Shop list — FlashList, category chips, search, cursor pagination
│   │   └── [shopId]/
│   │       └── index.tsx               Shop detail — photo hero, menu tab, reviews tab, CartBar
│   │
│   ├── orders/                         [auth guard]
│   │   ├── index.tsx                   Order history — FlashList with status badges
│   │   └── [orderId].tsx              Order detail + real-time status via Socket.io
│   │
│   ├── community/
│   │   ├── index.tsx                   Announcements feed + Reports section
│   │   ├── [announcementId].tsx        Announcement detail + comments
│   │   ├── reports/
│   │   │   └── index.tsx               Official PDF compound reports list
│   │   ├── governance/
│   │   │   ├── index.tsx               Polls + Elections overview
│   │   │   ├── polls/[pollId].tsx      Poll detail + vote + live results
│   │   │   └── elections/[id].tsx      Election + candidates + vote
│   │   └── feedback/                   [auth guard]
│   │       ├── index.tsx               My submitted feedback list
│   │       ├── new.tsx                 Submit new feedback form
│   │       └── [feedbackId].tsx        Feedback detail + admin reply thread
│   │
│   └── profile/
│       └── index.tsx                   Auth: account info, language/theme toggles, logout / Guest: sign-in CTA
│
├── notifications/
│   └── index.tsx                       [auth guard] In-app notification feed, mark read/all
│
├── (merchant)/                         [merchant role guard]
│   ├── dashboard.tsx                   Shop open/close toggle, pending orders banner, quick actions, stats
│   ├── menu/
│   │   ├── index.tsx                   Product list with availability toggle + pull-to-refresh
│   │   └── [productId].tsx             Create/edit product form (EN + AR fields, price, image URL)
│   └── orders/
│       ├── index.tsx                   Incoming orders filtered by status (30s polling)
│       └── [orderId].tsx               Order detail — Accept / Reject / Advance status
│
└── checkout/
    ├── cart.tsx                        Review items, quantities, totals
    ├── address.tsx                     Delivery address + free-text notes
    ├── payment.tsx                     Cash on Delivery or Paymob
    └── confirmation.tsx                Lottie success animation + order summary
```

> `*` = auth-guarded tab (redirects guests to login)

---

## Design System

Color palette derived from the EastPark brand logo (`eastpark.jpg`). Full specification in `DESIGN.md`.

### Color Tokens (`src/theme/tokens.ts`)

```ts
BRAND.gold = '#b8966a'; // Primary accent — use sparingly
BRAND.goldDark = '#7a5e38'; // Gold on light backgrounds (WCAG AA)

DARK.bg = '#0d0c0b'; // Warm near-black — flagship surface
DARK.card = '#221f1c'; // Card surface
DARK.elevated = '#2e2a26'; // Modals, sheets
DARK.border = '#3d3830'; // Dividers
DARK.text = '#f5f0e8'; // Primary text
DARK.textMuted = '#9e9488'; // Secondary / placeholder text

SEMANTIC.success = '#5A7A52'; // Muted olive
SEMANTIC.warning = '#C48B2F'; // Deep amber
SEMANTIC.error = '#B03A2E'; // Deep muted red
SEMANTIC.info = '#4A6B8A'; // Slate blue
```

### Typography

| Font | Role | Weights |
|---|---|---|
| Cairo | All UI text — both English and Arabic | 400 · 500 · 600 · 700 |
| Cormorant Garamond | English display/hero text only — never functional UI, never Arabic | 400 · 600 · 700 |

Both fonts are embedded via the `expo-font` plugin at build time — no runtime load flash.

### Spacing & Radius

```ts
SPACING = { 'xs': 4, 'sm': 8, 'md': 12, 'base': 16, 'lg': 20, 'xl': 24, '2xl': 32, '3xl': 48 };
RADIUS = { sm: 8, md: 12, lg: 16, xl: 24, full: 9999 };
```

### Motion Rules

- Spring physics via `react-native-reanimated` — no linear easing
- Lottie animations on key moments: order placed, vote submitted, payment success, registration complete
- Skeleton shimmer (never spinners) for all loading states via `react-native-shimmer-placeholder`
- Haptic feedback on every interactive tap
- Respects `prefers-reduced-motion`

### Accessibility

- WCAG AA contrast: ≥ 4.5:1 text, ≥ 3:1 large text
- Touch targets: minimum 44dp, preferred 48dp
- Never: pure `#000`/`#fff` · cold zinc grays · bright emerald green · neon colors

---

## Features by Module

### Home
- Time-based personalised greeting (morning / afternoon / evening)
- Unit number shown for authenticated residents
- 6-item quick-actions grid linking to all major features
- Latest 3 announcements preview with "See All" link
- Latest 6 shops grid with "See All" link

### Business Directory
- Shop list with FlashList, cursor pagination, category filter chips, and search
- Shop detail: cover photo hero, back/save navigation, open/closed badge, rating, description, phone/WhatsApp CTA buttons
- Tabbed interface: **Menu** (products with image, EN/AR name, price, Add to Cart) and **Reviews** (name, stars, comment)
- CartBar: sticky bottom bar shows item count + total when the cart has items from this shop
- Multi-shop conflict guard: adding from a different shop shows a bottom sheet asking to clear or keep the current cart

### Orders
- Order history list with status chips: PLACED → CONFIRMED → ON_THE_WAY → DELIVERED / CANCELLED
- Real-time status updates via Socket.io `/orders` namespace
- Cancel button visible and active only while status is `PLACED`
- Order detail with product snapshots (name at time of order) and total breakdown

### Community Hub
- **Announcements**: Feed with category badges (GENERAL / PROMOTION / EVENT / MAINTENANCE / NEWS), tap to full detail, in-app PDF viewer for attachments
- **Reports**: Official compound PDF reports list with in-app viewer
- **Polls**: Vote on active polls, view live or sealed results, expiry countdown
- **Elections**: Candidate list with EN/AR name and statement, single-vote guarantee, three visibility modes (SEALED_UNTIL_DEADLINE / LIVE_COUNT / ADMIN_CONTROLLED)
- **Feedback**: Category chips (MAINTENANCE / SECURITY / CLEANLINESS / NOISE / SUGGESTION / OTHER), anonymous toggle, title + body; view submissions and admin reply thread

### Profile
- **Authenticated**: avatar initial, name, email, unit number; language toggle (EN ↔ AR with RTL flip + restart); theme segmented control (Dark / Light / System); logout; delete account with confirmation
- **Guest**: illustration + sign-in CTA

### Notifications
- Infinite-scroll feed with FlashList and cursor pagination
- Color-coded type indicator dots: ORDER_UPDATE (gold), ANNOUNCEMENT (info), POLL (success), ELECTION (warning)
- Tap to mark individual notification as read
- "Mark All Read" header button with unread count badge
- Relative timestamps (e.g. "2h ago", "3d ago", "Just now")

### Merchant Tools
- **Dashboard**: Open/close toggle switch with instant mutation, pending-order count alert banner linking to orders, quick-action cards, stat cards
- **Menu management**: Product list with per-item availability toggle, pull-to-refresh, FAB to add new product
- **Product form**: EN name, AR name, price (EGP), EN description, AR description, image URL; Zod validation with field-level error messages
- **Order management**: Incoming orders filtered by status, 30-second polling; per-order actions to accept, reject, or advance status

### Checkout Flow
1. **Cart** — item list, adjust quantities (decrease to 0 removes item), remove, subtotal
2. **Address** — delivery address pre-filled from profile + free-text notes field
3. **Payment** — Cash on Delivery or Paymob (card/wallet)
4. **Confirmation** — Lottie success animation, order number, estimated delivery

---

## State Management

Three Redux Toolkit slices, all persisted via redux-persist + MMKV:

### `authSlice`

```ts
{
  user: { id, name, email, unitNumber, role, pushToken } | null,
  tokens: { access: string, refresh: string } | null,
  isAuthenticated: boolean,
  showAuthWall: boolean,
  authWallRedirectAction: SerializedAction | null,
}
```

Actions: `setCredentials`, `clearCredentials`, `showAuthWall`, `hideAuthWall`, `updatePushToken`

### `cartSlice`

```ts
{
  items: CartItem[],              // { productId, name, nameAr, price, quantity, imageUrl }
  shopId: string | null,          // enforces single-shop constraint
  shopName: string | null,
  showConflictSheet: boolean,     // true when adding from a different shop
  pendingItem: PendingCartItem | null,
}
```

Actions: `addItem` (guards multi-shop conflict), `updateQuantity`, `removeItem`, `clearCart`, `clearAndAdd` (clears old cart + adds pending), `dismissConflict`

### `preferencesSlice`

```ts
{
  language: 'en' | 'ar',
  theme: 'dark' | 'light' | 'system',
}
```

Actions: `setLanguage`, `setTheme`

---

## API Services

All HTTP calls go through a shared Axios instance (`src/services/api/client.ts`) with:

- Base URL from `EXPO_PUBLIC_API_URL`
- JWT access token injected via request interceptor (from expo-secure-store)
- 401 → silent token refresh via `POST /auth/refresh`, then request retried automatically
- On refresh failure → `dispatch(clearCredentials())` + redirect to login

| File | Endpoints |
|---|---|
| `users.ts` | `GET/PATCH /users/me` · `PATCH /users/me/push-token` · `DELETE /users/me` |
| `shops.ts` | `GET /shops` · `GET /shops/:id` · `GET /shops/:id/products` · `GET /shops/:id/reviews` · `POST/DELETE /shops/:id/save` |
| `orders.ts` | `GET /orders` · `GET /orders/:id` · `POST /orders` · `PATCH /orders/:id/cancel` |
| `community.ts` | announcements CRUD · reports · comments · feedback CRUD · feedback replies |
| `merchant.ts` | shop management · `toggle-open` · products CRUD · orders + status changes |
| `notifications.ts` | `GET /notifications` · `PATCH /notifications/:id/read` · `PATCH /notifications/read-all` |

---

## Authentication Flow

```
Register
  POST /auth/register  (name, email, phone, unitNumber, password)
  → verify-otp screen (6-digit email code, resend button)
  POST /auth/verify-otp
  → dispatch(setCredentials) → tokens stored in expo-secure-store
  → PATCH /users/me/push-token
  → home

Login
  POST /auth/login  (email, password)
  → dispatch(setCredentials) → tokens stored in expo-secure-store
  → PATCH /users/me/push-token
  → home (or replay pending auth-wall action)

Forgot Password
  POST /auth/forgot-password  (email)
  → reset link email → deep link → reset-password screen
  POST /auth/reset-password  (token, newPassword)

Merchant / Admin Invite
  Admin creates invitation → signed one-time token emailed
  → deep link → accept-invitation screen
  POST /auth/accept-invitation  (token, name, password)

Token Lifecycle
  Access token  : 15-min TTL · expo-secure-store
  Refresh token : 7-day TTL · expo-secure-store (never AsyncStorage)
  Silent refresh: Axios interceptor catches 401, refreshes, retries original request
  Logout        : POST /auth/logout (blacklists refresh in Redis) + clearCredentials
```

### User Roles

| Role | Access |
|---|---|
| Guest | Read-only: directory, announcements, reports, governance |
| Resident | All guest access + orders, feedback, voting, profile |
| Merchant | Resident access + merchant dashboard, menu CRUD, order management |
| Admin | Full access (admin web panel is separate) |

---

## Internationalisation & RTL

- **Languages**: English (LTR) and Arabic (RTL)
- **Library**: i18next + react-i18next
- **Locale detection**: expo-localization on first launch
- **RTL switch**: `I18nManager.forceRTL(true/false)` on language change + restart prompt via `react-native-restart`
- **Translation files**: `src/translations/en.json` and `src/translations/ar.json`
- **Namespaces**: `auth` · `cart` · `checkout` · `common` · `community` · `directory` · `errors` · `feedback` · `governance` · `home` · `merchant` · `notifications` · `orders` · `profile`

Rules enforced in code:
- No hardcoded strings — always `t('namespace.key')`
- All API data exposes `name`/`nameAr` and `description`/`descriptionAr` — always display the active language variant
- Cairo handles both Latin and Arabic scripts; Cormorant Garamond is English-only

---

## Environment Setup

### Prerequisites

- Node.js 20+
- pnpm 9+
- Expo CLI: `pnpm add -g expo-cli`
- EAS CLI (for builds): `pnpm add -g eas-cli`

### Installation

```bash
git clone <repo>
cd apps/mobile
pnpm install
```

### Environment Variables

Copy `.env.example` to `.env.local` and fill in your values:

```bash
cp .env.example .env.local
```

`.env.local` is git-ignored — never commit real secrets to tracked files.

Example `.env.local`:

```env
EXPO_PUBLIC_APP_ENV=development        # development | preview | production
EXPO_PUBLIC_API_URL=http://localhost:3000   # do NOT add /v1 — the Axios client appends it
EXPO_PUBLIC_SOCKET_URL=http://localhost:3000
EXPO_PUBLIC_POSTHOG_KEY=               # optional — leave blank for dev
SECRET_KEY=                            # build-time only — not accessible in client code
APP_BUILD_ONLY_VAR=                    # build-time only
```

> Most identity vars (`NAME`, `SCHEME`, `BUNDLE_ID`, `PACKAGE`, `VERSION`) are derived automatically from `EXPO_PUBLIC_APP_ENV` in `env.ts` — you do not set them manually.

All variables are validated at build time by `env.ts` using Zod — the build fails immediately if a required variable is missing or malformed.

---

## Development Commands

```bash
pnpm start              # Start Expo dev server (Metro bundler)
pnpm ios                # Run on iOS simulator
pnpm android            # Run on Android emulator

pnpm lint               # ESLint check
pnpm lint --fix         # Auto-fix ESLint errors
pnpm type-check         # tsc --noEmit
pnpm test               # Jest unit tests
pnpm check-all          # lint + type-check + test in one pass

pnpm start:preview      # Start with preview environment
pnpm ios:production     # Run on iOS simulator with production env
```

---

## EAS Build

Three build profiles defined in `eas.json`:

| Profile | App label | Bundle ID suffix | Icon badge |
|---|---|---|---|
| `development` | EastPark (dev) | `.development` | `dev` banner |
| `preview` | EastPark (preview) | `.preview` | `preview` banner |
| `production` | EastPark | — | none |

```bash
# Development build (installable on device with dev menu)
eas build --profile development --platform ios
eas build --profile development --platform android

# Preview / internal testing
eas build --profile preview --platform all

# Production (App Store / Play Store)
eas build --profile production --platform all

# Submit to stores
eas submit --platform ios
eas submit --platform android

# OTA update (no store review required)
eas update --branch production --message "Fix: cart total calculation"
```

---

## Code Quality

### ESLint

Base: `@antfu/eslint-config`. Additional plugins:

- `eslint-plugin-react-hooks` — enforces Rules of Hooks
- `eslint-plugin-react-compiler` — React compiler compatibility
- `eslint-plugin-unicorn` — extra code quality rules
- `eslint-plugin-import` — import ordering and resolution
- `eslint-plugin-testing-library` — correct Testing Library usage
- `eslint-plugin-better-tailwindcss` — validates Tailwind class names

Key enforced rules:

| Rule | Requirement |
|---|---|
| `perfectionist/sort-imports` | Type imports before value imports; external before internal; alphabetical within groups |
| `unicorn/filename-case` | kebab-case (exception regex for Expo Router dynamic segments, e.g. `[shopId].tsx`) |
| `max-lines-per-function` | 110 lines max — extract sub-components when exceeded |
| `max-statements-per-line` | No multi-statement inline callbacks |
| `react-hooks/rules-of-hooks` | All hooks called before any early `return` |

### TypeScript

`tsconfig.json` uses strict mode:

```json
{
  "strict": true,
  "noUncheckedIndexedAccess": true,
  "exactOptionalPropertyTypes": true
}
```

Path alias: `@/*` → `src/*` for all imports (never relative paths).

### Pre-commit Hooks

`husky` + `lint-staged` runs on every commit:
1. ESLint auto-fix on staged `.ts`/`.tsx` files
2. TypeScript type-check on changed files
3. `commitlint` validates the commit message format

---

## Commit Convention

```
[AhmedMuhammedElsaid][type]: short description

Types: feat | fix | chore | refactor | test | docs | style
```

Examples:
```
[AhmedMuhammedElsaid][feat]: phase 3 - business directory
[AhmedMuhammedElsaid][fix]: cart total CartItem type annotation
[AhmedMuhammedElsaid][chore]: fix eslint import order in merchant screens
```

---

## Build History

| Commit | Phase | Description |
|---|---|---|
| `2caa0e6` | Phase 1 | Foundation — obytes template, Redux Toolkit, i18n, RTL, providers, theme tokens |
| `17e53b8` | Phase 2 | Auth & Core Shell — register, OTP verify, login, JWT tokens, auth-wall, push token |
| `824a16a` | Phase 3 | Business Directory — shop list, shop detail, menu, reviews, CartBar, CartConflictSheet |
| `e59cd02` | Phase 4 | Community Hub — announcements, reports, PDF viewer, governance (polls + elections), feedback |
| `47eaf4b` | Phase 5 | Ordering & Payments — cart, address, COD/Paymob checkout, real-time tracking, cancel |
| `4ea2f31` | Phase 6 | Merchant Tools — dashboard, menu CRUD, incoming order management |
| `379b195` | Phase 7 | Polish & Launch — home feed, profile, notifications, TypeScript + ESLint clean across all phases |
| `723ed15` | Chore | ESLint fixes in obytes template scaffold files |

---

## Project Structure Reference

```
apps/mobile/
├── src/
│   ├── app/                        All Expo Router screens (see Navigation Structure above)
│   ├── components/
│   │   ├── auth/                   AuthInput, AuthWallSheet, BrandMark, GoldButton, AuthScreenWrapper
│   │   ├── cart/                   CartConflictSheet
│   │   ├── directory/              CategoryChips, ShopCard
│   │   └── ui/                     Skeleton, Button, Input, Modal, Select, Text, Checkbox, ProgressBar, …
│   ├── lib/
│   │   ├── hooks/                  use-auth-guard, use-selected-theme, use-selected-language
│   │   ├── i18n.ts                 i18next + expo-localization setup
│   │   └── storage.ts              MMKV wrapper (typed get/set/remove)
│   ├── services/
│   │   └── api/                    client.ts (Axios + interceptors) + per-domain service files
│   ├── store/
│   │   ├── slices/                 authSlice.ts, cartSlice.ts, preferencesSlice.ts
│   │   └── index.ts                Redux store + persist config (MMKV storage adapter)
│   ├── theme/
│   │   └── tokens.ts               BRAND, DARK, SEMANTIC, SPACING, RADIUS, FONT constants
│   └── translations/
│       ├── en.json
│       └── ar.json
├── assets/                         icon.png, splash-icon.png, adaptive-icon.png
├── app.config.ts                   Expo config (name, bundle IDs, plugins, font embedding)
├── env.ts                          Environment variable schema with Zod validation
├── eslint.config.mjs               ESLint flat config
├── tsconfig.json                   TypeScript strict config + @/* path alias
├── tailwind.config.ts              Tailwind / NativeWind config
├── commitlint.config.ts            Commit message format rules
└── eas.json                        EAS Build profiles (development / preview / production)
```
