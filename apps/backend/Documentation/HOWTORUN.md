# EastPark Backend — How to Run

> **EastPark** is a residential compound super-app for the MENA region.
> This document covers the **NestJS 11 + Fastify** backend API only.
> For the frontend setup, see `../../mobile/Documentation/HOWTORUN.md`.
> For full-stack local dev, run both simultaneously.

---

## What This Server Does

- REST API at `/v1` — shops, products, orders, auth, community, governance, notifications, admin
- WebSocket server — `/orders` namespace for real-time order status updates
- Email sending — OTP codes, password reset links, merchant invitations
- File uploads — product images, shop photos, PDF reports (stored in MinIO locally / Supabase in prod)
- Push notifications — Expo Push Service (inline, no queue)
- Paymob payment webhook — HMAC-SHA512 verified, idempotent via Redis

---

## Prerequisites

| Tool | Minimum Version | Install |
|---|---|---|
| Node.js | 20 LTS | https://nodejs.org |
| pnpm | 9 | `npm install -g pnpm@latest` |
| Docker Desktop | Latest | https://www.docker.com/products/docker-desktop |

---

## Automated Setup (recommended)

One command starts everything — Docker services, migrations, seed, dev server:

```bash
cd apps/backend
pnpm install
cp .env.example .env
# Edit .env — fill in AUTH_ACCESS_TOKEN_SECRET and AUTH_REFRESH_TOKEN_SECRET (see Step 2)
pnpm dev:setup
```

---

## Manual Setup (step by step)

### Step 1 — Install dependencies

```bash
cd apps/backend
pnpm install
```

### Step 2 — Configure environment

```bash
cp .env.example .env
```

Open `.env` and fill in the required values:

```bash
# 1. Generate two different JWT secrets:
openssl rand -base64 48   # copy output → AUTH_ACCESS_TOKEN_SECRET
openssl rand -base64 48   # copy output → AUTH_REFRESH_TOKEN_SECRET (must differ)

# 2. Set local service passwords (used by docker-compose):
POSTGRES_PASSWORD="<choose-a-password>"
MINIO_ROOT_PASSWORD="<choose-a-password>"

# 3. Paste POSTGRES_PASSWORD into DATABASE_URL:
DATABASE_URL="postgresql://postgres:<your-password>@localhost:5432/eastpark?schema=public"

# 4. Set SUPABASE_SERVICE_KEY to the same value as MINIO_ROOT_PASSWORD (MinIO auth for dev)

# 5. Set seed passwords for test accounts:
SEED_ADMIN_PASSWORD="<choose-a-password>"
SEED_MERCHANT_PASSWORD="<choose-a-password>"
SEED_RESIDENT_PASSWORD="<choose-a-password>"
```

Everything else has sensible defaults for local dev. Key defaults in `.env.example`:

| Variable | Dev Default |
|---|---|
| `REDIS_URL` | `redis://localhost:6379` |
| `SMTP_HOST` / `SMTP_PORT` | `localhost` / `1025` (Mailpit) |
| `SUPABASE_URL` | `http://localhost:9002` (MinIO) |
| `SUPABASE_BUCKET` | `eastpark-uploads` |
| `HTTP_PORT` | `3000` |

### Step 3 — Start Docker services

```bash
pnpm docker:up
```

This starts five containers:

| Container | Port(s) | Purpose |
|---|---|---|
| `eastpark-postgres` | 5432 | Primary PostgreSQL 16 database |
| `eastpark-redis` | 6379 | OTP / token blacklist / rate limiting |
| `eastpark-mailpit` | 1025 (SMTP), **8025 (Web UI)** | Catches all outbound emails |
| `eastpark-minio` | 9000 (S3 API), **9001 (Console)** | Local file storage |
| `eastpark-minio-init` | — | One-shot: creates the `eastpark-uploads` bucket |

Wait ~10 seconds for postgres and redis to become healthy before proceeding.

### Step 4 — Run database migrations

```bash
pnpm prisma:migrate
```

Enter a migration name when prompted (e.g. `init`). Creates all tables from the Prisma schema.

### Step 5 — Seed the first admin

```bash
pnpm seed
```

Creates the admin user — safe to re-run (idempotent). Password is set via `SEED_ADMIN_PASSWORD` env var.

> Credentials come from `prisma/seed-data.ts`. Override via env vars `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`.

### Step 6 — Start the dev server

```bash
pnpm dev
```

Hot-reload server starts. Confirm:

```
[NestJS] Application is running on: http://0.0.0.0:3000/v1
```

---

