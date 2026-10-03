# EastPark Backend — Session Context

> Claude Code loads this file automatically when invoked in `apps/backend/`.
> Root project context: see `/mnt/c/Unite/EastPark-App/CLAUDE.md`.

---

## Documentation Folder

All reference files live in `Documentation/` — read these before exploring the codebase:

| File                              | Purpose                                                                                           |
| --------------------------------- | ------------------------------------------------------------------------------------------------- |
| `Documentation/GUIDE.md`          | Architecture, tech map, DB relationships, auth flow, file uploads, real-time, how to make changes |
| `Documentation/APPCONTEXT.md`     | Full tech stack, all API routes, domain rules, all locked decisions                               |
| `Documentation/HOWTORUN.md`       | Local dev setup, all pnpm commands, Docker services, troubleshooting                              |
| `Documentation/WSL_NETWORKING.md` | WSL2 NAT explained, portproxy setup, why WSL IP changes, full phone→backend request flow          |

---

## Status

### Render production + Arabic email support — 2026-10-01

- Active API: `https://eastpark-backend.onrender.com` on Render free Docker in Frankfurt. Fly stays
  available for rollback. Web production points to Render.
- Health, Prisma, announcements, Vercel-origin CORS, and Upstash REST operations passed production
  checks during cutover. `PAYMENTS_ENABLED=false` intentionally disables Paymob for first release.
- OTP, reset-password, invitation, and support emails use Arabic/RTL defaults, an embedded official
  EastPark logo, and a responsive dark/gold shell. `EMAIL_FROM`, `EMAIL_REPLY_TO`, and
  `EMAIL_SUPPORT_TO` are configured for `eastpark.eg@gmail.com`; public company contact remains
  `info@benayat-eg.com`.
- Public `POST /v1/support/issues` is throttled to 3 requests/minute, validates the submission, and
  uses the resident's email as Reply-To. Focused support service tests pass. The web support form is
  still pending.
- Root `.github/workflows/keep-render-awake.yml` schedules a health ping every 10 minutes to reduce
  free-tier cold starts. Login also performs a best-effort web BFF warm-up.

### Render migration prepared — 2026-09-30

- The root `/render.yaml` defines a Frankfurt free Docker web service with `/health` monitoring and
  explicit production configuration. It is the only Render Blueprint; secret values remain
  dashboard-managed with `sync: false`.
- `Documentation/RENDER.md` contains the safe Fly-to-Render cutover and rollback procedure.
- Fly remains production until Render is created and health, CORS, registration, auth, and
  announcement checks pass. Web order tracking should use polling initially because free-service
  sleep cannot guarantee persistent Socket.io sessions.

### Active-unit reservation — deployed 2026-09-30

- Commit `a4ff04f` is on `main` and `origin/main`.
- `POST /v1/residents/leads` returns HTTP 409 when `(building, floor, flatNumber)` already has a
  non-`REJECTED` lead, regardless of submitted email or phone.
- Partial unique index `resident_leads_active_unit_key` closes the concurrent-request race while
  allowing a rejected unit lead to be submitted again. Prisma `P2002` maps to the same conflict.
- Production Supabase reports all 3 migrations applied. Fly release v4 is healthy in `cdg`; the
  health endpoint returns HTTP 200 with Prisma `up`.
- Validation: focused resident suite 38/38; complete backend suite 100/100; Prisma validation,
  strict typecheck, and lint pass (6 existing warnings, 0 errors).

### Web parity consumer — 2026-09-30

The deployed `eastpark-web-app` is expanding toward mobile feature parity. It uses same-origin Next.js
BFF routes and `HttpOnly` cookies; browsers should not receive backend access/refresh tokens or call
protected Fly endpoints directly. Existing backend routes and DTO behavior are authoritative. Do not
invent or duplicate endpoints for web when an existing mobile contract already serves the flow.

The parent pnpm workspace and `packages/shared` experiment are deferred. This backend remains
independently installable and does not consume it. Never move NestJS, Prisma, transport, auth, or
framework code into a shared package.

