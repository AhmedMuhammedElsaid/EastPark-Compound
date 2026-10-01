# EastPark Backend + Mobile — Completion Roadmap

**Produced:** 2026-09-29 · **Mode:** read-only audit (no code edits, no migrations, no commits)
**Verified against:** backend `b293bba` (tree clean) · frontend `a17f0cd` (3 modified files)
**Toolchain:** default shell Node is v12.22.9 and cannot run the tooling — every command below assumes `. ~/.nvm/nvm.sh && nvm use 24`. The `fly` and `vercel` CLIs are **not installed**.

Item format: `[P0|P1|P2] — title — file:line — what to change — how to verify`

> **Update 2026-09-29 (later the same day) — first implementation pass COMMITTED.**
> Backend commits `ef82e2c`, `f02651d`, `67c05be`, `986464e`, `c7e9c29`, `dd35173`, `0e97846`
> on `main`. Verified before committing: `pnpm typecheck` exit 0, `pnpm lint:check` exit 0
> (6 pre-existing warnings), **`pnpm test` 62/62 passing**.
>
> **Done (backend):** Docker build blockers (2e) · `APP_ENV` + CORS + health check (2a/2d) ·
> `getOrThrow` empty-string defaults (2b) · `prisma.seed` hook (1b) · `ResidentLead` +
> `User.phone` unique removal + 26 indexes (1a/1b) · `ResidentsModule` · **a migration covering
> all of it**.
>
> **Done (frontend — commits `9fef982`, `9743231`, `03d13bd` on `main`):** the `tsconfig.json`
> type-check blocker (3c) — type-checking now genuinely runs (3280 files, exit 0) and the
> codebase was clean underneath, so the *tooling* was the bug. Lint went 3915 errors → 37
> problems, all deliberately deferred (`max-lines-per-function`, `no-array-index-key` — both
> design decisions). Markdown excluded from ESLint. Tests still **41/41**.
> Four real user-facing bugs fell out of the now-working lint:
> 1. `merchant.pending_count_waiting` rendered the literal `{{n}}` instead of the order count —
>    the i18n validator rejects single-character interpolation names, so it never substituted.
> 2. `checkbox.tsx:166` used `bg-primary-300`, absent from the token scale — the checked
>    checkbox's inner dot had no background at all.
> 3. `use-auth-rehydration.ts` suppressed `exhaustive-deps` and omitted `dispatch`.
> 4. A dead unused variable in the merchant menu delete handler.
>
> **Not done:** Float→Decimal (1b) · the webhook amount check (Part 4) · `directUrl` pooling (1b)
> · EAS env vars and submit block (3a/3b) · Stage 7 test debt — including **zero tests on the new
> `ResidentsModule`**, which is now a public unauthenticated write endpoint.
>
> **Two things verified by reasoning, NOT by execution** — the Docker daemon is unreachable in
> this WSL environment and no database was available:
> 1. `docker build` has never been run against the fixed Dockerfile.
> 2. `prisma migrate deploy` has never been run against the new migration. The SQL was generated
>    by `prisma migrate diff` and audited statement-by-statement (30 statements; the only
>    destructive one is the intended `DROP INDEX users_phone_key`), but it has not been applied
>    to a real database.
>
> Priority has shifted: **`eastpark-web-app` ships first.** See `../../restructure.md` for the
> deferred monorepo work.

---

## Corrections to prior documents

The verdict paragraphs in `backend_review.md` and `frontend_review.md` are stale, and three claims from the earlier migration audit did not survive verification:

- **Whole-repo test coverage is 12.44%, not 81.11%.** The 81.11% figure is real but averaged over 5 hand-picked files in `test/jest.json` `collectCoverageFrom`. Measured directly (see Part 4).
- **9 modules have zero tests, not 8** — `announcements, feedback, invitations, merchant, products, reports, shops, uploads, user`. Verified by enumeration.
- **The CORS exposure is worse than "defaults to `*`".** `app.config.ts:6-10` converts `'*'` into boolean `true`, and `@fastify/cors` with `origin: true` **reflects the caller's Origin header**. A literal `*` is what browsers reject alongside `credentials: true`; origin reflection is accepted, so credentialed cross-origin reads from any site actually work. See P0-2.

Four findings are new — no prior document mentions them:

- **The Docker build cannot succeed**, so `fly deploy` fails today regardless of secrets. See 2e.
- **The Paymob webhook never verifies the paid amount** (`payments.service.ts:135-149`). See Part 4.
- **Frontend type-checking has never run** — `tsconfig.json:4` aborts `tsc` at config parsing, so every "TS clean" claim in the docs is unfounded. See 3c.
- **`package-lock.json` is tracked in git** in a pnpm-only repo, not untracked as assumed. See 3e.

---

## PART 1 — DATABASE

### 1a. `ResidentLead` — new model for the public web form

Context confirmed against source: `User.passwordHash` is required (`schema.prisma:91`) and `User.email` is `@unique` (`:88`), so a public form cannot create a `User`. Nothing models building/floor/flat/parking — `User` has only free-text `unitNumber String?` (`:90`).

House conventions the model follows: `String @id @default(cuid())` (`:86`, `:117`, `:134`) · `createdAt`/`updatedAt` pair (`:96-97`) · `@@map("snake_case_plural")` on all 23 models · zero column-level `@map` and zero `@db.` native types · enums SCREAMING_SNAKE, declared together in the top block (`:13-81`) · soft-delete is **not** a house pattern (only `Product.isDeleted:181`, justified by OrderItem FK preservation).

- **[P1] — Add `ResidentLead` model + `ResidentLeadStatus` enum — `prisma/schema.prisma` (new, after `Invitation` ~:129) — see the schema block below — verify: `pnpm prisma validate && pnpm prisma migrate dev --name add_resident_lead` then `pnpm prisma studio` shows an empty `resident_leads` table**
- **[P1] — Widen invitation role to accept RESIDENT — `src/modules/invitations/dtos/request/invitation.create.dto.ts:11-13` — currently typed/validated `MERCHANT | ADMIN` only; lead→User conversion needs `RESIDENT` — verify: `pnpm typecheck` clean + a POST with `role: "RESIDENT"` is accepted**
- **[P1] — `acceptInvitation` must persist unit data — `src/common/auth/services/auth.service.ts:221-262` — it currently sets neither `unitNumber` nor `phone`, so converted leads lose their building/floor/flat — verify: accept an invitation and assert the new `User.unitNumber` is populated**

