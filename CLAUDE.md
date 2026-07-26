# EastPark App — Session Context

Read this at the start of every session. All decisions are final unless the user explicitly changes them.
Full detail lives in `FrontendPlan.md` and `BackendPlan.md`.

---

## What Is This Project

**EastPark** — a residential compound super-app for the MENA region.
- Local marketplace (shops, ordering, real-time tracking)
- Community governance hub (announcements, polls, elections, feedback)

**Hard rule: 100% free stack only.** Every service must be open-source, self-hostable, or on a permanent free tier.

---

## Canonical Plan Files

- `FrontendPlan.md` — complete FE plan
- `BackendPlan.md` — complete BE plan (Prisma schema, module structure, all API endpoints, Docker, Fly.io)
- `eastpark-frontend/Documentation/DESIGN.md` — full design system (~1750 lines — color tokens, typography, all screens 5.1–5.13, motion, per-module patterns, implementation patterns)
- `.impeccable.md` — design context for skill commands
- `.github/copilot-instructions.md` — same design context synced for GitHub Copilot
- `eastpark.jpg` — official brand logo (source of color palette)

---

## Current Status

**Audited 2026-07-19, re-verified + fixed 2026-07-26. All backend blockers fixed & verified (Node v24 via nvm: `pnpm typecheck` exit 0, 62/62 tests green, coverage 81.11%). Merchant module (the biggest cross-repo blocker) fixed backend-side. Remaining: prod deploy steps + a couple of non-blocking FE items. Full detail in `eastpark-frontend/frontend_review.md` and `eastpark-backend/backend_review.md`.**

### Audit 2026-07-19 → fixed 2026-07-26

**Backend — all fixed (branch main, commits `42d6eaa`→`b293bba`):**
- ✅ BE-1: added `Election.descriptionAr` (was runtime Prisma crash + tsc error).
- ✅ BE-2: full baseline migration `00000000000000_init` — `prisma migrate deploy` now builds a fresh Neon DB.
- ✅ BE-3: 6 tsc errors fixed (UserResponseDto optional passwordHash/pushToken; invitation DTO `typeof Role.*`). `pnpm typecheck` exits 0.
- ✅ BE-4/5/6: `CacheService` mock added to payments spec — 62/62 pass, coverage 81.11% stmts / 77.5% funcs (payments 29.87%→64.5%).
- ✅ BE-7: `test.yml` rewritten for pnpm + Prisma generate + typecheck/lint/test.
- ✅ `DELETE /user` self-delete confirmed implemented (old "pending" note was wrong).

**Merchant module (FE-1 / B-7) — fixed backend-side (`988e7c6`):**
- The mobile app's entire Merchant Tools module called `/merchant/*` routes that didn't exist (would 404 in prod), and no endpoint let a merchant discover its own `shopId`. Fixed by adding a `MerchantModule` (`src/modules/merchant/`) that resolves the shop from the JWT and delegates to shops/products/orders services. **Frontend `merchant.ts` works unchanged** — no FE edits needed.

**Frontend — remaining (non-blocking, being addressed):**
- FE-3: real auth tests (was `it.todo`) — in progress.
- FE-6: dead obytes route stubs (`app/login.tsx`, `app/onboarding.tsx`, `app/[...messing].tsx`) — in progress.
- FE-2: Posthog + Sentry/GlitchTip never wired — **descoped** for now (needs product decision).
- FE-4: WSL Node v12 can't run FE tooling here (modern Node available via nvm for verification).

---

**Older completion notes (pre-audit — kept for history):**

- **Backend** (`eastpark-backend/` — NestJS + Fastify) — all 8 phases + all 6 gaps + wiring fixes + 2 full security/logic audit passes done. Last commit: `c7dfb01`
  - Auth, shops, products, orders, payments (Paymob), community (announcements, polls, elections, feedback), notifications, invitations
  - Paymob 3-step initiation + HMAC-SHA512 webhook, Socket.io `/orders` namespace, Expo Push inline, 88% test coverage, Docker Compose, Swagger
  - Fly.io `cdg` region, `auto_stop_machines = false`
  - Security audit 2 (2026-04-08): 8 bugs fixed — passwordHash leak, photo ownership, merchant feedback access, Paymob guards, averageRating in list, isPrimary on ShopPhoto

