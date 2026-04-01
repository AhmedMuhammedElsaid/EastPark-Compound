# EastPark — Application Context

> Comprehensive technical snapshot of the EastPark codebase as explored in April 2026.
> Use this as a quick-reference reference for AI-assisted sessions and onboarding.

---

## What Is EastPark

A **residential compound super-app** for the MENA region with two core domains:

1. **Local Marketplace** — browse compound shops, add to cart, place orders, real-time delivery tracking
2. **Community Governance** — announcements, official PDF reports, polls, elections, resident feedback

Primary language: **Arabic (RTL)**. Secondary: **English (LTR)**. Language is switchable in-app.

---

## Monorepo Layout

```
EastPark-App/
├── eastpark-backend/     NestJS 11 + Fastify — fully built ✅
├── eastpark-frontend/    Expo 54 React Native — in active development ✅
├── BackendPlan.md        Canonical backend design document
├── FrontendPlan.md       Canonical frontend design document
├── DESIGN.md             Complete design system (~1750 lines)
├── CLAUDE.md             AI session context + all locked decisions
├── HOWTORUN.md           Step-by-step setup guide
└── eastpark.jpg          Brand logo (source of color palette)
```

---

## Backend — eastpark-backend/

### Status: Fully Built ✅

### Technology Stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | NestJS 11 | Fastify adapter (NOT Express) |
| Runtime | Node.js ≥ 20 | pnpm@9.15.0 pinned |
| ORM | Prisma 6.19.0 | PostgreSQL 16 |
| Cache | ioredis → Redis 7 | OTP, token blacklist, rate limiting |
| Auth | Passport + JWT | argon2 hashing; two secrets (access 15min, refresh 7d) |
| WebSockets | Socket.io | `/orders` namespace for real-time order updates |
| Email | Nodemailer | Mailpit (dev) / Brevo SMTP (prod) |
| File storage | Supabase JS SDK | MinIO Docker (dev) / Supabase Storage (prod, 1GB free) |
| Push | expo-server-sdk | Expo Push Service inline — no queues |
| Payments | Paymob | HMAC-SHA512 webhook; COD is primary |
| Logging | nestjs-pino / pino-pretty | — |
| Scheduling | @nestjs/schedule | @Cron every 5min for election auto-open |
| API docs | Swagger | `http://localhost:3000/docs` |
| Hosting | Fly.io `cdg` (Paris) | min 1 machine always on, WebSocket-friendly |

### Docker Compose Services (dev)

| Container | Image | Port(s) |
|---|---|---|
| eastpark-postgres | postgres:16-alpine | 5432 |
| eastpark-redis | redis:7-alpine | 6379 |
| eastpark-mailpit | axllent/mailpit | 1025 (SMTP), 8025 (Web UI) |
| eastpark-minio | minio/minio | 9000 (S3 API), 9001 (Console) |
| eastpark-minio-init | minio/mc | — (one-shot bucket creator) |

MinIO default credentials: `minioadmin` / `minioadmin`. Bucket name: `eastpark-uploads`.

### Key Environment Variables

| Variable | Dev Default |
|---|---|
| `DATABASE_URL` | `postgresql://postgres:master123@localhost:5432/eastpark` |
| `REDIS_URL` | `redis://localhost:6379` |
| `AUTH_ACCESS_TOKEN_SECRET` | **Must generate**: `openssl rand -base64 48` |
| `AUTH_REFRESH_TOKEN_SECRET` | **Must generate**: `openssl rand -base64 48` |
| `AUTH_ACCESS_TOKEN_EXP` | `15m` |
| `AUTH_REFRESH_TOKEN_EXP` | `7d` |
| `SMTP_HOST` / `SMTP_PORT` | `localhost` / `1025` |
| `SUPABASE_URL` | `http://localhost:9000` (MinIO) |
| `SUPABASE_SERVICE_KEY` | `minioadmin` |
| `SUPABASE_BUCKET` | `eastpark-uploads` |
| `HTTP_PORT` | `3000` |

