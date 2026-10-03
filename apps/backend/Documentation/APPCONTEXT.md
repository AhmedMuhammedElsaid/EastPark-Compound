# EastPark Backend — Application Context

> Technical snapshot of `apps/backend/` as of April 2026.
> For frontend context, see `../../mobile/Documentation/APPCONTEXT.md`.
> For full project context, see `../APPCONTEXT.md`.

## Active Production Checkpoint — 2026-10-01

- Active API: `https://eastpark-backend.onrender.com` (Render free Docker, Frankfurt).
- Fly.io remains rollback infrastructure; web production now targets Render.
- Render cutover checks passed for health/Prisma, announcements, Vercel CORS, and Upstash REST.
- `PAYMENTS_ENABLED=false` keeps Paymob disabled until real production credentials are configured.
- Root scheduled workflow pings `/health` every 10 minutes to reduce free-tier sleep/cold starts.
- Transactional OTP, password-reset, invitation, and support emails are Arabic/RTL by default and
	use the official logo embedded by CID in the shared dark/gold email layout.
- App email identity is `EastPark <eastpark.eg@gmail.com>` with Reply-To/support delivery at
	`eastpark.eg@gmail.com`. `info@benayat-eg.com` remains the public company contact.
- Public throttled `POST /v1/support/issues` validates name, email, category, subject, message, and
	optional page URL, then sends the issue to support with the submitter as Reply-To. The focused
	service test passes. A web support UI has not been implemented yet.

---

## Production Snapshot — 2026-09-30

Render migration is prepared in `render.yaml` and `Documentation/RENDER.md`. The intended initial
topology is Vercel web + Render free Docker API + Supabase + Upstash. Fly remains the active API
until the Render service passes the documented cutover checks. Persistent realtime ordering and
the in-process election cron are not guaranteed while a free Render service sleeps; web ordering
must poll REST endpoints initially.

- API: `https://eastpark-backend.fly.dev` on Fly.io `cdg`
- Health: HTTP 200; Prisma `up`
- `POST /v1/residents/leads`: HTTP 200; Supabase insert verified
- Duplicate active unit: HTTP 409; atomically enforced by partial unique index
- CORS from `https://eastpark-web-app.vercel.app`: HTTP 204 preflight
- Remote Docker build and `prisma migrate deploy`: verified by execution
- Prisma migration status: all 3 migrations applied
- Database and file storage: Supabase

Production startup required keeping `.swcrc` in the Docker context, skipping Husky scripts during
the production install, explicitly generating Prisma, and replacing DTO Faker examples with static
values so no dev-only dependency is loaded at runtime.

Commit `a4ff04f` changed lead submission from contact-based idempotent updates to unit reservation.
Any non-`REJECTED` lead for the same building/floor/flat blocks another submission. The service
returns `residentLead.error.unitReserved`; a database `P2002` race maps to the same conflict.
Rejected leads remain resubmittable. The focused suite passes 38/38 and the full suite 100/100.

Operational follow-up: rotate credentials exposed during deployment and configure real Paymob
credentials before enabling card payments. The resident lead endpoint is live and not blocked.

### Web parity consumer

The deployed web app is expanding toward mobile feature parity through same-origin Next.js BFF routes.
This API's existing routes and DTO behavior are authoritative; web implementation must reuse them
instead of inventing parallel endpoints. Protected browser flows keep tokens in server-managed
`HttpOnly` cookies. The deferred parent `packages/shared` experiment is not a backend dependency;
NestJS, Prisma, auth, and transport code stay in this repository.

---

## Status

**All 8 phases + all 6 gaps + wiring fixes + post-audit patches: 100% complete. Production-ready.**

Current duplicate-unit checkpoint: `a4ff04f`. Branch: `main`.

Includes: Auth, shops, products, orders, payments (Paymob), community (announcements, polls, elections, feedback), notifications, invitations, Paymob 3-step initiation + HMAC-SHA512 webhook, Socket.io `/orders` namespace, Expo Push inline, 88% test coverage, Docker Compose, Swagger.

**Post-audit patches applied (2026-04-03):**