```prisma
enum ResidentLeadStatus {
  PENDING
  INVITED
  CONVERTED
  REJECTED
}

// ─── Resident Leads (public web form) ─────────────────────────────────────────

model ResidentLead {
  id          String             @id @default(cuid())
  name        String
  email       String
  phone       String
  building    String
  floor       String
  flatNumber  String
  parking     String?
  status      ResidentLeadStatus @default(PENDING)
  notes       String?            // admin triage notes
  createdAt   DateTime           @default(now())
  updatedAt   DateTime           @updatedAt

  userId String?
  user   User?   @relation("ResidentLeadUser", fields: [userId], references: [id], onDelete: SetNull)

  @@index([status, createdAt])
  @@index([email])
  @@index([building, floor, flatNumber])
  @@index([userId])
  @@map("resident_leads")
}
```

Plus one relation line in `model User` alongside `invitations` (`:111`):

```prisma
  residentLeads     ResidentLead[] @relation("ResidentLeadUser")
```

**Uniqueness rule (service-layer, not a DB constraint).** Before insert, `findFirst` on normalized `email` + `building` + `floor` + `flatNumber` where `status != REJECTED`. On a hit, **update the existing row and return 200** — an idempotent re-submission. The user always reaches the thank-you page; the public endpoint never returns 409 or 500 for a duplicate. A hard `@@unique([building, floor, flatNumber])` was rejected because roommates, a new tenant replacing an old one, and correction resubmissions are all legitimate. Prisma 6.19.0 cannot express partial unique indexes (that is a 7.4 preview feature), so a conditional constraint would need hand-written raw SQL and would still 500 on a race. Accepted trade-off: a rare duplicate row under concurrent double-submit, absorbed by admin triage.

**Field-type decisions.** `floor`/`flatNumber` are `String` (leading zeros like "01", and future "G"/"M" floors; the 1..11 and 1..5 ranges are enforced in the DTO). `building` is `String` backed by a config constant — an enum would move the building list into the schema and force a migration to add one, contradicting the settled "editable in ONE place" decision. Email is stored `.toLowerCase().trim()` to match `auth.service.ts:64,120,186` — the lead→User match must be casing-identical. Phone should be normalized to E.164 (`0…`→`+20…`) or MENA prefix variants defeat duplicate detection.

**Lead → User conversion.** Nullable FK `userId` rather than email-only matching, so provenance survives a later email change.

1. Public form → `POST /v1/residents/leads` (`@PublicRoute()` + `@Throttle`) → row at `PENDING`.
2. Admin lists via `GET /v1/admin/residents/leads?status=PENDING&cursor=`, cursor-paginated exactly as `invitations.service.ts:66-91`.
3. Admin approves → `POST /v1/admin/residents/leads/:id/invite`.
4. If a `User` with that email already exists → skip the invite, set `lead.userId` + `status = CONVERTED`, return 200 "already registered". **Never overwrite an existing account.**
5. Otherwise create an `Invitation` row via `InvitationsService.create()` with `role: RESIDENT`.
6. Lead → `status = INVITED`; resident opens the deep link → existing `POST /v1/auth/accept-invitation`.
7. Post-create hook sets `lead.userId`, `status = CONVERTED`, and writes `unitNumber` + `phone` onto the new `User`.

Building/floor/flat compose into the existing `User.unitNumber` string at conversion; the structured fields stay on the lead. This avoids adding 4 columns to `users`.

### Approved decisions (2026-09-29)

All open questions resolved. **This schema is the settled contract — Prompt B builds against it.**

| Question | Decision |
|---|---|
| Multi-flat owners | **One `User`, many leads linked.** Each flat is its own `ResidentLead` row pointing at the same User via the nullable FK. `User.unitNumber` holds the primary flat; the full set lives on the leads. No new columns on `users`. |
| `User.phone @unique` | **Remove it.** *(see below)* |
| IP capture | **No.** `submittedIp` omitted — PII with no `trustProxy` configured, so it would log Fly's proxy rather than the client. Abuse control is the throttler guard alone. |
| Module placement | **New `ResidentsModule`** (`src/modules/residents/`) owning both the public POST and the admin list/invite routes. |
| `unitNumber` format | Match the existing compact seed style (`"A101"`, `"B201"` — `seed-data.ts:128-205`), not a delimited form. Nothing parses it; it is display/storage only (verified — `unitNumber` appears in 4 places, all read/write, never split). |

**Domain rule captured:** one phone number belongs to an *apartment*, not a person — and one person may own several apartments. Phone→flat is therefore one-to-many.

- **[P1] — Drop `@unique` from `User.phone` — `prisma/schema.prisma:89` — `phone String?` — the constraint assumes one phone per person, but the real rule is one phone per apartment; a multi-flat owner registering their second flat currently hits it and 500s at accept-invitation. Verified safe: **zero queries anywhere in the backend filter or look up by phone** (`grep` over `src/` returns no `where`-clause hits), so the constraint protects no feature. Duplicate detection moves entirely to `email + building + floor + flatNumber` — verify: the same phone can be saved on two Users, and a second-flat conversion completes without error**

Accepted trade-off: two genuinely different people can now record the same phone. That is consistent with the one-phone-per-apartment model and is a data-quality question, not a crash.

**Still unresolved, but not blocking** — decide before launch, not before Prompt B:

- Retention for REJECTED/CONVERTED leads holding name/email/phone. Nothing in the codebase does scheduled deletion today.

---

### 1b. Four known database gaps

#### Money stored as `Float`

Exactly 3 money fields exist (`grep -n "Float" prisma/schema.prisma` → 3 hits). No other Float fields; `Review.rating` is `Int` (`:237`) and `averageRating` is a derived `_avg` aggregate, not a column — neither is affected.

- **[P1] — `Product.price` Float→Decimal(10,2) — `prisma/schema.prisma:178` — `price Decimal @db.Decimal(10,2)` — verify: `pnpm typecheck` surfaces every arithmetic site as TS2362**
- **[P1] — `Order.totalAmount` Float→Decimal(10,2) — `prisma/schema.prisma:198` — same — verify: as above**
- **[P1] — `OrderItem.unitPrice` Float→Decimal(10,2) — `prisma/schema.prisma:221` — same — verify: as above**
- **[P1] — Rewrite order-total arithmetic for Decimal — `src/modules/orders/orders.service.ts:82,85,86` — `let totalAmount = 0` → `new Prisma.Decimal(0)`; `product.price * item.quantity` → `.times(...)`; `totalAmount += lineTotal` → `.plus(...)` — verify: measured drift case `60.269999999999996` must become exactly `60.27`**
- **[P0] — Fix the piastres conversion — `src/modules/payments/payments.service.ts:175` — `Math.round(order.totalAmount * 100)` re-enters float and is the figure actually charged to a card; use `order.totalAmount.times(100).toNumber()` — verify: assert exact piastres for a fractional total**
- **[P1] — Keep the API emitting JSON numbers — `src/modules/products/products.service.ts:45,93,101,113` and the `orders.service.ts` return sites (`:109,148,172,218,264`) — map `.toNumber()` at the boundary — verify: `curl` an order and confirm `totalAmount` is a JSON number, not a quoted string**
- **[P2] — Update the money assertion — `test/modules/orders.service.spec.ts:134` — `toBe(150)` → `toEqual(new Prisma.Decimal(150))` — verify: `pnpm test` green**