### Key npm Scripts

| Command | Purpose |
|---|---|
| `pnpm dev:setup` | Full automated setup: Docker → migrate → seed → dev server |
| `pnpm dev` | Hot-reload dev server |
| `pnpm seed` | Creates `admin@eastpark.local` / `Admin@123456` (idempotent) |
| `pnpm prisma:migrate` | Create + apply new migration |
| `pnpm prisma:studio` | Visual DB browser at localhost:5555 |
| `pnpm docker:up/down/reset` | Manage Docker services |
| `pnpm test` | 62 unit tests, ~88% statement coverage |
| `pnpm build` | Compile TypeScript → dist/ |

### Local Dev URLs

| URL | Purpose |
|---|---|
| `http://localhost:3000/v1` | REST API |
| `http://localhost:3000/docs` | Swagger UI |
| `ws://localhost:3000/orders` | WebSocket |
| `http://localhost:8025` | Mailpit email viewer |
| `http://localhost:9001` | MinIO console |
| `http://localhost:5555` | Prisma Studio |

### RBAC Roles

| Role | Access |
|---|---|
| GUEST | Read-only: directory, announcements |
| RESIDENT | Full consumer access + feedback + voting |
| MERCHANT | Consumer access + merchant dashboard + menu/order mgmt |
| ADMIN | Full access + admin actions + invite users |

### Auth Flows

- **Register:** name + email + phone + unitNumber + password → Email OTP → verified
- **Login:** email + password (no passwordless / OTP login)
- **Forgot password:** reset token in Redis (30min TTL) → link email → reset screen
- **Merchant/Admin:** admin sends invite → one-time signed token → `accept-invitation` screen
- **Logout:** blacklist refresh token in Redis

---

## Frontend — eastpark-frontend/

### Status: In Active Development ✅

### Technology Stack

| Layer | Choice | Version |
|---|---|---|
| Framework | Expo + React Native | 54.0.32 / 0.81.5 |
| Language | TypeScript strict | 5.9 |
| JS Engine | Hermes + New Architecture | enabled |
| Package manager | pnpm | 9.15.9 (enforced) |
| Navigation | Expo Router | 6.0.22 |
| State | Redux Toolkit + redux-persist | 2.5.0 / 6.0.0 |
| Server state | TanStack React Query | v5 |
| Styling | NativeWind + Gluestack UI v2 | — |
| Lists | FlashList (@shopify/flash-list) | 2.0.2 — never FlatList |
| Bottom Sheet | @gorhom/bottom-sheet | 5.2.8 |
| Forms | React Hook Form + Zod | 7.56.0 / 4.3.5 |
| Auth tokens | expo-secure-store | 15.0.8 — never AsyncStorage |
| Animation | react-native-reanimated | 4.1.6 |
| Icons | Phosphor Icons | — |
| i18n | i18next + expo-localization | 25.8.0 / 17.0.8 |
| Real-time | socket.io-client | 4.8.1 |
| PDF | react-native-pdf | 6.7.6 |
| Lottie | lottie-react-native | 7.2.2 |

### Redux Slices

| Slice | Purpose |
|---|---|
| `authSlice` | user, tokens, role, isVerified |
| `cartSlice` | items, shopId (multi-shop conflict guard) |
| `preferencesSlice` | language, theme |

### Key Environment Variables

| Variable | Dev Default |
|---|---|
| `EXPO_PUBLIC_APP_ENV` | `development` |
| `EXPO_PUBLIC_API_URL` | `http://localhost:3000/v1` |
| `EXPO_PUBLIC_SOCKET_URL` | `http://localhost:3000` |
| `EXPO_PUBLIC_POSTHOG_KEY` | (optional) |

> **Android emulator:** Use `http://10.0.2.2:3000` instead of `localhost`.

### Key npm Scripts