✅ **2026-09-30 — DEPLOYED TO PRODUCTION.**

- API: `https://eastpark-backend.fly.dev`
- Health: HTTP 200 with Prisma `up`
- Public lead endpoint: HTTP 200 and Supabase insert verified
- Vercel-origin CORS preflight: HTTP 204
- Remote Docker image built and pushed successfully.
- `prisma migrate deploy` connected through the Supabase session pooler and reported no pending
  migrations.
- Production startup fixes: `.swcrc` included in Docker context, production install skips Husky
  lifecycle scripts and explicitly generates Prisma, and all DTO Faker runtime imports were removed.

**Required cleanup:** rotate credentials exposed during deployment. `PAYMOB_HMAC_SECRET` is a
temporary startup-only value; configure real Paymob credentials before enabling card payments.
This does not block `POST /v1/residents/leads`.

✅ **2026-09-29 pass: 8 commits (`ef82e2c`…`43af496`), tree clean, nothing pushed.**
`pnpm typecheck` exit 0 · `pnpm lint:check` exit 0 · **tests 101/101** (was 62/62).

- Docker build **repaired** — it could not have succeeded before: the `prisma` CLI was a
  devDependency (so the production image had no binary for `migrate deploy`), and `postinstall`
  ran `prisma generate` before `prisma/` was copied. Also `exec` for SIGTERM, non-root user.
- `ResidentLead` + `ResidentsModule` — public `POST /v1/residents/leads`, 5 req/min/IP, with
  database-backed active-unit reservation. Backs the `eastpark-web-app` form. 38 focused tests.
- `User.phone @unique` **removed** (one phone belongs to an apartment, not a person),
  26 indexes added (schema had zero), and **a migration** covering all of it.
- `APP_ENV=production` in fly.toml — closes Swagger/CSP/CORS exposure. Health check on `/health`
  (**not** `/v1/health` — the controller is `VERSION_NEUTRAL`).

**2026-10-03 update (supersedes the "Open" list that used to be here):** the Paymob webhook now
verifies HMAC (from `?hmac=`), Paymob order id, amount and currency; money is `Decimal(10,2)` with
`.toNumber()` at the API boundary (migration `20261002000000_money_decimal`, not yet applied to prod);
coverage is measured across `src/**` (~40%, thresholds 37/40/73). Also: single-use refresh tokens +
session version, per-IP throttling trusted only with `BFF_INTERNAL_SECRET` (`trustProxy: 1`), OTP and
per-email login caps, order state machine, upload magic-byte sniffing + purpose folders, socket JWT auth,
email lower-casing migration `20261003000000_lowercase_emails` (run
`prisma/scripts/check-email-case.sql` on prod first). Current state, go-live runbook and backlog: root
`CLAUDE.md` → "2026-10-03" section. Card payments remain disabled (owner postponed).

**2026-09-30 — Postgres moved from Neon to Supabase.** One vendor for DB + Storage, and Neon's free
tier could not host this app: the Fly health check queries the DB every 15s, so the compute never
scale-to-zeros, and always-on burns ~183 of the 100 free CU-hours/month — suspended around day 16,
every month. Supabase free is capacity-limited (500MB), not clock-limited. `directUrl` added
(`DIRECT_DATABASE_URL`, session pooler 5432); `SMTP_HOST`/`SUPABASE_URL` now in fly.toml.
**Connection-string traps are in `README.md` step 5 — read before setting secrets.**

Earlier: all 2026-07-19 audit blockers fixed 2026-07-26 — see `backend_review.md`.

✅ All 8 phases + all 6 gaps + wiring fixes + 2 full audit passes complete. Running locally since 2026-04-02. Branch: main.

### Audit 2026-07-19 → all fixed 2026-07-26 (verified with Node v24 via nvm)