**API-contract impact — BREAKING unless the boundary mapping lands with the migration.** Prisma returns `Prisma.Decimal` objects; `JSON.stringify(new Prisma.Decimal('35.50'))` emits the **string** `"35.5"` and drops trailing zeros. The frontend declares every money field as `number` (`services/api/orders.ts:20,21,29`, `shops.ts:27`, `merchant.ts:27,35,44`) with no response validation — Axios generics over `any`, so FE typecheck stays green while values are silently wrong. The three cart totals survive only by operator precedence (`*` binds before `+`), and `formatCurrency` survives because `Intl.NumberFormat.format` coerces strings — but its catch-branch fallback `amount.toFixed(2)` (`src/lib/formatCurrency.ts:14`) **throws** on a string.

With the `.toNumber()` mapping in step 6 above, the wire format is unchanged and **no new mobile build is required**. Without it, already-installed apps break and cannot be fixed forward — do not take that path.

**Migration safety.** `pnpm prisma migrate dev --name money_float_to_decimal` generates three `ALTER TABLE … SET DATA TYPE DECIMAL(10,2)` statements with no `USING` clause, so Postgres applies the default float8→numeric cast, which **rounds half-up to 2dp** (`19.999` → `20.00`) — silent and irreversible. Values above 99,999,999.99 abort the migration loudly; max seeded value is 800. `ALTER COLUMN TYPE` takes ACCESS EXCLUSIVE and rewrites the table, but at 42 products / 14 orders / ~30 order_items that is milliseconds — no maintenance window. Rollback is genuinely lossless **today** because all current values are whole integers (zero fractional literals in seed data); it stops being lossless the moment real fractional orders land. `Decimal(10,2)` is correct for EGP — 2dp maps exactly onto piastres.

#### Zero non-unique indexes

Confirmed: **zero `@@index` declarations across all 466 schema lines**, despite cursor pagination on every list endpoint. Postgres auto-creates indexes for PRIMARY KEY and UNIQUE only — foreign keys get none. The cursor pattern is `take: limit + 1, ...(cursor ? { skip: 1, cursor: { id } } : {}), orderBy: { createdAt: 'desc' }` (verified `orders.service.ts:136-138`).

- **[P1] — Add the missing indexes — `prisma/schema.prisma` — block below — verify: `EXPLAIN ANALYZE` on the orders list shows an Index Scan, not a Seq Scan**

| Model | Index | Justifying query | Priority |
|---|---|---|---|
| Order | `@@index([residentId, createdAt])` | orders.service.ts:121,136-138 | high |
| Order | `@@index([shopId, createdAt])` | orders.service.ts:128,136-138 | high |
| Order | `@@index([status])` | orders.service.ts:132 | med |
| OrderItem | `@@index([orderId])` | orders.service.ts:139; user.service.ts:56,67 (cascade) | high |
| Shop | `@@index([merchantId])` | orders.service.ts:124; merchant.service.ts:42 | high |
| Shop | `@@index([category, createdAt])` | shops.service.ts:52-76 | high |
| Product | `@@index([shopId, isDeleted, createdAt])` | products.service.ts:56-84 | high |
| Review | `@@index([shopId, createdAt])` | reviews.service.ts:17-21 | high |
| Feedback | `@@index([userId, createdAt])` | feedback.service.ts:55-64 | high |
| Notification | `@@index([userId, isRead, createdAt])` | notifications.service.ts:107-119 | high |
| Election | `@@index([expiresAt, resultsOpen])` | elections.service.ts:33-39 (@Cron) | high |
| ShopPhoto | `@@index([shopId, order])` | shops.service.ts:37,78,114,161 | med |
| Comment | `@@index([announcementId, createdAt])` | announcements.service.ts:55 | med |
| FeedbackReply | `@@index([feedbackId, createdAt])` | feedback.service.ts:87 | med |
| Vote | `@@index([pollId])` | polls.service.ts (_count votes) | med |
| ElectionVote | `@@index([electionId])` | elections.service.ts:117-123,145-151 | med |
| Candidate | `@@index([electionId])` | elections.service.ts:118,145,169 | med |
| OrderItem | `@@index([productId])` | schema.prisma:228 FK, uncovered | med |
| Feedback | `@@index([category])`, `@@index([status])` | feedback.service.ts:57-58 | low |
| Invitation | `@@index([invitedById])` | user.service.ts:79 deleteMany | low |
| AuditLog | `@@index([userId])` | user.service.ts:46 deleteMany | low |

`SavedShop` needs nothing — `@@id([userId, shopId])` (`:256`) already covers both the `userId` prefix and the composite cursor.

Run as one migration: `pnpm prisma migrate dev --name add_missing_indexes`. Plain `CREATE INDEX` takes a SHARE lock blocking writes, and Prisma wraps migrations in a transaction so `CREATE INDEX CONCURRENTLY` is not available. At current volume the window is milliseconds — safe now. Against a populated production DB later, hand-edit the migration to run concurrently outside the transaction.

#### ✅ RESOLVED 2026-09-30 (commit `e4bb326`) — pooling story + vendor change

Was: `grep -rn "directUrl\|pgbouncer\|connection_limit"` returned **zero matches** repo-wide.

**Postgres also moved Neon → Supabase.** Neon free allows 100 CU-hours/month; the Fly health check
queries the DB every 15s (`health.controller.ts:24`) so compute never scale-to-zeros, costing ~183
CU-hours/month — suspended around day 16 of every month. Supabase free is capacity-limited (500MB),
not clock-limited, and Storage already lived there.

- **[P1] ✅ DONE — `directUrl` added — `prisma/schema.prisma:8-15` — `DATABASE_URL` = Supabase transaction pooler `:6543` + `?pgbouncer=true&connection_limit=1`; `DIRECT_DATABASE_URL` = session pooler `:5432` — verify: `pnpm prisma migrate deploy` succeeds and the app still serves traffic**

Connection-string traps (all fail silently) are documented in `README.md` step 5: pooler host only
(`db.<ref>.supabase.co` is IPv6-only, Fly has no public IPv4 egress), percent-encode the password,
and the pooler username is `postgres.<project-ref>`.