| Command | Purpose |
|---|---|
| `pnpm start` | Start Metro (Expo Go / dev client) |
| `pnpm ios` / `pnpm android` | Run on simulator/emulator |
| `pnpm build:development:*` | EAS dev client build |
| `pnpm build:production:*` | EAS production build |
| `pnpm check-all` | lint + type-check + i18n lint + tests |
| `pnpm doctor` | expo-doctor health check |

### Provider Stack (root _layout.tsx)

```
ReduxProvider
  PersistGate (redux-persist)
    PersistQueryClientProvider (TanStack Query + AsyncStorage)
      GestureHandlerRootView
        KeyboardProvider
          ThemeProvider (React Navigation)
            BottomSheetModalProvider
              <Stack>     ← Expo Router routes
              <AuthWallSheet />       ← global auth gate
              <CartConflictSheet />   ← multi-shop cart conflict
              <FlashMessage />        ← global toast
```

### Navigation Structure

```
app/
├── (tabs)/
│   ├── index                  Home Feed
│   ├── directory/             Shop list + shop detail + menu
│   ├── orders/                [auth] Order history + real-time tracking
│   ├── community/             Announcements + governance + feedback
│   └── profile/               [auth] Profile / Guest CTA
├── notifications/             [auth] In-app notification feed
├── (auth)/                    login, register, verify-otp, forgot-password,
│                              reset-password, accept-invitation
├── (merchant)/                [merchant guard] Dashboard, menu CRUD, orders
└── checkout/                  cart → address → payment → confirmation
```

### Key Architecture Patterns

- **Auth-wall:** Global `useAuthGuard()` + `AuthWallSheet`. Guest action → `dispatch(showAuthWall({ redirectAction }))` → replays after login.
- **Cursor pagination:** All lists use `useInfiniteQuery` with `cursor` + `limit`. FlashList `onEndReached` → `fetchNextPage()`.
- **Push tokens:** After every login: `PATCH /users/me/push-token`. Re-register on foreground if token changed.
- **RTL:** `I18nManager.forceRTL(true/false)` on language switch + restart prompt. No hardcoded strings ever.
- **Offline:** TanStack Query + AsyncStorage persister. Directory + announcements readable offline. Cart persisted locally.

### EAS Build Profiles

| Profile | Type | Distribution |
|---|---|---|
| `development` | dev client | internal |
| `preview` | internal APK | store |
| `production` | store release (.aab / .ipa) | store |
| `simulator` | dev client | internal (iOS simulator) |

> `EAS_PROJECT_ID` is currently empty (`''`). Run `eas init` inside `eastpark-frontend/` before any cloud build.

---

## Design System

### Color Palette (from eastpark.jpg logo)

| Token | Hex | Usage |
|---|---|---|
| Primary gold | `#b8966a` | Sparingly — accents, CTAs |
| Gold on light bg | `#7a5e38` | WCAG AA on light surfaces |
| Dark background | `#0d0c0b` | Warm near-black — never pure #000 |
| Dark card | `#221f1c` | Card surfaces |
| Dark elevated | `#2e2a26` | Modals, sheets |
| Light surface | `#faf8f5` | Warm off-white — never cold zinc |
| Success | `#5A7A52` | Muted olive |
| Warning | `#C48B2F` | Deep amber |
| Error | `#B03A2E` | Deep muted red |
| Info | `#4A6B8A` | Slate blue |

### Typography

- **Cairo** — all UI text, all Arabic
- **Cormorant Garamond** — English display/hero only (never functional UI, never Arabic)

### Motion

- Spring physics (react-native-reanimated)
- Lottie on key moments: order placed, vote submitted, payment success, registration complete
- Skeleton shimmer (never spinners)
- Haptics on every interactive tap
- Respect `prefers-reduced-motion`

### Accessibility

- WCAG AA: contrast ≥ 4.5:1 (text), ≥ 3:1 (large text)
- Touch targets: 44dp min / 48dp preferred
- Dark mode is flagship; light is a user toggle