## Local Dev URLs

| URL | Description |
|---|---|
| `http://localhost:3000/v1` | REST API base URL |
| `http://localhost:3000/docs` | Swagger UI — interactive API explorer |
| `ws://localhost:3000/orders` | WebSocket namespace for real-time order updates |
| `http://localhost:8025` | Mailpit — view all outbound emails (OTP, invites, reset links) |
| `http://localhost:9001` | MinIO Console — browse uploaded files (credentials in `.env`) |
| `http://localhost:5555` | Prisma Studio — visual DB browser (`pnpm prisma:studio`) |

---

## Test Credentials

| Account | Email | Password |
|---|---|---|
| Admin | `admin@eastpark.app` | Set via `SEED_ADMIN_PASSWORD` env var |
| Resident | Register via app + verify OTP | Set during registration |
| Merchant | Accept invite email (see Mailpit) | Set on accept-invitation screen |

---

## All Commands

```bash
# Dev
pnpm dev:setup          Full automated: Docker → migrate → seed → dev server
pnpm dev                Hot-reload dev server only
pnpm debug              Dev server with Node inspector on port 9229

# Docker
pnpm docker:up          Start all containers (detached)
pnpm docker:down        Stop all containers (data preserved)
pnpm docker:logs        Stream all container logs
pnpm docker:reset       Stop + wipe all volumes (full data reset)

# Prisma
pnpm prisma:migrate     Create + apply new migration (dev)
pnpm prisma:migrate-prod Apply existing migrations only (prod/CI)
pnpm prisma:generate    Regenerate Prisma client after schema changes
pnpm prisma:reset       Drop all tables + re-migrate (dev only — destroys data)
pnpm prisma:studio      Open visual DB browser at localhost:5555
pnpm seed               Seed admin user (idempotent)

# Build
pnpm build              Compile TypeScript → dist/
pnpm start              Run compiled dist/main.js
pnpm start:prod         Run with NODE_ENV=production

# Quality
pnpm lint               ESLint with auto-fix
pnpm format             Prettier format
pnpm type-check         TypeScript check (no emit)
pnpm test               Unit tests with coverage (~88% statement coverage, 62 tests)
pnpm test:watch         Tests in watch mode
pnpm ci                 typecheck + lint:check + format:check + test:ci

# Reset
pnpm dev:reset          Full reset: wipe volumes + re-migrate + re-seed + restart
```

---

## WebSocket Connection (orders namespace)

```typescript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000/orders', {
  auth: { token: 'your-jwt-access-token' },
});

// Subscribe to a specific order's updates
socket.emit('order:join', '<orderId>');

// Listen for status changes
socket.on('order:status_update', (data) => {
  console.log(data); // { orderId, status, timestamp }
});

// Unsubscribe when done
socket.emit('order:leave', '<orderId>');
```

---

## Before Going to Production

These steps require external accounts — they cannot be automated.

### 1 — Paymob (card & wallet payments)

COD works with zero Paymob config. To enable card/wallet payments:

1. Create account at https://accept.paymob.com
2. Get credentials from Paymob dashboard → Settings

```env
PAYMOB_API_KEY=<Settings → API Keys>
PAYMOB_HMAC_SECRET=<Settings → Webhook → HMAC Secret>
PAYMOB_INTEGRATION_ID=<Integrations → your card integration ID>
PAYMOB_IFRAME_ID=<Iframes → your iframe ID>
```

### 2 — Production email (Brevo SMTP)

Create free account at https://brevo.com (300 emails/day free):

```env
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_USER=your@email.com
SMTP_PASS=<Brevo → Settings → SMTP & API key>
EMAIL_FROM=noreply@eastpark.app
```

### 3 — Production database (Supabase PostgreSQL)

Same Supabase project as Storage — one free tier, 500 MB. Dashboard → **Connect**, copy both
strings (they differ only in the port):

```env
# Transaction pooler — runtime queries
DATABASE_URL=postgresql://postgres.<ref>:<url-encoded-pw>@<region>.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1
# Session pooler — migrations only (schema.prisma `directUrl`)
DIRECT_DATABASE_URL=postgresql://postgres.<ref>:<url-encoded-pw>@<region>.pooler.supabase.com:5432/postgres
```

Three silent failure modes:

- **Pooler host only.** `db.<ref>.supabase.co` is IPv6-only (0 A records) and Fly VMs have no
  public IPv4 egress — unreachable. `<region>.pooler.supabase.com` is IPv4.