Without this, `migrate deploy` runs through pgbouncer, where advisory locks and prepared statements misbehave. The Fly VM is 256MB with one shared CPU (`fly.toml:19-22`), so a low `connection_limit` is right.

#### `migrate reset` will not reseed

Verified: `package.json` has a `seed` **script** (`"seed": "ts-node -r tsconfig-paths/register prisma/seed-data.ts"`) but **no top-level `"prisma": { "seed": ... }` config key** — which is the only thing `prisma migrate reset` and `prisma db seed` read.

- **[P2] — Register the seed hook — `package.json` (new top-level key) — add `"prisma": { "seed": "ts-node -r tsconfig-paths/register prisma/seed-data.ts" }` — verify: `pnpm prisma migrate reset` ends with seed output and `admin@eastpark.app` exists**

### 1c. Part 1 ranking

**Must fix before launch:** the piastres conversion (P0); `ResidentLead` + the two conversion-path fixes (P1, blocks the web app); Float→Decimal with the boundary mapping (P1, free now and a migration project later); the high-priority indexes (P1); `directUrl` (P1 — ✅ done, or `migrate deploy` is unreliable through the pooler).

**Can wait:** low-priority indexes, the seed hook, the spec assertion.

---

## PART 3 — MOBILE APP TO A WORKING BUILD

### 3a. EAS environment variables

Confirmed: none of the four build profiles (production/preview/development/simulator) supplies `EXPO_PUBLIC_API_URL` or `EXPO_PUBLIC_SOCKET_URL` — each sets only `EXPO_PUBLIC_APP_ENV`. Both fall through to a `http://localhost:3000` default (`env.ts:12-13`), which is unreachable from a device.

`eas env:list --environment production` **could not be run here** — `npx eas-cli env:list` (eas-cli 19.0.5, Node 24) failed with a TLS error before reaching auth: `write EPROTO … packet length too long`. That is this WSL sandbox's network, not a login or CLI problem. `whoami` also timed out. **You must run this yourself to confirm whether the values are already set on the EAS dashboard.**

- **[P0] — Cloud builds ship pointing at localhost — `apps/mobile/env.ts:12-13` — set the vars in EAS (commands below) or every store build is dead on launch — verify: `eas env:list --environment production` lists both, then check the built app hits the real API**

```bash
eas env:create --environment production --name EXPO_PUBLIC_API_URL    --value https://eastpark-backend.fly.dev --visibility plaintext
eas env:create --environment production --name EXPO_PUBLIC_SOCKET_URL --value https://eastpark-backend.fly.dev --visibility plaintext
eas env:create --environment preview    --name EXPO_PUBLIC_API_URL    --value https://<staging-host> --visibility plaintext
eas env:create --environment preview    --name EXPO_PUBLIC_SOCKET_URL --value https://<staging-host> --visibility plaintext
```

Note: no `/v1` suffix — `services/api/client.ts:30` appends it.

### 3b. `eas.json` submit block

Confirmed: `"submit": { "preview": {}, "production": {} }` — both empty, so store submission is impossible as configured.

- **[P1] — Fill the submit block — `apps/mobile/eas.json` — JSON below — verify: `eas submit -p ios --profile production --dry-run` resolves credentials without prompting**

```json
"submit": {
  "production": {
    "ios": {
      "appleId": "<apple-id@example.com>",
      "ascAppId": "<app-store-connect-app-id>",
      "appleTeamId": "<apple-team-id>",
      "ascApiKeyPath": "./credentials/AuthKey_XXXXXXXXXX.p8",
      "ascApiKeyId": "<asc-api-key-id>",
      "ascApiKeyIssuerId": "<asc-api-key-issuer-id>"
    },
    "android": {
      "serviceAccountKeyPath": "./credentials/google-service-account.json",
      "track": "internal",
      "releaseStatus": "completed"
    }
  },
  "preview": {
    "ios": { "appleId": "<apple-id@example.com>", "ascAppId": "<asc-app-id>", "appleTeamId": "<apple-team-id>" },
    "android": { "serviceAccountKeyPath": "./credentials/google-service-account.json", "track": "internal" }
  }
}
```

| Key | Platform | How to obtain |
|---|---|---|
| `appleId` | iOS | Apple Developer account email (or set `EXPO_APPLE_ID`) |
| `ascAppId` | iOS | App Store Connect → App Info → General → Apple ID (numeric). Optional — omitting lets `eas submit` create the app entry |
| `appleTeamId` | iOS | developer.apple.com → Membership → Team ID |
| `ascApiKeyPath` / `Id` / `IssuerId` | iOS | App Store Connect → Users and Access → Integrations → Generate API Key. All three together replace interactive auth — required for CI |
| `serviceAccountKeyPath` | Android | Play Console → Setup → API access → service account in GCP → download JSON |
| `track` | Android | `production` \| `beta` \| `alpha` \| `internal` |
| `releaseStatus` | Android | `completed` \| `draft` \| `halted` \| `inProgress` |

Schema confirmed against https://docs.expo.dev/eas/json/ (and `eas-cli` `packages/eas-json/src/submit/types.ts`). Keep the `.p8` and the service-account JSON out of git.

### 3c. Frontend verification run — MEASURED

Ran under Node v24.15.0 / pnpm 10.33.0, each command separately. **This is the first time the frontend has been verified on a working toolchain, and it is not green.**

| Command | Exit | Errors | Warnings |
|---|---|---|---|
| `pnpm run type-check` | **2** | 1 config error — **blocks all type checking** | 0 |
| `pnpm run lint` | **1** | 3915 | 24 |
| `pnpm run test` | **0** | 0 | 41/41 tests, 5/5 suites |

Script names confirmed: `type-check` (hyphenated), `lint`, `test`. There is no `typecheck` script.

- **[P0] — Type-checking has never actually run — `apps/mobile/tsconfig.json:4` — `"ignoreDeprecations": "6.0"` is invalid for the installed TypeScript 5.9.3, which accepts only `"5.0"`. `tsc` aborts at config parsing with `TS5103` before evaluating a single file, so **zero files are type-checked** and every "TS clean" claim in the project docs is unfounded. Change to `"5.0"` or remove the key — verify: `pnpm run type-check` gets far enough to report real errors (expect a backlog on first successful run)**

I reproduced this directly: `tsc --noemit` under Node 24 → `tsconfig.json(4,27): error TS5103: Invalid value for '--ignoreDeprecations'.`, exit 2.