- `AnnouncementCreateDto` / `ReportCreateDto` — added optional `publishedAt` (server defaults to now); fixes DB constraint error on create
- `PollsService.vote` / `ElectionsService.vote` — rejects votes on expired polls/elections (400 `*.error.expired`)
- `UserService.deleteUser` — refactored to interactive transaction; now correctly cascades merchant shop data (orders, reviews, savedShops, products, photos) before deleting the user
- `PaymentsService.handleWebhook` — added Redis idempotency key (`paymob:processed:{txId}`, TTL 24h) to prevent duplicate processing on Paymob retries
- `PaymentsService.verifyHmac` — wrapped `timingSafeEqual` in try-catch (throws if buffer lengths differ)
- `AuthPublicController` — added `@Throttle({ default: { limit: 5, ttl: 60000 } })` (5 req/min on all auth routes)
- `RequestModule.ThrottlerModule` — fixed TTL from 60ms → 60 000ms (v6 uses milliseconds)
- `AnnouncementsService` — comments now include `user: { id, name }` for display; `CommentResponseDto` updated accordingly
- Docs: GUIDE.md OTP TTL 5min → 10min; HOWTORUN.md admin credentials corrected; WebSocket event name corrected (`orderStatusUpdated` → `order:status_update`)

**Seed consolidation (2026-04-08):**

- `sample.json` and `seed.ts` deleted — single seed file is now `prisma/seed-data.ts`
- `pnpm seed` → `seed-data.ts` (idempotent; skips if merchants already exist)
- Rich dataset: 5 merchants · 8 residents · 5 shops · 42 products · 14 orders · 8 announcements · 3 polls · 1 election · 8 feedback items
- Admin creation made idempotent in `seed-data.ts`
- New doc: `Documentation/WSL_NETWORKING.md` — explains WSL2 NAT, portproxy setup, and full phone→backend request flow

**Security & logic audit 2 (2026-04-08) — commit `c7dfb01`:**

- `AuthService.verifyOtp/login/acceptInvitation` — `passwordHash` + `pushToken` were returned raw in every auth response; now destructured out before returning `{ ...tokens, user }`
- `ShopsService.addPhoto/removePhoto` — no ownership check; any MERCHANT could modify any shop's photos; ownership enforced (`shop.merchantId === actor.userId`) for MERCHANT role
- `FeedbackService.findOne` — MERCHANT role could read any user's feedback; guard changed from `role === RESIDENT` to `role !== ADMIN`
- `ReviewsController GET /shops/:shopId/reviews` — missing `@PublicRoute()`, required auth; unauthenticated users got 401; fixed
- `PaymentsService.initiatePayment` — no guard against initiating Paymob on a CASH order; `paymentMethod !== PAYMOB` check added
- `PaymentsService.handleWebhook` — duplicate Paymob transaction (different `obj.id`) could re-mark an already-paid order; `if (order.isPaid) return` guard added
- `ShopsService.findAll/update` — `averageRating` was always `null`; `findAll` now does a single batch `groupBy` after fetching shops; `update` does `aggregate` after save
- `ShopPhotoResponseDto` — `isPrimary: boolean` added; derived in service as `index === 0` on the already-sorted photo array

**Remaining user action:** configure real Paymob credentials before enabling card payments.

---

## User Roles

| Role     | Access Level                                                                                                |
| -------- | ----------------------------------------------------------------------------------------------------------- |
| Guest    | No auth. Public endpoints: shop listing, announcements read, governance read.                               |
| Resident | Authenticated. Orders, reviews, polls/elections voting, feedback, profile.                                  |
| Merchant | Authenticated. Dashboard, own menu CRUD, own orders management.                                             |
| Admin    | Authenticated. All admin endpoints: invitations, announcements, polls, elections, reports, user management. |

## Hard Rules

| Rule                         | Detail                                                                       |
| ---------------------------- | ---------------------------------------------------------------------------- |
| 100% free stack              | Every service must be open-source, self-hostable, or on permanent free tier  |
| Fastify only                 | NestJS with Fastify adapter — NOT Express                                    |
| Cursor pagination everywhere | All list endpoints use `cursor` + `limit` — no page/offset                   |
| Server computes totals       | `totalAmount` computed on server — never trust client payload                |
| Soft delete products         | `isDeleted Boolean` — preserves OrderItem foreign keys                       |
| One vote enforcement         | DB `@@id([userId, pollId])` / `@@id([userId, electionId])` — no double votes |
| Auth module owns push token  | `PATCH /auth/push-token` — not `/users/me/push-token`                        |
| ConfigService for env        | Never `process.env` directly in services                                     |
| No `@types/ioredis`          | ioredis v5+ bundles types — adding @types/ioredis causes conflicts           |
| Rate limit auth routes       | `@nestjs/throttler` max 5 req/min on `/auth/*`                               |

---

## Technology Stack