- **Percent-encode the password:** `#`→`%23` `@`→`%40` `:`→`%3A` `/`→`%2F`. An unencoded `#`
  or `@` yields a valid-looking URL pointing at the wrong host.
- **Username is `postgres.<project-ref>`**, not `postgres`.

### 4 — Production cache (Upstash Redis)

Create free database at https://upstash.com (10,000 req/day free):

```env
REDIS_URL=rediss://default:xxx@your-endpoint.upstash.io:6379
```

Note `rediss://` (double-s) — TLS required by Upstash.

### 5 — Production file storage (Supabase Storage)

Create free project at https://supabase.com (1 GB free):

1. Storage → create bucket `eastpark-uploads` → set to Public
2. Settings → API → copy service role key

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
SUPABASE_BUCKET=eastpark-uploads
```

---

## Production Deployment (Fly.io)

Region: `cdg` (Paris). Min 1 machine always on — no cold starts, WebSocket-friendly.

```bash
cd apps/backend

fly auth login

fly secrets set \
  DATABASE_URL="postgresql://postgres.<ref>:<enc-pw>@<region>.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1" \
  DIRECT_DATABASE_URL="postgresql://postgres.<ref>:<enc-pw>@<region>.pooler.supabase.com:5432/postgres" \
  REDIS_URL="rediss://default:xxx@your-endpoint.upstash.io:6379" \
  AUTH_ACCESS_TOKEN_SECRET="$(openssl rand -base64 48)" \
  AUTH_REFRESH_TOKEN_SECRET="$(openssl rand -base64 48)" \
  SMTP_HOST="smtp-relay.brevo.com" \
  SMTP_PORT="587" \
  SMTP_USER="your@email.com" \
  SMTP_PASS="brevo-smtp-key" \
  EMAIL_FROM="noreply@eastpark.app" \
  SUPABASE_URL="https://your-project.supabase.co" \
  SUPABASE_SERVICE_KEY="your-service-role-key" \
  SUPABASE_BUCKET="eastpark-uploads" \
  PAYMOB_API_KEY="your-paymob-api-key" \
  PAYMOB_HMAC_SECRET="your-paymob-hmac-secret" \
  PAYMOB_INTEGRATION_ID="your-integration-id" \
  PAYMOB_IFRAME_ID="your-iframe-id" \
  APP_URL="https://eastpark-backend.fly.dev"

fly deploy
```

On first deploy, the Dockerfile runs `npx prisma migrate deploy && node dist/main` automatically.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `ECONNREFUSED localhost:5432` | Run `pnpm docker:up`; wait ~10 s for postgres health |
| `ECONNREFUSED localhost:6379` | Redis container not running — check `docker-compose ps` |
| OTP email not received | Check Mailpit at `http://localhost:8025` — all emails captured there |
| `invalidHmac` on Paymob webhook | `PAYMOB_HMAC_SECRET` must exactly match Paymob dashboard secret |
| Prisma migration drift error | `pnpm prisma:reset && pnpm seed` (dev only — destroys data) |
| WebSocket connection refused | Connect to `/orders` namespace, not root: `io('http://localhost:3000/orders', ...)` |
| App crashes on Fly.io (256 MB RAM) | `fly scale memory 512` (~$2/month — NestJS+Prisma idles at ~200 MB) |
| `ioredis` type errors | Do NOT install `@types/ioredis` — ioredis v5+ bundles its own types |
| `pnpm install` fails | Ensure Node.js ≥ 20 and pnpm ≥ 9 |

---

## Running with Frontend

When developing end-to-end, run this backend alongside the frontend.

### Terminal 1 — Backend (this app)

```bash
cd /mnt/c/Unite/EastPark-App/apps/backend
docker compose up -d         # starts postgres, redis, mailpit, minio
pnpm start:dev               # NestJS on http://localhost:3000
```

### Terminal 2 — Frontend

```bash
cd /mnt/c/Unite/EastPark-App/apps/mobile
# Ensure EXPO_PUBLIC_API_URL=http://localhost:3000/v1 in .env.local
pnpm start
```

### Integration Notes
- Frontend `EXPO_PUBLIC_API_URL` must include `/v1` — Axios client does NOT auto-prepend it
- Frontend `EXPO_PUBLIC_SOCKET_URL` = backend root (no `/v1`) — Socket.io mounts at `/orders`
- Swagger docs available at http://localhost:3000/docs while backend is running
- Mailpit (email preview): http://localhost:8025
- MinIO console: http://localhost:9001 (user: admin / pass: password123)
- Paymob webhooks in dev: use ngrok or similar to expose `POST /webhooks/paymob`