- **[P1] — Lint fails with 3915 errors — `apps/mobile/` — 3810 of them (97%) are a single root cause: `eslint.config.mjs` sets `quotes: "double"` while essentially every source file uses single quotes. `eslint . --fix` resolves 3839 mechanically — verify: `pnpm lint` error count drops to ~76**
- **[P1] — ESLint is linting Markdown as TypeScript — `README.md`, `claude.md`, `Documentation/*.md` — the antfu config parses embedded code fences as standalone TS, producing 13 parsing errors plus ~20 spurious `react-hooks/*` and `react-compiler` errors against prose fragments. All 7 `rules-of-hooks` hits are artifacts, not real violations. Add the docs to the ESLint ignore list — verify: no errors reported against `.md` files**
- **[P2] — Real lint findings behind the noise — after `--fix` and ignoring docs, the genuine set is small: 2 i18n interpolation errors (`merchant.pending_count_waiting` in both `ar.json` and `en.json`), 25 `unicorn/filename-case` violations (`formatCurrency.ts`, `authSlice.ts`, `cartSlice.ts`, `preferencesSlice.ts`), 10 `max-lines-per-function`, 5 `max-statements-per-line`, 16 `no-array-index-key` warnings, 1 unused var (`(merchant)/menu/index.tsx:99`), 1 unknown Tailwind class (`bg-primary-300` in `checkbox.tsx:166`), and a missing-deps warning on animation code — verify: `pnpm lint` clean**

**Tests pass cleanly: 41/41 across 5 suites, exit 0.** Note the doc claim of "5 auth tests" undercounts — 41 is the real total. The suite takes ~12.5 min (`login-form.test.tsx` alone is 730s on the mounted drive), so budget for it in CI.

`pnpm type-check` will not catch the Decimal breakage in Part 1b even once fixed — the money fields cross an untyped Axios boundary.

### 3d. Preview profile mismatch

Confirmed: the preview profile mixes `"distribution": "store"` with `android.buildType: "apk"`. Play has not accepted new APK uploads since August 2021 (AAB only), and `store` vs `internal` changes which credentials EAS provisions — so a `store`-distribution APK cannot actually be delivered anywhere.

- **[P2] — Fix the preview profile — `apps/mobile/eas.json` (preview block) — set `"distribution": "internal"` and keep `buildType: "apk"` (correct for shareable internal test builds) — verify: `eas build -p android --profile preview` produces an installable APK with an internal share link**

### 3e. Repo hygiene

All three modified files are **whitespace-only** — `git diff --ignore-all-space` is empty for each; the working copies have CRLF against LF in HEAD.

- **[P2] — Resolve CRLF churn — `.env.example`, `eslint.config.mjs`, `src/lib/hooks/use-biometric.ts` — `git checkout --` all three, then add a `.gitattributes` with `* text=auto eol=lf` to stop recurrence — verify: `git status --short` clean**
- **[P2] — Remove the stray npm lockfile — `apps/mobile/package-lock.json` — **it is tracked in git** (not untracked, as prior notes assumed) in a pnpm-only repo; `git rm --cached package-lock.json`, delete it, and add it to `.gitignore` — verify: `git ls-files package-lock.json` returns nothing**

---

## PART 4 — TESTING HONESTY

**The headline number is scoped, not wrong.** `test/jest.json` `collectCoverageFrom` lists exactly 5 files: `auth.service.ts`, `payments.service.ts`, `polls.service.ts`, `orders.service.ts`, `notifications.service.ts`. Averaged over those, coverage is genuinely 81.11% and all 62 tests pass (`pnpm test`, 281s, exit 0). The 70% `coverageThreshold` therefore gates only those 5 files — it is not a repo-wide gate.

**Real whole-repo coverage, measured** — same suite, `--collectCoverageFrom='src/**/*.ts'`:

```
All files    |   12.44 % Stmts |   38.28 % Branch |   12.86 % Funcs |   12.44 % Lines
Test Suites: 5 passed, 5 total
Tests:       62 passed, 62 total
```

**12.44%, not 81.11%.** Every controller in the codebase is at 0% — that is the layer enforcing auth and role guards. The Socket.io orders gateway sits at 57.89%. `elections.service.ts` is 0%.

**9 of 13 modules have zero test files** (verified by enumeration): `announcements, feedback, invitations, merchant, products, reports, shops, uploads, user`. Four have partial coverage (`governance, notifications, orders, payments`) and in each only one service file is covered. **Zero e2e tests exist** — 5 spec files total, all unit tests under `test/`, no `*.e2e-spec.ts` anywhere.

- **[P2] — Stop the coverage figure from misleading — `test/jest.json` `collectCoverageFrom` — broaden to `src/**/*.ts` and set the threshold to the real current number, then ratchet upward — verify: `pnpm test` reports whole-repo coverage**

### Minimum test set before launch

**Tier 1 — money and irreversible writes**

- **[P0] — Test the Paymob webhook controllers — `src/modules/payments/payments.controller.ts`, `payments-initiate.controller.ts` (both 0%) — the HTTP layer receiving untrusted external payloads is entirely unverified; cover signature-invalid rejection, replay/idempotency, and the happy path, driven through the real Fastify route — verify: `pnpm test` covers both controllers**
- **[P0] — Verify the webhook amount — `src/modules/payments/payments.service.ts:135-149` — **new finding:** the webhook checks HMAC and idempotency but **never compares `obj.amount_cents` against `order.totalAmount`** before flipping `isPaid = true`. A valid-signature callback for a different amount marks the order paid. Add the comparison and a test — verify: a webhook with a mismatched amount is rejected**
- **[P1] — Test order state transitions — `src/modules/orders/orders.controller.ts` (0%), `orders.gateway.ts` (57.89%) — server-side `totalAmount` computation and the same-shop rule are partly enforced in the controller/DTO layer; cancel-only-while-PLACED is unverified at the HTTP layer — verify: cancelling a DELIVERED order is rejected**
- **[P1] — Test elections — `src/modules/governance/services/elections.service.ts` (0%) — the `@Cron` auto-open and `SEALED_UNTIL_DEADLINE` vs `LIVE_COUNT` visibility logic decides what results are revealed and when; a bug leaks results early — verify: sealed elections return no counts before `expiresAt`**

**Tier 2 — auth and authorization**

- **[P1] — Test the guards — `jwt.access.guard.ts`, `jwt.refresh.guard.ts`, `roles.guard.ts` (all 0%) — `auth.service.ts` is well covered at 89.67%, but the guards that actually gate every request are not; a regression here silently removes access control repo-wide rather than failing loudly — verify: an unauthenticated and a wrong-role request are both rejected per role**
- **[P1] — Test the merchant module — `src/modules/merchant/` (all 3 files, 0%) — this module was added 2026-07-26 to fix the FE-1/B-7 blocker and ships with no verification that shop resolution derives from the JWT rather than a client-supplied `shopId` — verify: merchant A cannot read or mutate merchant B's shop, products, or orders**
- **[P1] — Test invitations — `src/modules/invitations/invitations.service.ts` (0%) — one-time signed tokens gate merchant/admin creation; broken expiry or `usedAt` enforcement is a privilege-escalation path — verify: a reused and an expired token are both rejected**