| Layer         | Choice                    | Notes                                                           |
| ------------- | ------------------------- | --------------------------------------------------------------- |
| Framework     | NestJS 11                 | Fastify adapter — NOT Express                                   |
| Runtime       | Node.js ≥ 20              | pnpm@9.15.0 pinned                                              |
| ORM           | Prisma 6.19.0             | PostgreSQL 16                                                   |
| Cache         | ioredis → Redis 7         | OTP, token blacklist, rate limiting                             |
| Auth          | Passport + JWT            | argon2 hashing                                                  |
| JWT           | Two secrets               | Access 15min (`JWT_SECRET`) / Refresh 7d (`JWT_REFRESH_SECRET`) |
| WebSockets    | Socket.io                 | `/orders` namespace                                             |
| Email         | Nodemailer                | Mailpit (dev) / Brevo SMTP (prod, 300/day free)                 |
| File storage  | Supabase JS SDK           | MinIO Docker (dev) / Supabase Storage (prod, 1GB free)          |
| Push          | expo-server-sdk           | Expo Push Service inline — no queues, no BullMQ                 |
| Payments      | Paymob                    | HMAC-SHA512 webhook; COD primary, card/wallet via Paymob        |
| Logging       | nestjs-pino / pino-pretty | structured JSON in prod                                         |
| Scheduling    | @nestjs/schedule          | @Cron every 5min — election auto-open                           |
| API docs      | Swagger                   | `http://localhost:3000/docs`                                    |
| Rate limiting | @nestjs/throttler         | Max 5 req/min on all `/auth/*` endpoints                        |
| Hosting       | Fly.io `cdg` (Paris)      | `auto_stop_machines = false`, min 1 machine always on           |
| Env config    | ConfigService             | Never raw `process.env` in services                             |

---

## Docker Compose Services (dev)

| Container             | Image                    | Port(s)                  | Purpose                                     |
| --------------------- | ------------------------ | ------------------------ | ------------------------------------------- |
| `eastpark-postgres`   | `postgres:16-alpine`     | 5432                     | Primary database                            |
| `eastpark-redis`      | `redis:7-alpine`         | 6379                     | OTP / token blacklist / rate limiting       |
| `eastpark-mailpit`    | `axllent/mailpit:latest` | 1025 (SMTP), 8025 (UI)   | Catches all outbound email                  |
| `eastpark-minio`      | `minio/minio:latest`     | 9000 (S3 API), 9001 (UI) | S3-compatible file storage                  |
| `eastpark-minio-init` | `minio/mc:latest`        | —                        | One-shot: creates `eastpark-uploads` bucket |

Named volumes: `eastpark-postgres-data`, `eastpark-redis-data`, `eastpark-minio-data`.
MinIO credentials: set via `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD` env vars (see `docker-compose.yml`). Bucket: `eastpark-uploads`.

---

## Environment Variables

| Variable                    | Dev Default                                                         | Required  |
| --------------------------- | ------------------------------------------------------------------- | --------- |
| `POSTGRES_PASSWORD`         | **Must set** (used by docker-compose + DATABASE_URL)                | Yes       |
| `DATABASE_URL`              | `postgresql://postgres:<POSTGRES_PASSWORD>@localhost:5432/eastpark` | Yes       |
| `REDIS_URL`                 | `redis://localhost:6379`                                            | Yes       |
| `AUTH_ACCESS_TOKEN_SECRET`  | **Must generate** (`openssl rand -base64 48`)                       | Yes       |
| `AUTH_REFRESH_TOKEN_SECRET` | **Must generate** (different from above)                            | Yes       |
| `AUTH_ACCESS_TOKEN_EXP`     | `15m`                                                               | No        |
| `AUTH_REFRESH_TOKEN_EXP`    | `7d`                                                                | No        |
| `BFF_INTERNAL_SECRET`       | (blank — BFF client IPs not trusted); prod: shared with web BFF     | Prod only |
| `SMTP_HOST`                 | `localhost`                                                         | Yes       |
| `SMTP_PORT`                 | `1025`                                                              | Yes       |
| `SMTP_USER`                 | (blank for dev)                                                     | Prod only |
| `SMTP_PASS`                 | (blank for dev)                                                     | Prod only |
| `EMAIL_FROM`                | `noreply@eastpark.app`                                              | Yes       |
| `SUPABASE_URL`              | `http://localhost:9002` (MinIO)                                     | Yes       |
| `SUPABASE_SERVICE_KEY`      | **Must set** (same as `MINIO_ROOT_PASSWORD` for dev)                | Yes       |
| `SUPABASE_BUCKET`           | `eastpark-uploads`                                                  | Yes       |
| `MINIO_ROOT_USER`           | `minioadmin`                                                        | Dev only  |
| `MINIO_ROOT_PASSWORD`       | **Must set** (used by docker-compose)                               | Dev only  |
| `SEED_ADMIN_PASSWORD`       | **Must set** (for `pnpm seed`)                                      | Dev only  |
| `SEED_MERCHANT_PASSWORD`    | **Must set** (for `pnpm seed`)                                      | Dev only  |
| `SEED_RESIDENT_PASSWORD`    | **Must set** (for `pnpm seed`)                                      | Dev only  |
| `PAYMOB_API_KEY`            | (blank)                                                             | Prod only |
| `PAYMOB_HMAC_SECRET`        | (blank)                                                             | Prod only |
| `PAYMOB_INTEGRATION_ID`     | (blank)                                                             | Prod only |
| `PAYMOB_IFRAME_ID`          | (blank)                                                             | Prod only |
| `APP_URL`                   | `http://localhost:3000`                                             | Yes       |
| `HTTP_HOST`                 | `0.0.0.0`                                                           | No        |
| `HTTP_PORT`                 | `3000`                                                              | No        |
| `APP_LOG_LEVEL`             | `debug`                                                             | No        |

