# EastPark — How to Run

> **EastPark** is a residential compound super-app for the MENA region, built as a full-stack monorepo.
> It combines a local marketplace (shops, ordering, real-time tracking) with a community governance hub
> (announcements, polls, elections, resident feedback). Arabic RTL is the primary language; English LTR
> is the secondary.

---

## Repository Layout

```
EastPark-App/
├── eastpark-backend/     NestJS 11 + Fastify REST & WebSocket API
├── eastpark-frontend/    Expo 54 React Native app (iOS + Android)
├── BackendPlan.md        Canonical backend architecture reference
├── FrontendPlan.md       Canonical frontend architecture reference
├── DESIGN.md             Full design system (~1750 lines)
└── CLAUDE.md             Session context for AI-assisted development
```

---

## Prerequisites

| Tool | Minimum Version | Install |
|---|---|---|
| Node.js | 20 LTS | https://nodejs.org |
| pnpm | 9 | `npm install -g pnpm@latest` |
| Docker Desktop | Latest | https://www.docker.com/products/docker-desktop |
| Expo CLI | Latest | `npm install -g expo-cli` (optional — scripts call it via pnpm) |
| EAS CLI | Latest | `npm install -g eas-cli` (only for cloud builds) |
| Git | Any | — |

> **Windows developers:** All Windows-specific pnpm path issues are auto-fixed by a `postinstall` hook. No extra steps required.

---

## Part 1 — Backend

### Stack at a Glance

| Layer | Technology |
|---|---|
| Framework | NestJS 11 + Fastify adapter |
| ORM | Prisma 6 + PostgreSQL 16 |
| Cache | Redis 7 via ioredis |
| Auth | Passport + JWT (argon2 hashing) |
| Real-time | Socket.io — `/orders` namespace |
| Email (dev) | Mailpit (catches all outbound email locally) |
| File storage (dev) | MinIO (S3-compatible local bucket) |
| Push | Expo Push Service (expo-server-sdk) |
| Payments | Paymob (HMAC-SHA512 webhook) |

### Step 1 — Install dependencies

```bash
cd eastpark-backend
pnpm install
```

### Step 2 — Configure environment

```bash
cp .env.example .env
```

Open `.env` and fill in the two JWT secrets. Every other value works as-is for local development:

```bash
# Generate two separate secrets (run each command, copy the output)
openssl rand -base64 48   # → AUTH_ACCESS_TOKEN_SECRET
openssl rand -base64 48   # → AUTH_REFRESH_TOKEN_SECRET
```

Key defaults already set in `.env.example`:

| Variable | Default |
|---|---|
| `DATABASE_URL` | `postgresql://postgres:master123@localhost:5432/eastpark` |
| `REDIS_URL` | `redis://localhost:6379` |
| `SMTP_HOST` / `SMTP_PORT` | `localhost` / `1025` (Mailpit) |
| `SUPABASE_URL` | `http://localhost:9000` (MinIO) |
| `HTTP_PORT` | `3000` |

### Step 3 — Start Docker services

```bash
pnpm docker:up
```

This starts five containers:

| Container | Port | Purpose |
|---|---|---|
| `eastpark-postgres` | 5432 | Primary PostgreSQL database |
| `eastpark-redis` | 6379 | OTP / token blacklist / rate limiting |
| `eastpark-mailpit` | 1025 (SMTP), **8025 (Web UI)** | Catches all outbound emails |
| `eastpark-minio` | 9000 (S3 API), **9001 (Console)** | Local file storage |
| `eastpark-minio-init` | — | One-shot: creates the `eastpark-uploads` bucket |

Wait ~10 seconds for postgres and redis to become healthy before proceeding.

### Step 4 — Run database migrations

```bash
pnpm prisma:migrate
```

Enter a migration name when prompted (e.g. `init`). This creates all tables from the Prisma schema.

### Step 5 — Seed the first admin user

```bash
pnpm seed
```

Creates: **`admin@eastpark.local`** / **`Admin@123456`** (idempotent — safe to re-run).

### Step 6 — Start the development server

```bash
pnpm dev
```

The server starts with hot-reload. Confirm it is running:

```
[NestJS] Application is running on: http://0.0.0.0:3000/v1
```

### Backend URLs (local dev)

| URL | Description |
|---|---|
| `http://localhost:3000/v1` | REST API base |
| `http://localhost:3000/docs` | Swagger UI (interactive API explorer) |
| `ws://localhost:3000/orders` | WebSocket namespace for real-time order updates |
| `http://localhost:8025` | Mailpit — view all outbound emails |
| `http://localhost:9001` | MinIO Console — browse uploaded files (`minioadmin` / `minioadmin`) |
| `http://localhost:5555` | Prisma Studio — visual DB browser (`pnpm prisma:studio`) |