**Tier 3 — lower risk**

- **[P2] — Anonymous feedback masking — `src/modules/feedback/feedback.service.ts` — narrow but a privacy leak if wrong (`isAnonymous` must strip `userId`/`author`) — verify: an anonymous submission exposes no author to admins**
- **[P2] — Smoke tests for read-heavy CRUD — `shops`, `products`, `announcements`, `reports` controllers — list + get-by-id per controller, to catch wiring breakage rather than logic bugs — verify: each returns 200 with the expected shape**

Not worth chasing now: DTOs, config files, and pure decorators. Also add 2–3 real supertest e2e tests for the payment webhook and order-cancel flows specifically — unit tests on services cannot catch a misconfigured route, guard, or pipe.

---

## PART 2 — BACKEND TO PRODUCTION

> **Read this first: the Docker build cannot currently succeed.** Three independent defects in the Dockerfile break `fly deploy` before anything else in this section matters. They were found during this audit and appear in no prior document.

### 2a. `APP_ENV` is not set in `fly.toml`

Confirmed at exact lines. `fly.toml:24-27` sets only `NODE_ENV`, `HTTP_PORT`, `HTTP_HOST`. The app reads `app.env` ← `APP_ENV` (`app.config.ts:13`), defaulting to `'local'`. All three consequences are real:

| Consequence | Code | Status |
|---|---|---|
| Helmet CSP disabled | `main.ts:35` — `contentSecurityPolicy: env === 'production'` | Confirmed |
| Swagger public at `/docs` | `main.ts:71` — `if (env !== 'production')` | Confirmed |
| CORS wide open | `main.ts:47-51` + `app.config.ts:6-10` | Confirmed, **worse than described** |

The required value is the literal string `'production'`.

- **[P1] — Set `APP_ENV` and lock CORS — `fly.toml:24-27` — block below — verify: `curl -i .../docs` → 404 and `curl -i -H 'Origin: https://evil.example' .../v1/shops` returns no `Access-Control-Allow-Origin`**
- **[P2] — `NODE_ENV` in fly.toml is inert for app logic — `fly.toml:25` — nothing in `src/` reads `NODE_ENV` (zero grep hits); only `APP_ENV` gates CSP and Swagger, so the current setting gives false reassurance — verify: the grep**

**On the CORS exposure.** The naive reading is wrong in an important way. The code never emits a literal `*`: `app.config.ts:6-10` maps `'*'` → boolean `true`, and `@fastify/cors` then takes its *reflect* branch. Probed live with `Origin: https://evil-attacker.example`, the response carried `Access-Control-Allow-Origin: https://evil-attacker.example` with `Access-Control-Allow-Credentials: true`. Browsers reject `*` + credentials — but they **accept** origin reflection. So this is not the harmless misconfiguration the `*` framing suggests; it is a working allow-any-origin credentialed CORS policy.

Mitigating it to **P1 rather than P0**: auth is Bearer-token only, `@fastify/cookie` is not installed, and no session code exists, so `credentials: true` conveys no ambient authority — an attacker page holds no token to replay. Real impact is drive-by reads of public endpoints, not account takeover. Fix it, but it is not the thing blocking deploy.

**On Swagger.** Exposure is structural, not credential leakage: no seed password, admin email, or HMAC layout appears in any `@ApiProperty` (`admin@eastpark.app` has zero hits in `src/`; seed passwords are env-only and fail closed at `seed-data.ts:30-34`). What `/docs` does expose is 79 routes across 18 tags with `[ADMIN]`/`[MERCHANT]` markers in the operation summaries, and `tryItOutEnabled` + `persistAuthorization` + `withCredentials` (`swagger.ts:143-152`) make it an armed client. Recon value, no auth bypass.

```toml
[env]
  NODE_ENV = "production"
  APP_ENV = "production"
  APP_URL = "https://eastpark-backend.fly.dev"
  APP_CORS_ORIGINS = "https://<web-app-domain>"
  HTTP_PORT = "3000"
  HTTP_HOST = "0.0.0.0"
```

`APP_CORS_ORIGINS` must list the Vercel domain once the web app from Prompt B exists — comma-separated for multiple origins.

### 2b. The `getOrThrow` false-safety bug

Verified against the installed `@nestjs/config@4.0.3`: `config.service.js:128-134` guards with `isUndefined()` only. Probed at runtime — `''` returns `""`, `null` returns `null`, only `undefined` throws. Every `''` default therefore makes `getOrThrow` dead code.

The real count is **eight**, not seven (plus two more that default to non-empty strings and so also never throw):

| Key | Factory | Consumer |
|---|---|---|
| `PAYMOB_API_KEY` | `paymob.config.ts:6` | `payments.service.ts:172` |
| `PAYMOB_HMAC_SECRET` | `paymob.config.ts:7` | `payments.service.ts:65` (constructor) |
| `PAYMOB_INTEGRATION_ID` | `paymob.config.ts:8` | `payments.service.ts:173` |
| `PAYMOB_IFRAME_ID` | `paymob.config.ts:9` | `payments.service.ts:174` |
| `SUPABASE_SERVICE_KEY` | `supabase.config.ts:7` | `files.service.ts:27` |
| `SMTP_USER` | `email.config.ts:8` | `email.service.ts:31` |
| `SMTP_PASS` | `email.config.ts:9` | `email.service.ts:32` |
| `SUPABASE_URL` | `supabase.config.ts:6` | defaults to `http://localhost:9000` — never throws |

- **[P1] — Strip the empty-string defaults — `src/common/config/paymob.config.ts:6-9`, `src/common/config/supabase.config.ts:7` — drop `?? ''` so the value is genuinely `undefined` and the twenty existing `getOrThrow` call sites fail at boot instead of at the first customer payment — verify: unset `PAYMOB_API_KEY` and confirm the app refuses to start with a named-key error**

Chose stripping the defaults over adding a `validationSchema`: joi is not installed, and a schema would duplicate a contract the call sites already express, forcing every key to be listed twice.

**Leave `SMTP_USER`/`SMTP_PASS` alone** — Mailpit needs no auth locally, and `email.service.ts:29` already branches on truthiness. The four Paymob keys have no local sandbox, so note the caveat: `payments.service.ts:65` reads `hmacSecret` in the **constructor**, so once its default is stripped the app will not boot locally without a dummy `PAYMOB_HMAC_SECRET` in `.env` — either set one, or move that read to lazy access. Tests are unaffected: all 5 specs inject a mock `ConfigService` and none boots the real `ConfigModule`.