> All env vars accessed via `ConfigService` — never `process.env` directly in services.
> Do NOT install `@types/ioredis` — ioredis v5+ bundles its own types.

---

## API Structure

All routes are prefixed `/v1`. Auth endpoints rate-limited to 5 req/min.

### Auth (`/v1/auth`)

- No public self-registration (removed 2026-10-03): residents submit `POST /residents/leads`, an admin
  invites them, and `POST /accept-invitation` creates the account.
- `POST /login` → email + password (no passwordless/OTP login)
- `POST /refresh` → access token refresh via refresh token
- `POST /logout` → blacklist refresh token in Redis
- `POST /forgot-password` → reset link email (reset token in Redis, 30min TTL)
- `POST /reset-password` → verify token + set new password
- `PATCH /push-token` → register/update Expo push token after login
- `POST /invite` → [admin] send merchant/admin invite email (one-time signed token)
- `POST /accept-invitation` → accept invite → set name + password

### Users (`/v1/user`)

- `GET /profile` → current user profile
- `PUT /` → update profile
- `DELETE /` → self-delete account _(endpoint planned — see note below)_

> **Note:** `DELETE /user` self-delete endpoint is pending implementation on the backend. The frontend profile screen already calls it. Current BE only has `DELETE /admin/user/:id` (admin-only).

### Shops (`/v1/shops`)

- Cursor-paginated list + filters (category, search, open-now)
- Photo gallery (`ShopPhoto[]`), working hours, reviews, saved shops

### Products (`/v1/products`)

- Soft delete (`isDeleted`) — preserves `OrderItem` FKs
- All items in one order must belong to same `shopId` — server-validated

### Orders (`/v1/orders`)

- Server computes `totalAmount` — never trusts client payload
- `OrderItem` snapshots: `productNameSnapshot` + `productNameArSnapshot`
- `POST /orders/:id/pay/paymob` → Paymob 3-step initiation → returns `{ paymentKey, iframeUrl }`
- `PATCH /orders/:id/cancel` → resident cancel (only while `status = PLACED`)
- WebSocket `/orders` namespace → emits `orderStatusUpdated`

### Community (`/v1/community`)

- Announcements (categories: GENERAL / PROMOTION / EVENT / MAINTENANCE / NEWS)
- Official PDF reports (separate from announcements)
- Comments on announcements
- Feedback + reply threads (`FeedbackReply.authorId` FK → admin User)
- Anonymous feedback: `isAnonymous` hides the author from other residents and public views only. Owner decision: admins DO see the author (`userId` / author is included in admin responses) — see root `CLAUDE.md` "Feedback" section

### Governance (`/v1/governance`)

- Polls — one vote per resident (`@@id([userId, pollId])`)
- Elections — one vote per resident (`@@id([userId, electionId])`)
- `ElectionVisibilityMode`: SEALED_UNTIL_DEADLINE / LIVE_COUNT / ADMIN_CONTROLLED
- `@Cron` every 5min: flips `resultsOpen = true` when `expiresAt` passed
- `POST /elections/:id/candidates` [admin] — add candidates separately