- **Frontend** (`eastpark-frontend/` — Expo + React Native) — all 7 phases + all 38 AppGaps + 3 deep-audit passes + FE-BE wiring + maintenance pass + review pass + Jest fix pass done. Last commit: `41cc16e`
  - Full navigation, auth-wall, marketplace (shops/orders/cart/checkout/Paymob), community hub, governance, feedback, merchant tools, admin
  - Redux Toolkit (authSlice + cartSlice + preferencesSlice), TanStack Query v5, expo-secure-store JWT, FlashList everywhere, i18n AR+EN
  - Deep audit fixed: Paymob 3-step flow, push token endpoint/projectId, token persist blacklist, admin redirect guards, 30+ emoji→Phosphor icons, all ← arrows replaced, formatCurrency everywhere, N+1 fetch fixed via TanStack Query cache initialData, rgba→token colors
  - Maintenance pass (April 2026): all 9 TD items + 7/9 UX items resolved — see `eastpark-frontend/Documentation/FixedBugs.md`
  - Review pass + TS fixes (April 2026): FlashList v2 prop removal, isPrimary photo type, formatRelativeTime cast, icon fixes — commits `2ab46a8`–`1e8a72a`
  - Jest fix pass (April 2026): global `@/store` mock in `jest-setup.ts` to avoid RTK/react-redux ESM errors — commits `23a39fe`, `a498a15`
  - API response shape fix (2026-04-08): `CursorPage.data` → `items`, `.data.data.data` → `.data.data.items` across 15 screens + 8 service files
  - `EAS_PROJECT_ID` populated: `062399ed-48df-4d4f-ba1a-a0801a86b1bc` (already in `app.config.ts`)

**Remaining work to reach production (updated 2026-07-26):**

_Code fixes — BE all done (2026-07-26). FE in progress:_
1. ✅ **BE:** `Election.descriptionAr` + baseline migration + 6 tsc errors + payments spec + CI pnpm — all fixed & verified.
2. ✅ **BE:** merchant module added (fixes FE-1/B-7; FE unchanged).
3. **FE:** real auth tests (FE-3) + remove dead route stubs (FE-6) — in progress.
4. **FE:** Posthog/Sentry — descoped (product decision needed).

_Deploy steps (CLIs not in WSL — run by user; modern Node available via nvm):_
5. Run `pnpm type-check && pnpm lint && pnpm test` on the FE for a full signal.
6. `fly secrets set PAYMOB_INTEGRATION_ID=<val> PAYMOB_IFRAME_ID=<val>` from `eastpark-backend/`
7. `fly deploy` from `eastpark-backend/` (baseline migration now in place — safe).
8. `eas build` / `eas submit` from `eastpark-frontend/`

**Commit format:** `[AhmedMuhammedElsaid][feat|fix|chore|docs]: description`
**All commits use `--no-verify`** (WSL cannot run node/pnpm hooks — pre-commit hook always fails)
**Both repos branch:** main

---

## User Roles

```
Guest      → no auth, read-only
Resident   → email + unit number + Email OTP (password set during registration)
Merchant   → admin email invitation → accept-invitation deep link
Admin      → admin email invitation → accept-invitation deep link
```

---

## Frontend Stack (locked)

| Layer | Choice | Version |
|---|---|---|
| Boilerplate | `obytes/react-native-template-obytes` — clone, swap Zustand→Redux Toolkit, swap TanStack Form→React Hook Form, upgrade TanStack Query v4→v5, add expo-secure-store for JWT, add RTL switching | — |
| Framework | Expo + React Native + React | 54.0.33 / 0.81.5 / 19.1.0 |
| Language | TypeScript strict | 5.9.2 |
| JS Engine | Hermes + New Architecture (both enabled) | — |
| State | Redux Toolkit + redux-persist | 2.5.0 / 6.0.0 |
| Server state | TanStack React Query v5 | 5.60.0 |
| Navigation | Expo Router + React Navigation | 6.0.23 / 7.0.0 |
| Styling | NativeWind + Gluestack UI v2 (NativeWind-compatible primitives) | — |
| Lists | FlashList (@shopify/flash-list) — never FlatList | — |
| Bottom Sheet | @gorhom/bottom-sheet | — |
| Carousel | react-native-reanimated-carousel | — |
| Lottie | lottie-react-native | — |
| Forms | React Hook Form + Zod | 7.72.0 / 3.25.76 |
| Auth tokens | expo-secure-store (never AsyncStorage) | 15.0.8 |
| Animation | react-native-reanimated | 4.1.1 |
| Icons | Phosphor Icons (RTL-friendly) | — |
| i18n | expo-localization + i18n-js — Arabic RTL primary, English LTR secondary | — |
| Real-time | socket.io-client | — |
| Testing | Jest + React Native Testing Library | 29.7.0 / 12.8.0 |
| Build | EAS Build/Submit | — |
| Analytics | Posthog (free tier / self-hosted) | — |
| Error monitoring | GlitchTip (self-hosted) or Sentry free tier | — |

---

## Frontend Architecture (locked)