- **BE-1 ✅ FIXED:** added `descriptionAr String?` to `Election` model (schema.prisma) — was a runtime Prisma crash + tsc error. Commit `42d6eaa`.
- **BE-2 ✅ FIXED:** replaced the lone incremental migration with a single full baseline migration `00000000000000_init` (`prisma migrate diff --from-empty`) + set `migration_lock.toml` provider. `prisma migrate deploy` now builds a complete fresh DB. Commit `42d6eaa`.
- **BE-3 ✅ FIXED:** `UserResponseDto` passwordHash/pushToken made optional (3 auth.service sites); invitation DTO uses `typeof Role.MERCHANT | typeof Role.ADMIN`. `pnpm typecheck` exits 0. Commit `5853834`.
- **BE-4/5/6 ✅ FIXED:** added `CacheService` mock to `payments.service.spec.ts` — 62/62 tests pass, coverage 81.11%/77.5% (payments 29.87% → 64.5%). Commit `6b2c9c8`.
- **BE-7 ✅ FIXED:** `test.yml` rewritten for pnpm + Prisma generate + typecheck/lint/test. Commit `4b0764f`.
- **B-7 (from FE audit) ✅ FIXED:** new merchant self-service module (`src/modules/merchant/`) exposes `/merchant/shop|products|orders*`, resolving the caller's shop from the JWT — the mobile app's Merchant Tools now works (was all 404s). Commit `988e7c6`.
- **✅ Corrected:** `DELETE /user` self-delete **is implemented** (`src/modules/user/controllers/user.public.controller.ts:62-69`) — old "pending" note was wrong.

### Remaining after web launch

- Rotate Fly, Supabase/database, and Brevo credentials exposed during initial deployment.
- Configure real `PAYMOB_INTEGRATION_ID`, `PAYMOB_IFRAME_ID`, and `PAYMOB_HMAC_SECRET` before card payments.
- The Paymob webhook amount-verification and money `Float` roadmap items remain open.

---

## Local Dev State (as of 2026-04-08)