### Automated Setup (alternative to Steps 3–6)

```bash
pnpm dev:setup
```

Runs the full sequence automatically: Docker up → health checks → migrate → seed → dev server.

### Useful backend commands

```bash
pnpm docker:logs        # Stream all Docker service logs
pnpm docker:down        # Stop all containers (preserves data)
pnpm docker:reset       # Stop + wipe all volumes (full reset)
pnpm dev:reset          # Full reset: wipe volumes + re-migrate + re-seed
pnpm prisma:studio      # Open visual DB browser at localhost:5555
pnpm prisma:reset       # Drop all tables + re-run migrations (dev only)
pnpm test               # Run 62 unit tests with coverage
pnpm lint               # ESLint with auto-fix
pnpm build              # Compile TypeScript → dist/
```

---

## Part 2 — Frontend

### Stack at a Glance

| Layer | Technology |
|---|---|
| Framework | Expo 54 + React Native 0.81.5 + React 19 |
| Language | TypeScript 5.9 (strict) |
| JS Engine | Hermes + New Architecture |
| Navigation | Expo Router 6 (file-based) |
| State | Redux Toolkit 2.5 + redux-persist |
| Server state | TanStack React Query v5 |
| Styling | NativeWind + Gluestack UI v2 |
| Forms | React Hook Form 7 + Zod 4 |
| Auth tokens | expo-secure-store (never AsyncStorage) |
| Real-time | socket.io-client |
| i18n | i18next + expo-localization (Arabic RTL / English LTR) |

### Step 1 — Install dependencies

```bash
cd eastpark-frontend
pnpm install
```

> pnpm is enforced via a `preinstall` hook. Running `npm install` or `yarn` will be rejected.

### Step 2 — Configure environment

The repo includes two env files:

- **`.env`** — committed base config with placeholder values (do not store real secrets here)
- **`.env.local`** — your local override (not committed, takes precedence)

Create or update `.env.local`:

```bash
# .env.local
EXPO_PUBLIC_APP_ENV=development
EXPO_PUBLIC_API_URL=http://localhost:3000    # do NOT add /v1 — the Axios client appends it
EXPO_PUBLIC_SOCKET_URL=http://localhost:3000
EXPO_PUBLIC_POSTHOG_KEY=           # optional analytics key
```

> All bundle IDs, URL schemes, and package names are derived automatically from `EXPO_PUBLIC_APP_ENV`.
> You do not set them manually.

| `EXPO_PUBLIC_APP_ENV` | Bundle ID | URL Scheme |
|---|---|---|
| `development` | `com.eastpark.app.development` | `eastpark` |
| `preview` | `com.eastpark.app.preview` | `eastpark.preview` |
| `production` | `com.eastpark.app` | `eastpark` |

### Step 3A — Run in Expo Go (limited features)

For basic UI work that does not require native modules:

```bash
pnpm start
```

Scan the QR code with the **Expo Go** app (iOS App Store / Google Play).

> Expo Go does **not** support: push notifications, expo-secure-store, or custom URL schemes. Use a dev client (Step 3B) for full functionality.

### Step 3B — Run with Dev Client (full native features)

Build a dev client once — required for push notifications, secure token storage, and deep links.

**iOS simulator:**
```bash
pnpm ios
```

**Android emulator:**
```bash
pnpm android
```

**Physical device (cloud build via EAS):**

> First-time only: initialize EAS for the project.
> ```bash
> eas init
> ```

```bash
pnpm build:development:ios      # iOS dev client (.ipa) → install on device
pnpm build:development:android  # Android dev client (.apk) → install on device
```

Then start the Metro bundler:

```bash
pnpm start
```

### Step 3C — Preview / Production builds

```bash
# Preview APK (Android, for internal testers)
pnpm build:preview:android

# Production App Bundle (for Google Play)
pnpm build:production:android

# Production IPA (for App Store)
pnpm build:production:ios
```

### Useful frontend commands

```bash
pnpm start              # Start Metro dev server (Expo Go / dev client)
pnpm start:preview      # Metro server with preview environment
pnpm lint               # ESLint
pnpm lint:fix           # ESLint with auto-fix
pnpm type-check         # TypeScript type check (no emit)
pnpm test               # Jest unit tests
pnpm test:watch         # Tests in watch mode
pnpm check-all          # lint + type-check + lint:translations + test
pnpm doctor             # expo-doctor health check
```

---

## Part 3 — Running Both Together (Full Stack Local)

Open two terminal windows side by side:

**Terminal 1 — Backend:**
```bash
cd eastpark-backend
pnpm dev:setup          # or: pnpm docker:up && pnpm prisma:migrate && pnpm seed && pnpm dev
```

**Terminal 2 — Frontend:**
```bash
cd eastpark-frontend
pnpm start
```

Ensure `.env.local` in the frontend points to:
```
EXPO_PUBLIC_API_URL=http://localhost:3000       # no /v1 — the Axios client appends it automatically
EXPO_PUBLIC_SOCKET_URL=http://localhost:3000
```

> **Android emulator note:** Android cannot reach `localhost` of your host machine.
> Use `10.0.2.2` instead:
> ```
> EXPO_PUBLIC_API_URL=http://10.0.2.2:3000
> EXPO_PUBLIC_SOCKET_URL=http://10.0.2.2:3000
> ```

> **Physical device note:** Use your machine's LAN IP (e.g. `192.168.x.x`) so the device can reach the backend over Wi-Fi. Restart Metro with `-c` to clear the cache after changing env vars:
> ```bash
> pnpm start -- -c
> ```

---

## User Roles & Test Credentials

| Role | How to obtain |
|---|---|
| **Admin** | Seeded by `pnpm seed` → `admin@eastpark.local` / `Admin@123456` |
| **Resident** | Register via app → email + unit number + password → verify OTP (check Mailpit at `:8025`) |
| **Merchant** | Admin sends email invite via API → accept-invitation deep link → set name + password |
| **Guest** | No registration — read-only access to directory and announcements |

---

## Navigation Map (Expo Router)

```
app/
├── (tabs)/
│   ├── index              Home Feed
│   ├── directory/         Shop list → shop detail → menu browser
│   ├── orders/            [auth] Order history → real-time order detail
│   ├── community/         Announcements → governance (polls/elections) → feedback
│   └── profile/           [auth] User profile / Guest CTA
├── notifications/         [auth] In-app notification feed
├── (auth)/                login · register · verify-otp · forgot-password · reset-password · accept-invitation
├── (merchant)/            [merchant] Dashboard · menu CRUD · order management
└── checkout/              cart · address · payment (COD / Paymob) · confirmation
```

---

## Required Before Going to Production

These steps cannot be automated — they require personal accounts or manual configuration.

### 1 — EAS project init (push notifications)

Push notifications in all non-Expo-Go builds require a valid EAS project ID.

```bash
cd eastpark-frontend

# Log in to your Expo account (create one free at expo.dev)
eas login

# Link this project — generates a project ID
eas init
```

After `eas init` completes, open `eastpark-frontend/app.config.ts` and paste the ID:

```ts
// app.config.ts  (line 10)
const EAS_PROJECT_ID = 'paste-your-project-id-here';   // was: ''
```

Without this, `registerPushToken()` silently returns no token in every production or preview build. The app works but users receive no push notifications.

### 2 — Paymob credentials (card & wallet payments)