### 2c. Secret inventory for `fly secrets set`

The docs undercount badly — `CLAUDE.md` names two Paymob IDs; the real requirement is 15 secrets plus 8 plain config values. Nothing but `NODE_ENV`/`HTTP_PORT`/`HTTP_HOST` is currently in `fly.toml`.

```bash
fly secrets set \
  DATABASE_URL='<neon-pooled-url>?pgbouncer=true&connection_limit=1' \
  DIRECT_DATABASE_URL='<neon-unpooled-url>' \
  REDIS_URL='<upstash-url>' \
  AUTH_ACCESS_TOKEN_SECRET='<openssl rand -base64 48>' \
  AUTH_REFRESH_TOKEN_SECRET='<different value>' \
  SUPABASE_SERVICE_KEY='<value>' \
  SMTP_USER='<brevo-user>' \
  SMTP_PASS='<brevo-key>' \
  PAYMOB_API_KEY='<value>' \
  PAYMOB_HMAC_SECRET='<value>' \
  PAYMOB_INTEGRATION_ID='<value>' \
  PAYMOB_IFRAME_ID='<value>'
```

Non-secret values belong in `fly.toml [env]` alongside the 2a block: `AUTH_ACCESS_TOKEN_EXP="15m"`, `AUTH_REFRESH_TOKEN_EXP="7d"`, `SMTP_HOST`, `SMTP_PORT="587"`, `EMAIL_FROM`, `SUPABASE_URL`, `SUPABASE_BUCKET="eastpark-uploads"`, `APP_LOG_LEVEL="info"`.

- **[P2] — Two documented env vars are dead code — `.env.example:29,66` — `AUTH_RESET_TOKEN_TTL_SEC` is never read (the TTL is hardcoded `RESET_TTL = 1800` at `auth.service.ts:34`) and `EXPO_ACCESS_TOKEN` is never read (`notifications.service.ts:15` calls `new Expo()` with no options) — remove them or wire them up — verify: grep returns no `src/` hits**

Seed vars (`SEED_ADMIN_PASSWORD` etc.) are needed only if you run `pnpm seed` against prod; they are not read by the running server.

### 2d. Health check wiring

The endpoint exists and is a **deep** check — `health.controller.ts:23-25` runs a terminus check against `DatabaseService`. Because the controller is `VERSION_NEUTRAL` (`:10`), the real path is **`/health`, not `/v1/health`** despite the global URI versioning at `main.ts:63-66`. `fly.toml` currently has no checks block at all.

- **[P1] — Wire the Fly health check — `fly.toml` (new block) — below — verify: `fly status` shows the check passing; `curl -i .../health` → 200 with `{"status":"ok"}`**

```toml
[[http_service.checks]]
  grace_period = "30s"
  interval = "15s"
  method = "GET"
  timeout = "5s"
  path = "/health"
```

Keep the deep DB check. With `min_machines_running = 1` and no replica, a machine that cannot reach Postgres serves only errors, so failing the check is strictly better than staying in rotation. Redis is deliberately not part of it — an Upstash blip should not cycle the machine. `grace_period = "30s"` covers `migrate deploy` running before the listener opens.

It has a second job on Supabase: free projects pause after **1 week of inactivity** and need a
manual dashboard restore. A DB query every 15s means the project is never idle. Don't raise the
interval to minutes-scale without confirming that still registers as activity.

### 2e. Dockerfile

Three defects block the build outright. I verified the dependency placement directly: `@prisma/client` is at `package.json:65` inside `dependencies`, but the `prisma` **CLI** is at `:122` inside `devDependencies` (which opens at `:89`).

- **[P0] — `postinstall` runs before the schema is copied — `Dockerfile:9-10` — `pnpm install` fires `"postinstall": "prisma generate"` (`package.json:14`) at line 10, but `prisma/` is not copied until line 13, so it fails with "Could not find Prisma Schema" (`ELIFECYCLE exit 1`) — move `COPY prisma ./prisma/` above the install, or add `--ignore-scripts` — verify: `docker build .` reaches stage 2**
- **[P0] — The prisma CLI is absent from the production image — `Dockerfile:29,33,41` + `package.json:122` — `pnpm install --frozen-lockfile --prod` omits devDependencies, so `pnpm exec prisma generate` (:33) fails with `Command "prisma" not found`, and the CMD's `npx prisma migrate deploy` (:41) would attempt a network fetch on every boot — move `prisma` from devDependencies to dependencies — verify: `docker build .` completes and `docker run` applies migrations offline**
- **[P1] — SIGTERM never reaches Node — `Dockerfile:41` — `CMD ["sh","-c","… && node dist/main"]` leaves `sh` as PID 1 with Node a forked child; `sh` does not forward signals, so the `enableShutdownHooks` and SIGTERM handlers at `main.ts:77-87` never fire and Fly hard-kills the machine, breaking zero-downtime deploys — use `exec node dist/main` — verify: `docker stop` exits promptly and logs "SIGTERM received"**
- **[P2] — pnpm version unpinned — `Dockerfile:4,23` — `corepack prepare pnpm@latest` drifts from `packageManager: pnpm@9.15.0` (`package.json:139`) — pin both stages — verify: `pnpm --version` in the image prints 9.15.0**
- **[P2] — Container runs as root — `Dockerfile:36-38` — add the two lines below after the final `COPY` — verify: `docker run … whoami` prints `node`**

```dockerfile
# Dockerfile:4 and :23 — pin to match packageManager
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

# after `COPY --from=builder /app/dist ./dist`
RUN chown -R node:node /app
USER node

# line 41
CMD ["sh", "-c", "npx prisma migrate deploy && exec node dist/main"]
```

Verified gotchas: the `node` user already exists in `node:20-alpine` (uid 1000), so no `adduser` is needed; `chown -R` must come after the last `COPY` or later layers land root-owned; `chown` changes owner not mode, so the Prisma engine binaries keep their exec bit; port 3000 is above 1024 so no capability is needed; and `migrate deploy` writes nothing to disk, so it runs fine as non-root once the CLI is actually present.

`.dockerignore` is correct — `node_modules`, `.env`, `.env.*`, `.git` all excluded, and `.env` is gitignored and untracked, so there is no risk of baking secrets into the image.

### 2f. Ordered deploy sequence