---

## Domain Model Highlights

### Shops & Products

- `ShopPhoto[]` — gallery model (not single coverUrl)
- `workingHours Json?` — per-day `{ mon: { open, close, closed }, ... }`
- `isOpen Boolean` — manual override; FE computes "open now" from schedule
- `ShopCategory` — CAFE_AND_FOOD / GROCERY / BUTCHER / SERVICES / OTHER
- Product soft delete (`isDeleted`) — preserves OrderItem FKs
- `Review` — `@@unique([userId, shopId])` — one review per resident per shop

### Orders

- `OrderItem` — snapshots `productNameSnapshot` + `productNameArSnapshot`
- `PaymentMethod` — CASH / PAYMOB
- Server computes `totalAmount` — never trusts client payload
- All items in one order must belong to same shopId — server-validated
- Resident cancel only while `status = PLACED`
- `isPaid` flipped by Paymob webhook; `cancelledAt` set on cancel

### Governance

- `AnnouncementCategory` — GENERAL / PROMOTION / EVENT / MAINTENANCE / NEWS
- Poll: one vote per resident (`@@id([userId, pollId])`)
- Election: one vote per resident (`@@id([userId, electionId])`)
- `ElectionVisibilityMode` — SEALED_UNTIL_DEADLINE / LIVE_COUNT / ADMIN_CONTROLLED
- Election auto-open: @Cron every 5min flips `resultsOpen = true` when `expiresAt` passed

### Notifications

- `NotificationPreference` — one row per user per `NotificationType`
- Expo Push sent inline (no BullMQ) — only if user preference enabled
- In-app feed stored in `Notification` DB model

---

## Infrastructure Decisions

| Concern | Dev | Prod |
|---|---|---|
| Database | Docker PostgreSQL | Neon (3GB free) |
| Cache | Docker Redis | Upstash (10K req/day free) |
| File storage | Docker MinIO | Supabase Storage (1GB free) |
| Email | Docker Mailpit | Brevo SMTP (300/day free) |
| Hosting | Local | Fly.io `cdg` Paris |
| Analytics | — | PostHog (free / self-hosted) |
| Error monitoring | — | GlitchTip (self-hosted) or Sentry free |
| Push notifications | — | Expo Push Service (free) |

**Hard rule: 100% free stack.** Every service is open-source, self-hostable, or permanent free tier.

---

## Delivery Milestones

### Backend (completed phases 1–8)

1. Foundation — clone, pnpm, Fastify, strict TS, schema, Docker, migrate, seed
2. Auth — register, OTP, login, JWT, refresh, logout, forgot/reset, invite flow
3. Core APIs — shops, photo gallery, products, orders REST + WebSocket
4. Community — announcements, reports, comments, feedback + replies
5. Governance — polls, elections, @Cron auto-open, one-vote guarantee
6. Payments — Paymob webhook, HMAC verification, mark-paid
7. Notifications — Expo Push inline + in-app feed
8. Hardening — tests, Swagger, Fly.io deploy, security audit

### Frontend (in progress)

1. ✅ Foundation — template, pnpm, Redux, i18n, RTL, providers
2. ✅ Auth & Core Shell — register, OTP, login, JWT, auth-wall, tab nav, push token
3. ✅ Business Directory — shop list, detail, reviews
4. ✅ Community Hub — announcements, governance, feedback
5. ✅ Ordering — cart, checkout, COD + Paymob, real-time tracking
6. ✅ Merchant Tools — dashboard, menu CRUD, order management
7. ✅ Polish & Launch — RTL QA, Lottie, PostHog, GlitchTip, EAS Submit

---

## Seeded Credentials (dev only)

| Account | Email | Password |
|---|---|---|
| Admin | `admin@eastpark.local` | `Admin@123456` |
| Resident | Register via app | (set during registration) |
| Merchant | Accept invite email (check Mailpit) | (set on accept-invitation screen) |