- **Docker services:** postgres + redis + mailpit + minio — all running (`pnpm docker:up`)
- **Database:** now has a full baseline migration `00000000000000_init` (2026-07-26). Fresh DBs build via `prisma migrate deploy`. (Historically the base schema was `db push`'d with only one incomplete incremental migration — fixed in BE-2.)
- **Admin seeded:** `admin@eastpark.app` (password set via `SEED_ADMIN_PASSWORD` env var)
- **`@fastify/static` installed** — required by SwaggerModule with Fastify adapter
- **Swagger fix applied** — `@ApiParam` added to `PUT /notifications/preferences/:type` to fix circular dep on `NotificationType` enum

> **Before every dev session:** Run `pnpm docker:up` first, then `pnpm dev`. Server crashes immediately without Docker.

---

## Admin Credentials

| Field    | Value                                 |
| -------- | ------------------------------------- |
| Email    | `admin@eastpark.app`                  |
| Password | Set via `SEED_ADMIN_PASSWORD` env var |

Defined in `prisma/seed-data.ts` (overridable via `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` env vars). Re-run `pnpm seed` is idempotent — skips if merchants already exist.

---

## User Roles

| Role     | Registration Flow                                                        |
| -------- | ------------------------------------------------------------------------ |
| Guest    | No auth. Read-only API access to public endpoints.                       |
| Resident | POST /auth/register → POST /auth/verify-otp → verified                   |
| Merchant | Admin sends email invite → one-time token → POST /auth/accept-invitation |
| Admin    | Admin sends email invite → one-time token → POST /auth/accept-invitation |

---

## Seed Data

Single seed file: `prisma/seed-data.ts`. `sample.json` and `seed.ts` have been deleted.

```bash
pnpm prisma:reset   # wipe DB (destructive)
pnpm seed           # seeds everything; skips if merchants already exist (idempotent)
```

**What gets seeded:**

| Entity        | Count | Detail                                                  |
| ------------- | ----- | ------------------------------------------------------- |
| Users         | 14    | 1 admin · 5 merchants · 8 residents                     |
| Shops         | 5     | café · grocery · butcher · services · health            |
| Products      | 42    | 8–10 per shop                                           |
| Orders        | 14    | all statuses: PLACED → DELIVERED, one CANCELLED         |
| Reviews       | 16    | every shop has 2–4 reviews                              |
| Announcements | 8     | mix of GENERAL / EVENT / MAINTENANCE / NEWS / PROMOTION |
| Reports       | 5     | quarterly financial + maintenance + security            |
| Polls         | 3     | 18 votes across 8 residents                             |
| Election      | 1     | 3 candidates, 6 votes                                   |
| Feedback      | 8     | 5 admin replies                                         |
| Notifications | 15    | across all types                                        |

**Test credentials:**

All seed passwords are set via environment variables: `SEED_ADMIN_PASSWORD`, `SEED_MERCHANT_PASSWORD`, `SEED_RESIDENT_PASSWORD`. See `.env.example`.

| Role      | Email                      |
| --------- | -------------------------- |
| Admin     | `admin@eastpark.app`       |
| Merchants | `merchant1–5@eastpark.app` |
| Residents | `resident1–8@eastpark.app` |

---

## Stack (locked)

| Layer           | Choice                                                                |
| --------------- | --------------------------------------------------------------------- |
| Framework       | NestJS + Fastify adapter (NOT Express)                                |
| Package manager | pnpm                                                                  |
| ORM             | Prisma + PostgreSQL (Supabase free tier in prod)                      |
| Cache           | ioredis → Upstash Redis in prod (OTP, rate limiting, token blacklist) |
| File storage    | Supabase Storage (prod) / MinIO docker (dev)                          |
| Email           | Brevo SMTP (prod) / Mailpit docker (dev)                              |
| Push            | Expo Push Service inline — no BullMQ, no queues                       |
| Real-time       | Socket.io WebSocket gateway — namespace `/orders`                     |
| Cron            | @nestjs/schedule — election auto-open every 5min                      |
| Rate limiting   | @nestjs/throttler — max 5 req/min on `/auth/*`                        |
| Hosting         | Fly.io `cdg` (Paris), `auto_stop_machines = false`                    |

---

## Project Structure

```
src/
├── main.ts                  # Fastify bootstrap, Swagger, global prefix /v1, versioning
├── app.module.ts
├── common/
│   ├── config/              # ConfigService wrappers (never raw process.env in services)
│   ├── database/            # DatabaseService (PrismaClient wrapper)
│   ├── doc/                 # DocResponse, DocGenericResponse decorators
│   ├── request/             # @AuthUser(), @AllowedRoles(), IAuthUser interface
│   └── response/            # ApiGenericResponseDto
└── modules/
    ├── auth/                # register, OTP, login, refresh, logout, forgot/reset, accept-invitation, push-token
    ├── shops/               # shops CRUD + photos + reviews + saved-shops
    ├── orders/              # orders REST + Socket.io /orders gateway
    ├── payments/            # Paymob 3-step initiation + HMAC-SHA512 webhook
    ├── announcements/       # CRUD + cursor pagination + AnnouncementCategory filter
    ├── comments/            # Announcement comments
    ├── reports/             # PDF report listings (separate from Announcements)
    ├── feedback/            # Feedback CRUD + replies + anonymous masking
    ├── polls/               # Polls + one-vote guarantee (@@id([userId, pollId]))
    ├── elections/           # Elections + candidates + @Cron auto-open + ElectionVisibilityMode
    ├── notifications/       # Expo Push inline + in-app feed + preferences (GET/PUT /preferences/:type)
    ├── invitations/         # Admin send (POST) + list (GET) invitations
    └── user/                # Public (profile GET, update PUT, self-delete DELETE) + Admin (delete by id)
```

---

## Key Patterns

**ConfigService everywhere.** Never `process.env.KEY` in services — always `this.configService.get<string>('KEY')`.

**Auth decorators:**

- `@AllowedRoles([Role.RESIDENT])` — restrict endpoint by role
- `@AuthUser() actor: IAuthUser` — extracts `{ userId, role }` from JWT payload

**Cursor pagination (all list endpoints):**

```typescript
take: limit + 1,
...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
orderBy: { createdAt: 'desc' },
// After query: if items.length > limit → items.pop(); nextCursor = last.id
```

**Response format.** DocResponse interceptor wraps all responses: `{ success: true, message: 'i18n.key', data: ... }`.

**OTP / reset tokens.** Stored in Redis with TTL. OTP: 10min (`OTP_TTL = 600`). Reset token: 30min.

**Paymob flow:**

1. `POST /v1/orders/:id/pay/paymob` [RESIDENT] → auth token → register order → payment key (all via Paymob API)
2. Returns `{ paymentKey, iframeUrl }` — FE opens iframe
3. Webhook: `POST /webhooks/paymob` — HMAC-SHA512 verified, idempotent via Redis, flips `order.isPaid = true`

**Socket.io.** Namespace `/orders`. Emit `order:status` on status change.

**Product soft-delete.** `isDeleted: Boolean @default(false)`. Always `where: { isDeleted: false }` on queries.

**Shop photos.** `ShopPhoto.order: Int` — always `orderBy: { order: 'asc' }`. Service derives `isPrimary: index === 0` from sorted array. FE uses `photo.isPrimary` to find the cover.

**Auth responses.** `passwordHash` and `pushToken` are always stripped from user objects in `verifyOtp`, `login`, and `acceptInvitation` before returning `{ ...tokens, user }`.

**Photo ownership.** `addPhoto` / `removePhoto` enforce `shop.merchantId === actor.userId` for MERCHANT role. ADMINs bypass this check.

**Feedback access.** `GET /feedback/:id` — only ADMIN can read any feedback; all other roles are restricted to their own submissions.

**Anonymous feedback.** Strip `userId`/`author` from response when `isAnonymous: true`.

> All domain rules and locked decisions → see `Documentation/APPCONTEXT.md`

---

## Env Vars (see `.env.example` for full list)

```
AUTH_ACCESS_TOKEN_SECRET=""    # generate: openssl rand -base64 48
AUTH_REFRESH_TOKEN_SECRET=""   # must differ from above
DATABASE_URL=""
REDIS_URL=""
PAYMOB_API_KEY=""              # prod only
PAYMOB_HMAC_SECRET=""          # prod only
PAYMOB_INTEGRATION_ID=""       # prod only — fly secrets set
PAYMOB_IFRAME_ID=""            # prod only — fly secrets set
```

---

## Commit Convention

Format: `[AhmedMuhammedElsaid][feat|fix|chore|docs]: description`
Always use `--no-verify` (WSL cannot run node/pnpm hooks). Branch: main.

---

## Prisma

Schema: `prisma/schema.prisma`. After schema changes:

```bash
pnpm prisma:migrate      # create + apply migration (dev)
pnpm prisma:generate     # regenerate client after schema change
pnpm seed                # seeds admin@eastpark.app (idempotent)
```

---

## Local Dev

```bash
pnpm docker:up    # ALWAYS first — postgres + redis + mailpit + minio
pnpm dev          # NestJS hot-reload on http://localhost:3000/v1
```

| URL                        | Purpose                               |
| -------------------------- | ------------------------------------- |
| http://localhost:3000/docs | Swagger UI                            |
| http://localhost:8025      | Mailpit (emails)                      |
| http://localhost:9001      | MinIO console (credentials in `.env`) |
| http://localhost:5555      | Prisma Studio (`pnpm prisma:studio`)  |

---

## Deploy

```bash
fly secrets set PAYMOB_INTEGRATION_ID=<val> PAYMOB_IFRAME_ID=<val>
fly deploy
```

Region: `cdg` (Paris). Dockerfile CMD: `npx prisma migrate deploy && node dist/main`.