### Notifications (`/v1/notifications`)

- `NotificationPreference` — one row per user per `NotificationType`
- Expo Push sent inline (no BullMQ) — only if user preference enabled
- In-app feed stored in `Notification` DB model
- `GET/PUT /notifications/preferences` — manage per-type opt-in

### Webhooks (`/v1/webhooks`)

- `POST /webhooks/paymob` — HMAC-SHA512 verified + idempotency via Redis → flips `Order.isPaid`

### Admin (`/v1/admin`)

- `DELETE /admin/user/:id` — admin-only user deletion
- Full access to all resources + `AuditLog` DB model for governance events

### Merchant (`/v1/merchant`)

- `PATCH /merchant/orders/:id/status` — update order status
- Menu CRUD, order management

---

## Key Domain Rules

### Auth

- Register: name + email + phone + unitNumber + password → Email OTP → verified
- Login: email + password only — no passwordless, no OTP login
- Forgot password: reset token in Redis (30min TTL) → email link → reset screen
- JWT: `JWT_SECRET` (access 15min) + `JWT_REFRESH_SECRET` (refresh 7d)
- Logout: blacklist refresh token in Redis
- Merchant/Admin: one-time signed token → `accept-invitation` screen → name + password

### Orders

- Server always computes `totalAmount` — client total never trusted
- All items in one order must belong to same `shopId`
- Resident cancel only while `status = PLACED`
- `isPaid` flipped exclusively by Paymob webhook

### Governance

- One vote per resident per poll — enforced by `@@id([userId, pollId])`
- One vote per resident per election — enforced by `@@id([userId, electionId])`
- Candidate has `nameAr` + `statementAr` fields

### Files

- Images: max 5 MB (jpg/png/webp)
- PDFs: max 20 MB
- Stored in MinIO locally, Supabase Storage in prod

### Pagination

- Cursor-based on ALL list endpoints — `cursor` + `limit` query params
- Frontend uses `useInfiniteQuery` with `getNextPageParam`

---

## Notable DB Models

| Model                    | Notes                                                           |
| ------------------------ | --------------------------------------------------------------- |
| `AuditLog`               | Admin actions + governance events                               |
| `Invitation`             | One-time signed token; tracks `usedAt` + `expiresAt`            |
| `Report`                 | Separate from `Announcement` — official compound PDF reports    |
| `NotificationPreference` | One row per user per `NotificationType`                         |
| `SavedShop`              | `@@id([userId, shopId])` — resident bookmarks                   |
| `Review`                 | `@@unique([userId, shopId])` — one review per shop per resident |
| `ShopPhoto`              | Gallery model — not single `coverUrl`                           |

---

## Infrastructure (Dev vs Prod)

| Concern      | Dev                         | Prod                             |
| ------------ | --------------------------- | -------------------------------- |
| Database     | Docker `postgres:16-alpine` | Supabase PostgreSQL (500MB free) |
| Cache        | Docker `redis:7-alpine`     | Upstash Redis (10K req/day free) |
| File storage | Docker MinIO                | Supabase Storage (1GB free)      |
| Email        | Docker Mailpit              | Brevo SMTP (300/day free)        |
| Hosting      | Local (`pnpm dev`)          | Fly.io `cdg` (Paris)             |

**Hard rule: 100% free stack.** Every service is open-source, self-hostable, or permanent free tier.

---

## Production Build

Multi-stage Dockerfile on `node:20-alpine`. Dockerfile CMD on container start:

```dockerfile
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]
```

Fly.io config (`fly.toml`): app `eastpark-backend`, region `cdg`, 256 MB RAM, 1 shared CPU, `auto_stop_machines = false`.

---

## Delivery Milestones (all complete)

1. Foundation — clone `hmake98/nestjs-starter` → pnpm → Fastify → strict TS → schema → Docker → migrate → seed
2. Auth — register, OTP, login, JWT, refresh, logout, forgot/reset password, invite flow
3. Core APIs — shops, photo gallery, products, orders REST + WebSocket
4. Community — announcements, reports, comments, feedback + replies
5. Governance — polls, elections, @Cron auto-open, one-vote guarantee
6. Payments — Paymob 3-step initiation + HMAC webhook, mark-paid
7. Notifications — Expo Push inline + in-app notification feed
8. Hardening — 62 unit tests (~88% coverage), Swagger, Fly.io deploy, security audit

---

## Commit Convention

```
[AhmedMuhammedElsaid][feat|fix|chore|docs]: description
```