COD works with zero Paymob config. To enable card/wallet payments, get your credentials from the [Paymob dashboard](https://accept.paymob.com/dashboard) and set them in `eastpark-backend/.env` (and in Fly.io secrets for production):

```env
PAYMOB_API_KEY=<from Paymob → Settings → API Keys>
PAYMOB_HMAC_SECRET=<from Paymob → Settings → Webhook → HMAC Secret>
PAYMOB_INTEGRATION_ID=<from Paymob → Integrations → your card integration ID>
PAYMOB_IFRAME_ID=<from Paymob → Iframes → your iframe ID>
```

The frontend calls `POST /v1/orders/:id/pay/paymob` which returns `{ paymentKey, iframeUrl }` — the app then opens the iframe in a WebView to complete payment.

### 3 — Production email (Brevo SMTP)

Local dev uses Mailpit (zero config). For production, create a free account at [brevo.com](https://www.brevo.com) (300 emails/day free):

```env
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_USER=your@email.com
SMTP_PASS=<Brevo SMTP key from Settings → SMTP & API>
EMAIL_FROM=noreply@eastpark.app
```

### 4 — Production file storage (Supabase Storage)

Local dev uses MinIO (Docker). For production, create a free project at [supabase.com](https://supabase.com) (1 GB free):

1. Go to **Storage** → create bucket `eastpark-uploads`
2. Set bucket to **Public** (or configure signed URLs if you prefer private)
3. Copy the **service role key** from **Settings → API**:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
SUPABASE_BUCKET=eastpark-uploads
```

### 5 — Production database (Supabase PostgreSQL)

Local dev uses Docker postgres. Production uses the **same Supabase project** as Storage
(step 4) — one free tier, 500 MB.

Dashboard → **Connect**. Copy both strings; they differ only in the port:

```env
# Transaction pooler — runtime queries
DATABASE_URL=postgresql://postgres.<ref>:<url-encoded-pw>@<region>.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1
# Session pooler — migrations only (schema.prisma `directUrl`)
DIRECT_DATABASE_URL=postgresql://postgres.<ref>:<url-encoded-pw>@<region>.pooler.supabase.com:5432/postgres
```

Three things that will silently bite you:

- **Use the pooler host, not `db.<ref>.supabase.co`.** The direct host is IPv6-only and Fly
  VMs have no public IPv4 egress, so it is simply unreachable. The pooler resolves to IPv4.
- **Percent-encode the password.** A literal `#` truncates the URL at the fragment and `@`
  splits the authority — both produce a *valid-looking* string pointing at the wrong host.
  `#` → `%23`, `@` → `%40`, `:` → `%3A`, `/` → `%2F`.
- **Free projects pause after 1 week idle** and need a manual dashboard restore. The Fly
  health check queries the DB every 15s, which keeps it awake — don't remove it.

### 6 — Production cache (Upstash Redis)

Local dev uses Docker redis. For production, create a free database at [upstash.com](https://upstash.com) (10,000 requests/day free):

```env
REDIS_URL=rediss://default:xxx@your-endpoint.upstash.io:6379
```

Note the `rediss://` (with double-s) for TLS — required by Upstash.

---

## Production Deployment (Fly.io)

The backend is configured for Fly.io (region: `cdg`, Paris). One machine always stays running — no cold starts.

```bash
cd eastpark-backend

# Authenticate
fly auth login

# Set all secrets (one-time)
fly secrets set \
  DATABASE_URL="postgresql://...@ep-xxx.neon.tech/eastpark?sslmode=require" \
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

# Deploy
fly deploy
```

On first deploy the Dockerfile runs `npx prisma migrate deploy && node dist/main` automatically.

For the mobile app, run an EAS production build and submit to the stores:

```bash
cd eastpark-frontend
pnpm build:production:ios
pnpm build:production:android
```

---

## Troubleshooting

**Backend**

| Symptom | Fix |
|---|---|
| `Cannot find module 'pnpm'` | `npm install -g pnpm` |
| `ECONNREFUSED localhost:5432` | Run `pnpm docker:up` first; wait ~10 s for postgres to become healthy |
| OTP email not received | Check Mailpit at `http://localhost:8025` — all outbound emails are captured there |
| `invalidHmac` on Paymob webhook | `PAYMOB_HMAC_SECRET` must exactly match the secret in your Paymob dashboard |
| Prisma migration error | Check `DATABASE_URL` in `.env`; ensure postgres container is healthy (`docker-compose ps`) |
| Redis connection error | Check `REDIS_URL` in `.env`; ensure redis container is running |
| `drift detected` on `prisma migrate dev` | `npx prisma migrate reset && pnpm seed` (dev only — destroys all data) |
| WebSocket connection refused | Connect to `/orders` namespace: `io('http://localhost:3000/orders', { auth: { token } })` |
| App crashes on Fly.io (256 MB RAM) | `fly scale memory 512` (~$2/month — NestJS + Prisma idles at ~200 MB) |

**Frontend**

| Symptom | Fix |
|---|---|
| `only-allow` error on `npm install` | Use `pnpm install` — npm/yarn are blocked by a preinstall hook |
| Physical device cannot reach API | Set `EXPO_PUBLIC_API_URL=http://192.168.x.x:3000` (your LAN IP) in `.env.local` |
| Android emulator cannot reach API | Use `http://10.0.2.2:3000` instead of `localhost` in `.env.local` |
| API URL returns 404 on all routes | Do not add `/v1` to `EXPO_PUBLIC_API_URL` — the Axios client appends it automatically |
| Native module crash in Expo Go | Expo Go does not support `expo-secure-store`, push notifications, or deep links — build a dev client: `pnpm ios` or `pnpm android` |
| Push notifications not working | 1) Must be on a physical device (not simulator). 2) `EAS_PROJECT_ID` must be set in `app.config.ts` (run `eas init` first) |
| `EAS_PROJECT_ID is empty` warning | Run `eas init` inside `eastpark-frontend/`, paste the ID into `app.config.ts` line 10 |
| Stale Metro bundle after env change | `pnpm start -- -c` (clears Metro cache) |
| TypeScript errors after install | `pnpm type-check` to list all; `pnpm expo prebuild` if native types are stale |
| i18n strings showing key names | Translation key missing from `src/translations/en.json` or `ar.json` |