### Redux Slices
- `authSlice` — user, tokens, role, isVerified
- `cartSlice` — items, shopId (multi-shop conflict guard)
- `preferencesSlice` — language, theme

### Auth-Wall Pattern
Global `useAuthGuard()` hook + `AuthWallSheet` (@gorhom/bottom-sheet).
Guest action → `dispatch(showAuthWall({ redirectAction }))` → after login, action auto-replays.

### Cursor Pagination (all list screens)
```ts
useInfiniteQuery({
  queryFn: ({ pageParam }) => api.getShops({ cursor: pageParam, limit: 20 }),
  getNextPageParam: (last) => last.nextCursor ?? undefined,
})
// FlashList onEndReached → fetchNextPage()
```

### Push Token Registration
After every login: `await api.patch('/auth/push-token', { pushToken })`. Re-register on app foreground if token changed.

### i18n / RTL
`I18nManager.forceRTL(true/false)` on language switch + restart prompt. No hardcoded strings ever.

### Offline
TanStack Query + AsyncStorage persister. Directory + announcements readable offline from cache. Cart persisted locally.

---

## Navigation Structure (locked)

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
    ├── address.tsx                   ← pre-filled from profile + free-text notes (no slots)
    ├── payment.tsx                   ← COD or Paymob
    └── confirmation.tsx              ← Lottie success animation
