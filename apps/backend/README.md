# EastPark Backend

REST + WebSocket API for the EastPark residential compound super-app — marketplace, community governance, real-time order tracking, and Paymob payments.

**Stack:** NestJS 11 · Fastify · Prisma 6 · PostgreSQL · Redis · Socket.io · Expo Push · Supabase Storage · Brevo SMTP · Fly.io

---

## Table of Contents

1. [Architecture](#architecture)
2. [Prerequisites](#prerequisites)
3. [Local Development](#local-development)
4. [Environment Variables](#environment-variables)
5. [Database](#database)
6. [Running the App](#running-the-app)
7. [API Documentation](#api-documentation)
8. [Testing](#testing)
9. [Deployment — Fly.io](#deployment--flyio)
10. [Debugging](#debugging)
11. [Project Structure](#project-structure)
12. [Troubleshooting](#troubleshooting)

---

## Architecture

```
Mobile App (Expo React Native)
           │
           ▼
    Fly.io — Docker Container (cdg / Paris)
    ┌────────────────────────────────────┐
    │  NestJS 11 + Fastify adapter       │
    │  ├── REST API v1  (/v1/*)          │
    │  ├── WebSocket    (/orders ns)     │
    │  └── Webhook      (/v1/webhooks/*) │
    └───────────────┬────────────────────┘
                    │
       ┌────────────┼──────────┐
       ▼            ▼          ▼
  Supabase     Upstash     Supabase
  Postgres     Redis       Storage
                    │
            Brevo SMTP   Expo Push
```

| Layer | Dev (Docker Compose) | Prod (free tier) |
|---|---|---|
| Database | `postgres:16-alpine` | Supabase Postgres (500 MB) |
| Cache / OTP | `redis:7-alpine` | Upstash Redis (10 K req/day) |
| File storage | MinIO | Supabase Storage (1 GB) |
| Email | Mailpit (SMTP UI) | Brevo SMTP (300/day) |
| Push | — | Expo Push Service |
| Hosting | local | Fly.io `cdg` (Paris) |

---

## Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Node.js | ≥ 20 | Use [nvm](https://github.com/nvm-sh/nvm) |
| pnpm | ≥ 9 | `npm i -g pnpm` |
| Docker Desktop | latest | Required for local services |

---

## Local Development

### 1 — Clone and install

```bash
git clone <repo-url>
cd apps/backend
pnpm install
```

### 2 — Environment

```bash
cp .env.example .env
```

Open `.env` and fill in at minimum:

```env
# Generate two different secrets (required):
#   openssl rand -base64 48
AUTH_ACCESS_TOKEN_SECRET="<paste-generated-secret>"
AUTH_REFRESH_TOKEN_SECRET="<paste-different-secret>"

# Docker service passwords (required — no defaults):
POSTGRES_PASSWORD="<choose-a-password>"
MINIO_ROOT_PASSWORD="<choose-a-password>"

# Paste POSTGRES_PASSWORD into DATABASE_URL:
DATABASE_URL="postgresql://postgres:<your-password>@localhost:5432/eastpark?schema=public"

# Set SUPABASE_SERVICE_KEY to the same value as MINIO_ROOT_PASSWORD:
SUPABASE_SERVICE_KEY="<same-as-MINIO_ROOT_PASSWORD>"

# Set seed passwords for local dev accounts:
SEED_ADMIN_PASSWORD="<choose-a-password>"
SEED_MERCHANT_PASSWORD="<choose-a-password>"
SEED_RESIDENT_PASSWORD="<choose-a-password>"

# Everything else has sensible defaults for local Docker dev.
# See .env.example for all variables and inline documentation.
```

### 3 — Start local services

```bash
docker-compose up -d
```

This starts:
- **PostgreSQL 16** on `localhost:5432`
- **Redis 7** on `localhost:6379`
- **Mailpit** SMTP on `localhost:1025` · Web UI on `localhost:8025`
- **MinIO** S3-compatible on `localhost:9000` · Console on `localhost:9001`
- **minio-init** — one-shot container that creates the `eastpark-uploads` bucket

Verify all containers are healthy:

```bash
docker-compose ps
```

### 4 — Run migrations and seed

```bash
# Create the database schema
pnpm prisma:migrate

# Seed dev users (admin, merchants, residents)
pnpm seed
# Credentials are set via SEED_ADMIN_PASSWORD, SEED_MERCHANT_PASSWORD,
# SEED_RESIDENT_PASSWORD in your .env file.

# Add or refresh showcase shops, products, announcements, a poll, and an election
pnpm seed:showcase
```

### 5 — Start the API

```bash
pnpm dev
```

The API is now at:

| URL | What |
|---|---|
| `http://localhost:3000/v1` | REST API |
| `http://localhost:3000/docs` | Swagger UI |
| `ws://localhost:3000/orders` | WebSocket namespace |
| `http://localhost:8025` | Mailpit — see OTP emails |
| `http://localhost:9001` | MinIO Console — see uploads |

---

## Environment Variables

Full reference is in `.env.example`. Every variable is documented with inline comments.

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | Supabase transaction pooler `:6543` (prod) or `postgresql://...@localhost:5432/eastpark` (dev) |
| `DIRECT_DATABASE_URL` | Yes | Migrations only. Supabase session pooler `:5432` (prod); same as `DATABASE_URL` in dev |
| `REDIS_URL` | Yes | `redis://localhost:6379` (dev) · `rediss://...upstash.io` (prod) |
| `AUTH_ACCESS_TOKEN_SECRET` | Yes | JWT access token secret — min 32 chars |
| `AUTH_REFRESH_TOKEN_SECRET` | Yes | JWT refresh token secret — must differ from access |
| `AUTH_ACCESS_TOKEN_EXP` | No | Default `15m` |
| `AUTH_REFRESH_TOKEN_EXP` | No | Default `7d` |
| `AUTH_RESET_TOKEN_TTL_SEC` | No | Password-reset token TTL. Default `1800` (30 min) |
| `SMTP_HOST` | Yes | `localhost` (dev via Mailpit) · `smtp-relay.brevo.com` (prod) |
| `SMTP_PORT` | Yes | `1025` (Mailpit) · `587` (Brevo) |
| `SMTP_USER` | Prod | Brevo SMTP login |
| `SMTP_PASS` | Prod | Brevo SMTP key |
| `EMAIL_FROM` | Yes | Sender address |
| `SUPABASE_URL` | Yes | `http://localhost:9000` (dev MinIO) · Supabase project URL (prod) |
| `SUPABASE_SERVICE_KEY` | Yes | MinIO root password (dev) · Supabase service role key (prod) |
| `SUPABASE_BUCKET` | Yes | `eastpark-uploads` |
| `PAYMOB_API_KEY` | Prod | Paymob API key |
| `PAYMOB_HMAC_SECRET` | Prod | Used for webhook HMAC-SHA512 verification |
| `APP_URL` | Yes | `http://localhost:3000` (dev) · `https://eastpark-backend.fly.dev` (prod) |
| `HTTP_PORT` | No | Default `3000` |
| `APP_LOG_LEVEL` | No | `debug` (dev) · `info` (prod) |

---

## Database

### Common Prisma commands

```bash
# Generate Prisma client after schema changes
pnpm prisma:generate

# Create + apply a new migration (dev)
pnpm prisma:migrate
# Prompted for a migration name — e.g. "add_shop_category"

# Apply existing migrations without creating new ones (prod)
pnpm prisma:migrate-prod

# Open Prisma Studio (visual DB browser)
pnpm prisma:studio

# Seed the first admin user
pnpm seed
```

### Schema location

`prisma/schema.prisma` — contains all models, enums, and relations.

### Resetting the database (dev only)

```bash
# Drop everything and re-migrate
docker-compose down -v              # destroys postgres volume
docker-compose up -d postgres redis
pnpm prisma:migrate
pnpm seed
```

---

## Running the App

| Command | Description |
|---|---|
| `pnpm dev` | Hot-reload development server |
| `pnpm build` | Compile TypeScript → `dist/` |
| `pnpm start` | Run compiled `dist/main.js` |
| `pnpm debug` | Dev server with Node.js debugger on port `9229` |
| `pnpm lint` | ESLint + auto-fix |
| `pnpm format` | Prettier format |
| `pnpm test` | Unit tests (see [Testing](#testing)) |

---

## API Documentation

Swagger UI is available at `/docs` when the server is running.

**Live:** `http://localhost:3000/docs`

To authenticate in Swagger:
1. Call `POST /v1/auth/register` → verify OTP → `POST /v1/auth/verify-otp`
2. Copy `accessToken` from the response
3. Click **Authorize** (top right) and paste the token

### Endpoint summary

```
AUTH
  POST  /v1/auth/register             Register resident
  POST  /v1/auth/verify-otp           Verify email OTP → returns JWT pair
  POST  /v1/auth/resend-otp           Resend OTP
  POST  /v1/auth/login                Email + password login
  POST  /v1/auth/refresh              Refresh access token
  POST  /v1/auth/logout               Blacklist refresh token
  POST  /v1/auth/forgot-password      Send password-reset email
  POST  /v1/auth/reset-password       Reset password via token
  POST  /v1/auth/accept-invitation    Merchant/admin invite flow

USERS
  GET   /v1/user/profile              My profile
  PUT   /v1/user                      Update profile
  DELETE /v1/admin/user/:id           Delete user account [admin only]

AUTH (continued)
  PATCH /v1/auth/push-token           Register Expo push token (call after every login)

SHOPS
  GET   /v1/shops                     List shops (public, cursor-paginated)
  GET   /v1/shops/:id                 Shop detail + photos + hours (public)
  POST  /v1/shops                     Create shop [admin]
  PATCH /v1/shops/:id                 Update shop [merchant, admin]
  DELETE /v1/shops/:id                Delete shop [admin]
  POST  /v1/shops/:id/photos          Add photo URL [merchant]
  DELETE /v1/shops/:id/photos/:photoId Remove photo [merchant]

PRODUCTS
  GET   /v1/shops/:shopId/products       List products (public)
  GET   /v1/shops/:shopId/products/:id   Product detail (public)  ⚠ not yet implemented
  POST  /v1/shops/:shopId/products       Create product [merchant]
  PATCH /v1/shops/:shopId/products/:id   Update product [merchant]
  DELETE /v1/shops/:shopId/products/:id  Soft-delete product [merchant]

ORDERS
  POST  /v1/orders                    Place order [resident]
  GET   /v1/orders                    My orders / shop orders (resident | merchant)
  GET   /v1/orders/:id                Order detail
  PATCH /v1/orders/:id/status         Update status [merchant, admin]
  PATCH /v1/orders/:id/cancel         Cancel order while PLACED [resident]

REVIEWS  ⚠ controller not yet implemented
  POST  /v1/shops/:shopId/reviews     Leave review (1 per shop) [resident]
  GET   /v1/shops/:shopId/reviews     List reviews (public)

ANNOUNCEMENTS
  GET   /v1/announcements             Feed (public, cursor-paginated)
  GET   /v1/announcements/:id         Detail + comments (public)
  POST  /v1/announcements             Create [admin]
  POST  /v1/announcements/:id/comments Comment [resident, merchant, admin]

REPORTS
  GET   /v1/reports                   Official PDF reports (public)
  GET   /v1/reports/:id               Single report detail (public)  ⚠ not yet implemented
  POST  /v1/reports                   Upload report [admin]

GOVERNANCE — POLLS
  GET   /v1/polls                     List polls (public)
  GET   /v1/polls/:id                 Poll detail + my vote
  POST  /v1/polls                     Create poll [admin]
  POST  /v1/polls/:id/vote            Vote (one per resident per poll)

GOVERNANCE — ELECTIONS
  GET   /v1/elections                 List elections (public)
  GET   /v1/elections/:id             Election detail + candidates
  POST  /v1/elections                 Create election [admin]
  POST  /v1/elections/:id/candidates  Add candidate [admin]
  POST  /v1/elections/:id/vote        Vote (one per resident per election)

FEEDBACK
  POST  /v1/feedback                  Submit feedback [resident, merchant]
  GET   /v1/feedback                  My submissions / all (admin)
  GET   /v1/feedback/:id              Detail + replies
  POST  /v1/feedback/:id/replies      Admin reply [admin]
  PATCH /v1/feedback/:id/status       Update status [admin]

NOTIFICATIONS
  GET   /v1/notifications             In-app feed (cursor-paginated)
  PATCH /v1/notifications/read-all    Mark all as read
  PATCH /v1/notifications/:id/read    Mark one as read

UPLOADS
  POST  /v1/uploads/image             Upload image → returns URL [auth]
  POST  /v1/uploads/pdf               Upload PDF → returns URL [admin]

WEBHOOKS
  POST  /v1/webhooks/paymob           Paymob transaction webhook (public, HMAC verified)

HEALTH
  GET   /health                       Terminus health check
```

### WebSocket — `/orders` namespace

Connect: `io('http://localhost:3000/orders', { auth: { token: '<accessToken>' } })`

| Event (emit) | Payload | Description |
|---|---|---|
| `order:join` | `orderId: string` | Subscribe to order room |
| `order:leave` | `orderId: string` | Unsubscribe |

| Event (listen) | Payload | Description |
|---|---|---|
| `order:status_update` | `{ orderId, status, timestamp }` | Status changed |

---

## Testing

```bash
# Run all unit tests (62 tests across 5 suites)
pnpm test

# Run without coverage (faster iteration)
npx jest --config test/jest.json --no-coverage

# Run a specific spec file
npx jest --config test/jest.json --no-coverage payments.service

# Run tests in watch mode
npx jest --config test/jest.json --no-coverage --watch

# Debug a failing test
pnpm test:debug
```

### What is tested

| Service | Tests | Coverage |
|---|---|---|
| `auth.service` | register, verifyOtp, login, refresh, logout, forgotPassword, acceptInvitation | ~90% |
| `payments.service` | verifyHmac (pure crypto), handleWebhook (all guard branches) | 100% |
| `polls.service` | findAll (pagination, expiry, vote visibility), vote (one-vote guarantee) | ~92% |
| `orders.service` | create (server-side total, multi-shop guard), updateStatus, cancel | ~78% |
| `notifications.service` | send (push token + preference), findAll, markRead, markAllRead | ~92% |

**Overall on tested files: 88% statements · 83% branches**

Tests use `@swc/jest` (no tsc overhead) — full suite runs in ~2 seconds.

---

## Deployment — Fly.io

### First-time setup

```bash
# Install Fly CLI
curl -L https://fly.io/install.sh | sh

# Log in
fly auth login

# Launch (reads fly.toml automatically)
fly launch
# When prompted, say NO to deploying now — set secrets first
```

### Set production secrets

```bash
fly secrets set \
  DATABASE_URL="postgresql://..." \
  REDIS_URL="rediss://...upstash.io:6379" \
  AUTH_ACCESS_TOKEN_SECRET="$(openssl rand -base64 48)" \
  AUTH_REFRESH_TOKEN_SECRET="$(openssl rand -base64 48)" \
  SMTP_HOST="smtp-relay.brevo.com" \
  SMTP_PORT="587" \
  SMTP_USER="your@email.com" \
  SMTP_PASS="brevo-smtp-key" \
  EMAIL_FROM="noreply@eastpark.app" \
  SUPABASE_URL="https://xxx.supabase.co" \
  SUPABASE_SERVICE_KEY="service-role-key" \
  SUPABASE_BUCKET="eastpark-uploads" \
  PAYMOB_HMAC_SECRET="your-paymob-hmac-secret" \
  APP_URL="https://eastpark-backend.fly.dev"
```

### Deploy

```bash
fly deploy
```

The Dockerfile does a multi-stage pnpm build. On container start the CMD runs:

```
npx prisma migrate deploy && node dist/main
```

Migrations are applied automatically on every deploy before the server starts.

### Monitor

```bash
# Live logs
fly logs

# App status and machine list
fly status

# SSH into a running machine
fly ssh console

# Scale up if memory is tight (256 MB → 512 MB, ~$2/month)
fly scale memory 512
```

### Rollback

```bash
# List recent releases
fly releases

# Rollback to a previous release
fly deploy --image <previous-image-ref>
```

---

## Debugging

### Local debugging (VS Code)

```bash
pnpm debug
# Starts the app with --inspect on port 9229
```

Attach with VS Code — create `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Attach to NestJS",
      "type": "node",
      "request": "attach",
      "port": 9229,
      "restart": true,
      "sourceMaps": true,
      "outFiles": ["${workspaceFolder}/dist/**/*.js"]
    }
  ]
}
```

### Debug a specific test

```bash
pnpm test:debug
# then attach VS Code debugger to port 9229
```

### Increase log verbosity

Set in `.env`:

```env
APP_LOG_LEVEL=debug
```

Pino outputs structured JSON. To pretty-print locally:

```bash
pnpm dev | npx pino-pretty
```

### Inspect Redis (OTP, blacklist, reset tokens)

```bash
# Dev (Docker)
docker exec -it eastpark-redis redis-cli

# See OTP key
127.0.0.1:6379> GET otp:jane@eastpark.app

# See all blacklisted tokens
127.0.0.1:6379> KEYS blacklist:*

# TTL remaining on a key
127.0.0.1:6379> TTL otp:jane@eastpark.app
```

### Inspect the database

```bash
# Prisma Studio — visual browser
pnpm prisma:studio
# Opens at http://localhost:5555
```

### Inspect Mailpit (OTP emails, password reset links)

Open `http://localhost:8025` — all outgoing SMTP emails are captured here during dev.

### Fly.io production debugging

```bash
# Live logs (add -i for a specific machine)
fly logs

# SSH into the container
fly ssh console
# then: node / npx prisma studio --browser none / etc.

# Check environment
fly ssh console -C "env | grep -E 'NODE_ENV|HTTP_PORT|DATABASE'"
```

---

## Project Structure

```
apps/backend/
├── prisma/
│   ├── schema.prisma          ← Full data model (20+ models)
│   └── seed.ts                ← Seeds first admin user
├── src/
│   ├── main.ts                ← Bootstrap: Fastify, pipes, Swagger, multipart
│   ├── swagger.ts             ← Swagger doc builder (dark theme)
│   ├── app/
│   │   ├── app.module.ts      ← Root module — imports all feature modules
│   │   └── controllers/
│   │       └── health.controller.ts
│   ├── common/                ← Shared infrastructure
│   │   ├── auth/              ← JWT strategy, guards, AuthService
│   │   ├── cache/             ← Redis (ioredis) — OTP, blacklist, reset tokens
│   │   ├── config/            ← registerAs() configs (app, auth, db, paymob…)
│   │   ├── database/          ← PrismaClient as injectable DatabaseService
│   │   ├── email/             ← Nodemailer/Brevo — OTP + password reset emails
│   │   ├── file/              ← Supabase/MinIO upload service
│   │   ├── helper/            ← Argon2, JWT, pagination, query builder helpers
│   │   ├── logger/            ← Pino structured logger
│   │   ├── message/           ← i18n message service
│   │   └── request/           ← Decorators: @AuthUser, @AllowedRoles, @PublicRoute
│   └── modules/               ← Feature modules
│       ├── announcements/     ← Announcements + comments
│       ├── feedback/          ← Resident feedback + admin replies
│       ├── governance/        ← Polls + elections (@Cron auto-open results)
│       ├── notifications/     ← Expo Push + in-app notification feed
│       ├── orders/            ← Orders REST + Socket.io gateway
│       ├── payments/          ← Paymob webhook (HMAC-SHA512)
│       ├── products/          ← Products (soft delete)
│       ├── reports/           ← Official PDF reports
│       ├── shops/             ← Shops + photo gallery
│       ├── uploads/           ← Image/PDF upload endpoints
│       └── user/              ← User profile management
├── test/
│   ├── common/
│   │   └── auth.service.spec.ts
│   ├── modules/
│   │   ├── notifications.service.spec.ts
│   │   ├── orders.service.spec.ts
│   │   ├── payments.service.spec.ts
│   │   └── polls.service.spec.ts
│   ├── mocks/
│   │   ├── expo.mock.ts
│   │   ├── faker.mock.ts
│   │   └── ws.mock.ts
│   └── jest.json
├── docker-compose.yml         ← Local dev services
├── Dockerfile                 ← Production multi-stage pnpm build
├── fly.toml                   ← Fly.io deployment config (cdg / Paris)
└── .env.example               ← All environment variables documented
```

### Key design decisions

| Decision | Rationale |
|---|---|
| Fastify over Express | Better raw throughput; WebSocket-compatible |
| Argon2 for password hashing | More memory-hard than bcrypt |
| Cursor-based pagination | All list endpoints use `cursor + limit` — safe on large tables |
| Server-side `totalAmount` | Never trust client-supplied price in order creation |
| `crypto.timingSafeEqual` for HMAC | Prevents timing-attack extraction of the secret |
| Soft delete for products | Preserves `OrderItem` foreign keys in order history |
| `@@id([userId, pollId])` / `@@id([userId, electionId])` | DB-level one-vote guarantee, not just app logic |
| Fire-and-forget push notifications | `.catch(() => undefined)` — push failure never blocks API response |
| Expo Push inline (no queue) | Simplicity; Expo batch API handles chunking internally |

---

## Troubleshooting

### `pnpm install` fails

```bash
# Clear pnpm cache
pnpm store prune
pnpm install
```

### Docker containers won't start

```bash
# Check logs
docker-compose logs postgres
docker-compose logs minio

# Reset volumes and try again
docker-compose down -v
docker-compose up -d
```

### `prisma migrate dev` — "drift detected"

Your local schema differs from the last migration. Either:

```bash
# Option A: Accept the drift and create a new migration
pnpm prisma:migrate

# Option B: Reset completely (dev only)
npx prisma migrate reset
pnpm seed
```

### OTP email not arriving

Check Mailpit at `http://localhost:8025` — all emails are captured there in dev. If it's empty, confirm `SMTP_HOST=localhost` and `SMTP_PORT=1025` in your `.env`.

### `UnauthorizedException: payments.error.invalidHmac`

The Paymob webhook HMAC doesn't match. Possible causes:
- `PAYMOB_HMAC_SECRET` doesn't match the key configured in your Paymob dashboard
- Payload fields are being mutated before reaching the service (e.g. by a JSON parser rounding numbers)

### WebSocket connection refused

Ensure you're connecting to `/orders` namespace, not `/`:

```js
// Correct
const socket = io('http://localhost:3000/orders', { auth: { token } });

// Wrong
const socket = io('http://localhost:3000', { auth: { token } });
```

### `RangeError` from `crypto.timingSafeEqual`

The two buffers passed to `timingSafeEqual` have different lengths. In the `verifyHmac` method, always ensure the provided `hmac` string is exactly 128 characters (64 bytes × 2 hex chars). Any shorter/longer value is automatically invalid.

### App crashing on Fly.io with 256 MB RAM

NestJS + Prisma + Redis client idles at ~180–220 MB. Under load it may exceed 256 MB.

```bash
# Scale to 512 MB (~$2/month)
fly scale memory 512
```

### Prisma migration fails on `fly deploy`

The `CMD` runs `npx prisma migrate deploy` before starting the server. If it fails:

```bash
fly logs   # look for migration error
fly ssh console
> npx prisma migrate status
```

Usually caused by a bad `DATABASE_URL` secret or a migration SQL error.

---

## Scripts Reference

| Script | Description |
|---|---|
| `pnpm dev` | Hot-reload dev server |
| `pnpm build` | Compile TypeScript |
| `pnpm start` | Run compiled output |
| `pnpm debug` | Dev server with Node inspector (port 9229) |
| `pnpm test` | Unit tests with coverage report |
| `pnpm test:debug` | Tests with Node inspector |
| `pnpm lint` | ESLint auto-fix |
| `pnpm format` | Prettier format |
| `pnpm prisma:generate` | Regenerate Prisma client |
| `pnpm prisma:migrate` | Create + apply migration (dev) |
| `pnpm prisma:migrate-prod` | Apply existing migrations (prod) |
| `pnpm prisma:studio` | Open Prisma Studio at `:5555` |
| `pnpm seed` | Seed first admin user |