```bash
# 1. Install the CLI (not present on this machine)
curl -L https://fly.io/install.sh | sh          # then add ~/.fly/bin to PATH
fly version                                      # prints a version
fly auth login                                   # browser opens; CLI prints your email

# 2. Apply the code fixes FIRST — the build is broken until 2e's two P0s are done
#    2e (Dockerfile), 2b (config defaults), 2a + 2d (fly.toml)

# 3. Local signal
. ~/.nvm/nvm.sh && nvm use 24
pnpm typecheck && pnpm lint:check && pnpm test   # exit 0, 62/62

# 4. Prove the image builds before spending a deploy on it
docker build -t eastpark-test .                  # must reach "naming to docker.io/…"

# 5. Secrets — see 2c for the full list
fly secrets set DATABASE_URL=... REDIS_URL=... AUTH_ACCESS_TOKEN_SECRET=... # …etc
fly secrets list                                 # confirm EVERY key before deploying —
                                                 # after 2b a missing key is a boot crash

# 6. Deploy
fly deploy                                       # watch for "prisma migrate deploy" then the listener line

# 7. Verify
curl -i https://eastpark-backend.fly.dev/health  # 200 {"status":"ok","info":{...:"up"}}
curl -i https://eastpark-backend.fly.dev/docs    # 404 — proves APP_ENV took effect
curl -i -H 'Origin: https://evil.example' https://eastpark-backend.fly.dev/v1/shops
                                                 # no Access-Control-Allow-Origin header
```

Migrations run inside the container CMD, so a bad migration is a **boot loop, not a clean abort**. Fly holds the old machine until the health check passes, so live traffic is protected. On failure read `fly logs`, fix forward, redeploy — do not `fly machine restart`.

---

## DO THIS NEXT — ordered checklist

Ordering rationale: nothing ships until the image builds, so the Dockerfile P0s come first. Money correctness lands before any real transaction. Schema changes batch into as few migrations as possible. Store-build config is independent of the backend and can run in parallel.

### Stage 1 — Unblock the deploy (nothing else matters until these pass)

1. **Move `prisma` to `dependencies`** — `package.json:122` → the `dependencies` block. *(P0, 2e)*
2. **Copy `prisma/` before `pnpm install`** in stage 1, or add `--ignore-scripts` — `Dockerfile:9-13`. *(P0, 2e)*
3. **`docker build -t eastpark-test .`** — must complete. Do not proceed until it does.
4. **Add `exec` to the CMD** — `Dockerfile:41`. *(P1, 2e)*

### Stage 2 — Money correctness (before any real payment)

5. **Fix the piastres conversion** — `payments.service.ts:175`. *(P0, 1b)*
6. **Add the webhook amount check** — `payments.service.ts:135-149`, currently absent. *(P0, Part 4)*
7. **Float → Decimal(10,2)** on the 3 fields, **with** the `.toNumber()` boundary mapping in the same commit so the wire format is unchanged and no new mobile build is needed. *(P1, 1b)*

### Stage 3 — Schema (batch into one migration where possible)

8. **Add `ResidentLead` + `ResidentLeadStatus`** — unblocks Prompt B. **Schema approved 2026-09-29** (see 1a). *(P1)*
8b. **Drop `@unique` from `User.phone`** — `schema.prisma:89`; batch into the same migration as 8 and 9. *(P1)*
9. **Add the high-priority indexes** — all 21 in one migration. *(P1, 1b)*
10. ✅ **`directUrl` added**; `DATABASE_URL` repointed at the Supabase transaction pooler. *(P1, 1b — done `e4bb326`)*
11. **Widen the invitation role to `RESIDENT`** and persist `unitNumber`/`phone` in `acceptInvitation`. *(P1, 1a)*

### Stage 4 — Production configuration

12. **Strip the `''` config defaults** — and set a dummy `PAYMOB_HMAC_SECRET` locally, or the app stops booting in dev. *(P1, 2b)*
13. **Set `APP_ENV`, `APP_URL`, `APP_CORS_ORIGINS`** in `fly.toml` — include the Vercel domain once Prompt B is deployed. *(P1, 2a)*
14. **Add the `/health` checks block** — note `/health`, not `/v1/health`. *(P1, 2d)*
15. **Pin pnpm and add the non-root user.** *(P2, 2e)*

### Stage 5 — Deploy

16. Install the `fly` CLI, `fly auth login`.
17. `pnpm typecheck && pnpm lint:check && pnpm test` — exit 0, 62/62.
18. Set all 15 secrets, then **`fly secrets list` to confirm** — after step 12 a missing key is a boot crash.
19. `fly deploy`, then run the three verification curls in 2f.

### Stage 6 — Mobile (parallel with stages 2–5)

20. **`eas env:list --environment production`** — could not be run here; if empty, run the four `eas env:create` commands. Without this every store build points at localhost. *(P0, 3a)*
21. **Fix `tsconfig.json:4`** (`"6.0"` → `"5.0"`) so type-checking runs at all, then triage whatever backlog the first real run surfaces. *(P0, 3c)*
22. **`eslint . --fix`** (clears 3839 of 3915), add the Markdown docs to the ESLint ignore list, then fix the ~2 dozen genuine findings. *(P1, 3c)*
23. **Fill the `eas.json` submit block.** *(P1, 3b)*
24. **Fix the preview profile**, revert the CRLF churn, untrack `package-lock.json`. *(P2, 3d/3e)*
25. `eas build` → `eas submit`.

### Stage 7 — Test debt (before real users, not before first deploy)

26. **Tier 1** — payment webhook controllers, order state transitions, elections service. *(P0/P1)*
27. **Tier 2** — auth guards, merchant module isolation, invitation single-use. *(P1)*
28. **Broaden `collectCoverageFrom`** to `src/**/*.ts` and ratchet the threshold from the real 12.44%. *(P2)*

---

## Deferred / explicitly descoped

- **Posthog + Sentry/GlitchTip** (FE-2) — locked stack items, never wired. Descoped pending a product decision.
- **UX-7** (merchant image upload via `expo-image-picker`) and **UX-9** (one-tap reorder) — post-launch.
- **B-2/B-3/B-5/B-6** — exact pending-order count, notification deep-link payload, single-product GET, product categories.
- **`OrderItem.totalPrice`** — pre-existing, unrelated to the Decimal work: the FE reads `item.totalPrice` (`(tabs)/orders/[orderId].tsx:268`, `(merchant)/orders/[orderId].tsx:226`) but `OrderItemResponseDto` never emits it, so it renders `EGPNaN` today. Either emit it or compute it client-side.

---

*Read-only audit. No source files were modified and nothing was committed. Every file:line was verified against the working tree at backend `b293bba` / frontend `a17f0cd` on 2026-09-29. Where a prior claim did not survive verification it is called out rather than repeated.*