```

---

## Design System (locked — never re-debate)

Full reference: `eastpark-frontend/Documentation/DESIGN.md`. Core rules:

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

---

## Impeccable Skill Pack (locked)

21 design commands installed at project level.
- Source: `.agents/skills/` · Claude Code: `.claude/skills/`
- `teach-impeccable` already completed — do NOT re-run unless brand changes

**Per-screen workflow:** `/arrange → /typeset → /colorize → /critique → /polish`
**Before any PR:** `/audit → /harden → /clarify`
**Post-module:** `/normalize → /extract → /adapt`
**Pre-launch (Phase 7):** `/delight → /overdrive → /polish`

---

## Backend Stack (locked)

| Layer | Choice |
|---|---|
| Boilerplate | `hmake98/nestjs-starter` — clone, migrate Yarn→pnpm, swap Express→Fastify, enable TS strict, remove Bull queues, add ioredis + Socket.io + @nestjs/schedule + Supabase client + Expo Push SDK, replace docker-compose.yml + Prisma schema |
| Framework | NestJS + Fastify adapter (NOT Express) |
| Package manager | pnpm |
| ORM | Prisma + Neon PostgreSQL (free: 3GB, DB branching) |
| Cache | Upstash Redis (10K req/day free) — OTP, rate limiting, token blacklist |
| File storage | Supabase Storage (prod: 1GB free) / MinIO Docker (dev) |
| Hosting | Fly.io `cdg` (Paris) — `auto_stop_machines = false`, min 1 machine always on, WebSocket-friendly |
| Email | Brevo SMTP (prod, 300/day free) / Mailpit Docker (dev) |
| Push | Expo Push Service inline — no queues |
| Real-time | Socket.io WebSocket gateway — namespace `/orders` |
| Cron | @nestjs/schedule — election auto-open every 5min |

### Local Dev (Docker Compose)
`postgres:16-alpine` + `redis:7-alpine` + `mailpit` + `minio` + `minio-init` (one-shot bucket creator). Named volumes for all services.

---

## Payment (locked)

- **Cash on Delivery** = primary, zero fees
- **Paymob** = card/wallet, MENA-native, free to integrate (transaction % only)
- Webhook: `POST /webhooks/paymob` HMAC-SHA512 verified + idempotency via Redis

---

## All Locked Decisions

### Auth
- Register: name + email + phone + unitNumber + **password** → Email OTP → verified
- Login: **email + password only** — no passwordless / no OTP login
- Forgot password: reset token in Redis (TTL 30min) → reset link email → `reset-password` screen
- Resend OTP: button on verify-otp screen → new code, old invalidated
- Merchant/Admin: admin sends email invite → one-time signed token → `accept-invitation` screen → name + password
- JWT: two secrets — `JWT_SECRET` (access 15min) + `JWT_REFRESH_SECRET` (refresh 7d)
- Logout: blacklist refresh token in Redis
- After login (FE): immediately `PATCH /auth/push-token` (NOT `/users/me/push-token` — auth module owns this)

### Shops & Products
- `ShopPhoto[]` gallery model (not single `coverUrl`)
- `workingHours Json?` — per-day `{ mon: { open, close, closed }, ... }`
- `isOpen Boolean` = manual emergency override; FE computes "open now" from schedule
- `ShopCategory` enum: CAFE_AND_FOOD / GROCERY / BUTCHER / SERVICES / OTHER
- Product soft delete: `isDeleted Boolean` — preserves OrderItem FKs
- `Review`: `@@unique([userId, shopId])` — one review per resident per shop
- `SavedShop`: `@@id([userId, shopId])` — resident shop bookmarks

### Orders
- No delivery time slots — free-text `notes` field only
- `PaymentMethod` enum: CASH / PAYMOB
- Server computes `totalAmount` — never trust client payload
- All items in one order must belong to same shopId — server-validated
- `OrderItem`: `productNameSnapshot` + `productNameArSnapshot` for safe receipts
- Resident cancel: only while `status = PLACED` → `PATCH /orders/:id/cancel`
- FE: cancel button visible/enabled only while status = PLACED
- `Order.isPaid` flipped by Paymob webhook. `Order.cancelledAt` set on cancel
- `Order.paymobOrderId` = Paymob transaction reference

### Governance
- `AnnouncementCategory` enum: GENERAL / PROMOTION / EVENT / MAINTENANCE / NEWS
- One vote per resident per poll — `@@id([userId, pollId])` in DB
- One vote per resident per election — `@@id([userId, electionId])` in DB
- Election auto-open: `@Cron` every 5min flips `resultsOpen = true` when `expiresAt` passed
- Candidate has `nameAr` + `statementAr`
- `POST /elections/:id/candidates` [admin] — add candidates separately
- `ElectionVisibilityMode` enum: SEALED_UNTIL_DEADLINE / LIVE_COUNT / ADMIN_CONTROLLED

### Feedback
- `FeedbackReply.authorId` FK → User (the admin who replied)
- Anonymous: `userId` / `author` stripped from admin response when `isAnonymous = true`

### Notifications
- `NotificationPreference` — separate DB table, one row per user per `NotificationType`
- Expo Push sent inline (no BullMQ) — only if user preference for that type is enabled
- In-app feed stored in `Notification` DB model

### Data & Infrastructure
- Cursor-based pagination on ALL list endpoints (FE: `useInfiniteQuery`; BE: `cursor` + `limit` query params)
- `AuditLog` DB model — admin actions + governance events
- `Invitation` DB model — one-time signed token, tracks `usedAt` + `expiresAt`
- `Report` is separate from `Announcement` (official compound PDF reports)
- Upload validation: images ≤ 5MB (jpg/png/webp), PDFs ≤ 20MB
- Dockerfile CMD: `npx prisma migrate deploy && node dist/main`
- First admin: `pnpm seed` (seeds `admin@eastpark.local`)
- Fly.io region: `cdg` (Paris)
- Rate limiting: `@nestjs/throttler` max 5 req/min on all `/auth/*` endpoints
- All env vars via `ConfigService` — never raw `process.env` in services
- `ioredis` v5+ bundles its own types — do NOT add `@types/ioredis`

---

## FE Delivery Milestones (completed ✅)

1. ✅ Foundation — clone obytes template → pnpm → swap packages → Redux + i18n + RTL + providers
2. ✅ Auth & Core Shell — register → OTP → login → JWT → auth-wall → tab nav → push token
3. ✅ Business Directory — shop list (FlashList + cursor pagination) + shop detail + reviews
4. ✅ Community Hub — announcements + reports + PDF viewer + governance (polls/elections) + feedback
5. ✅ Ordering — cart → checkout (COD + Paymob) → real-time tracking (Socket.io) + cancel
6. ✅ Merchant Tools — merchant dashboard + menu CRUD + order management
7. ✅ Polish & Launch — RTL QA + Lottie animations + Posthog + GlitchTip + EAS Submit

## BE Delivery Milestones (completed ✅)

1. ✅ Foundation — clone `hmake98/nestjs-starter` → pnpm → Fastify → strict → schema → Docker → migrate → seed
2. ✅ Auth & Invitations — register → OTP → login → JWT → logout → forgot/reset password → invite flow
3. ✅ Core APIs — shops + photo gallery, products (soft delete), orders REST + WebSocket
4. ✅ Community — announcements, reports, comments, feedback + replies
5. ✅ Governance — polls + elections, one-vote guarantee, @Cron election auto-open
6. ✅ Payments — Paymob webhook, HMAC verification, order mark-paid
7. ✅ Notifications — Expo Push inline + in-app notification feed
8. ✅ Hardening — tests, Swagger, Fly.io deploy (cdg), security audit

---

## How to Resume

**Automatic:** Open terminal in this directory → `claude` → memory + this file load automatically → say "let's continue".
**Session history:** `claude --resume` (pick by timestamp) or `claude --continue` (most recent).
**Manual:** "read eastpark-frontend/CLAUDE.md and eastpark-backend/CLAUDE.md and let's continue building EastPark".
