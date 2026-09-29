# EastPark — What's Left

**Written 2026-09-29.** Everything outstanding across all three repos, in the order it should be done.

Authoritative detail lives in `eastpark-backend/COMPLETION-ROADMAP.md` (every item as `[P0|P1|P2] — title — file:line — fix — how to verify`). This file is the executable version of it.

---

# 🚀 FAST PATH — just get the web form live

**Goal: a working public registration form. Nothing else.** The marketplace, orders, payments, governance and the mobile app all stay untouched and unshipped.

## What the form actually touches

Verified by reading the code, not assumed: `POST /v1/residents/leads` hits the **database and nothing else**. `residents.service.ts` imports only `DatabaseService` and `InvitationsService`. No email, no file upload, no payments on the public path.

## ⚠️ But the app still won't boot without SMTP + Supabase

This is the trap. `email.service.ts:23-32` and `files.service.ts:26-29` call `config.getOrThrow()` **in their constructors**, and `common.module.ts` loads both eagerly — so NestJS instantiates them at startup regardless of which endpoint you call. Missing values crash the app on boot, not on first use.

**So the two config values are required even for a form-only launch.** They cannot be postponed. (`SMTP_PORT`, `EMAIL_FROM` and `SUPABASE_BUCKET` are already set in `fly.toml`; only the host and project URL are missing.)

## Minimum steps

```
 1. YOU  Brevo SMTP host + Supabase project URL          → B3   ⛔ app won't boot without these
 2. YOU  Neon pooled + unpooled connection strings       → B2
 3. ME   Add directUrl to schema.prisma                  → B2   ~2 min
 4. ME   Add SMTP_HOST + SUPABASE_URL to fly.toml        → B3   ~2 min
 5. YOU  docker build                                           ← never run, may fail
 6. YOU  fly deploy  (runs prisma migrate deploy on boot)       ← never run, may fail
 7. YOU  Deploy web app — eastpark-web-app/DEPLOY.md
 8. YOU  Send me the Vercel domain
 9. ME   Swap it into APP_CORS_ORIGINS, redeploy backend  → B5-CORS
10. YOU  curl POST /v1/residents/leads to confirm end-to-end
```

Steps 3, 4 and 9 are ~5 minutes of my work combined. Everything else is yours, and steps 5–6 are the two that have never been executed anywhere.

## Safe to postpone for a form-only launch

| Item | Why it can wait |
|---|---|
| **B0** Paymob amount verification | The form takes no payments. **Becomes P0 the instant you enable ordering.** |
| **B1** Float → Decimal | No money flows through the form. ⚠️ **Gets dramatically more expensive once real orders exist** — see the warning below. |
| **B4** Prisma seed hook | Only affects `migrate reset` in dev. |
| **B5** Test coverage | No new risk from shipping a form. |
| **F1–F5** All mobile work | You are not shipping the mobile app. |

> ### ⚠️ The one judgement call in postponing B1
> Float→Decimal is nearly free **right now** because the database holds only whole-integer values, so the conversion is lossless. It stays cheap for exactly as long as no real fractional order exists. The web form creates no orders, so shipping it does not start that clock — but **do B1 before you enable ordering**, not after. After is a data migration with rounding risk.
>
> If you want it de-risked permanently, the cheapest moment is *before* step 6 above, while the production database is still empty. It adds one migration to the same deploy.

## What this gets you

A live, bilingual, accessible registration form collecting resident leads into `resident_leads`, viewable by admins via `GET /v1/admin/residents/leads`. Residents can be invited into real accounts later via the existing invitation flow.

**Not included:** ordering, payments, the directory, governance, notifications, and the mobile app — all of which need the full list below.

---

## State right now

| Repo | Branch | Commits | Verified | Pushed |
|---|---|---|---|---|
| `eastpark-backend` | main | 8 | typecheck 0 · lint 0 · tests **101/101** | ❌ no remote |
| `eastpark-frontend` | main | 3 | type-check 0 · tests **41/41** · lint 37 deferred | ❌ no remote |
| `eastpark-web-app` | main | 2 | build 0 · lint 0 · tsc 0 | ❌ no remote |

**Nothing has been pushed anywhere.** All three working trees are clean.

### Toolchain — read before running anything

```bash
. ~/.nvm/nvm.sh && nvm use 24      # default shell Node is v12.22.9 and cannot run the tooling
```

- `pnpm install` **hangs non-interactively** — use `pnpm install --config.confirmModulesPurge=false`
- On the `/mnt/c` mount a cold install takes **~35 min**. It is not hung — check `ls -a node_modules` for a `.pnpm` dir before killing it.
- The mobile test suite takes **~12.5 min** (`login-form.test.tsx` alone is 730s).
- Commit format: `[AhmedMuhammedElsaid][feat|fix|chore|docs]: description`, always `--no-verify`.

### Two things never verified by execution

Neither could run in this environment — no Docker daemon, no reachable database. **If the first deploy fails, look here before anything else.**

1. **`docker build`** against the fixed Dockerfile. Three real blockers were fixed (prisma CLI was a devDependency so the prod image had no binary; postinstall ran `prisma generate` before `prisma/` was copied; `sh` swallowed SIGTERM) — verified by root cause, not by a build.
2. **`prisma migrate deploy`** against migration `0e97846`. SQL generated via `migrate diff` and audited: 26 CREATE INDEX, 1 CREATE TABLE, 1 CREATE TYPE, 1 FK, 1 DROP INDEX (`users_phone_key`, intended). No DROP TABLE/COLUMN. **Unapplied.**

---

## ⛔ Blocked on you — 2 values

Everything else can proceed without these, but the deploy cannot.

| Need | Where it goes | Note |
|---|---|---|
| **Brevo SMTP host** | `fly.toml [env] SMTP_HOST` | Probably `smtp-relay.brevo.com` — confirm |
| **Supabase project URL** | `fly.toml [env] SUPABASE_URL` | `https://<ref>.supabase.co` |

Deliberately left blank rather than guessed. Both factories default to `''` and `getOrThrow` only throws on `undefined`, so a wrong value means the app **boots fine and fails at the first email or upload** instead of at startup.

---

# BACKEND — step by step

### ✅ B0 — P0: Paymob webhook does not verify the amount

**The bug:** `src/modules/payments/payments.service.ts:135-149` verifies the HMAC, checks idempotency, then sets `isPaid: true` — **without ever comparing `obj.amount_cents` to `order.totalAmount`**. A valid-signature callback for the wrong amount marks the order paid. Someone paying 1 EGP on a 500 EGP order gets a paid order.

**Why it's cheap:** `amount_cents` is already in the webhook payload type (`:22`) *and* in the HMAC-signed field list (`:38`) — the value arrives signed and trustworthy. It is simply never read.

```
Fix    compare obj.amount_cents against the expected piastres before flipping isPaid;
       reject with a logged mismatch otherwise
Verify unit test — valid signature + wrong amount must NOT mark the order paid
```

Do this **before any real transaction**. It is independent of the Decimal work and needs no migration.

---

### ✅ B1 — P0/P1: Money `Float` → `Decimal(10,2)`

Three fields: `Product.price`, `Order.totalAmount`, `OrderItem.unitPrice`.

> **⚠️ BREAKING unless the boundary mapping ships in the SAME commit.**
> Prisma returns `Prisma.Decimal` objects. `JSON.stringify(new Prisma.Decimal('35.50'))` emits the **string** `"35.5"` — and drops the trailing zero. The mobile app declares every money field as `number` with no response validation, and Axios generics are `any`, so **FE typecheck stays green while values are silently wrong**. `formatCurrency`'s catch-branch fallback `amount.toFixed(2)` *throws* on a string.
>
> With `.toNumber()` at the response boundary the wire format is unchanged and **no new mobile build is needed**. Without it, already-installed apps break and **cannot be fixed forward**. Do not take that path.

**Do it now, while the database is still empty.** It is a migration project once real orders exist.

```
1. schema.prisma:216,237,263      → Decimal @db.Decimal(10,2)
2. orders.service.ts:82,85,86     → new Prisma.Decimal(0) / .times() / .plus()
3. payments.service.ts:175        → Math.round(totalAmount * 100) re-enters float and is
                                    THE FIGURE CHARGED TO A CARD → .times(100).toNumber()
4. products.service.ts:45,93,101,113 + orders.service.ts:109,148,172,218,264
                                  → .toNumber() at every response boundary
5. test/modules/orders.service.spec.ts:134 → toEqual(new Prisma.Decimal(150))

Verify  pnpm typecheck surfaces every arithmetic site as TS2362
        drift case 60.269999999999996 must become exactly 60.27
        curl an order — totalAmount must be a JSON number, not a quoted string
```

**Migration safety:** the generated `ALTER TABLE … SET DATA TYPE DECIMAL(10,2)` has no `USING` clause, so Postgres rounds half-up to 2dp (`19.999` → `20.00`) — silent and irreversible. Lossless *today* because all current values are whole integers. At 42 products / 14 orders it rewrites in milliseconds; no maintenance window.

---

### ✅ B2 — P1: Add `directUrl` for Neon  ← needs you

`grep directUrl prisma/schema.prisma` → **0 matches**. Without it `migrate deploy` runs through pgbouncer, where advisory locks and prepared statements misbehave.

```
schema.prisma:8-11   add  directUrl = env("DIRECT_DATABASE_URL")

DATABASE_URL         Neon POOLED endpoint (-pooler) + ?pgbouncer=true&connection_limit=1
DIRECT_DATABASE_URL  Neon UNPOOLED endpoint

Verify  pnpm prisma migrate deploy succeeds AND the app still serves traffic
```

Both strings come from the Neon dashboard. The Fly VM is 256MB / 1 shared CPU, so a low `connection_limit` is correct.

---

### ✅ B3 — P1: Fill the two missing `fly.toml` env vars  ← needs you

Add `SMTP_HOST` and `SUPABASE_URL` from the table above. `SMTP_PORT`, `EMAIL_FROM`, `SUPABASE_BUCKET`, `APP_ENV`, `APP_CORS_ORIGINS` are already set.

---

### ✅ B4 — P2: Register the Prisma seed hook

`package.json` has a `seed` **script** but no top-level `"prisma": { "seed": ... }` key — which is the only thing `migrate reset` and `db seed` read. So `migrate reset` silently does not reseed.

```
Add     "prisma": { "seed": "ts-node -r tsconfig-paths/register prisma/seed-data.ts" }
Verify  pnpm prisma migrate reset ends with seed output; admin@eastpark.app exists
```

---

### ✅ B5 — P2: Test coverage

Real whole-repo coverage is **12.44%**, not the headline 81.11% — that figure averages only the 5 files in `test/jest.json`'s `collectCoverageFrom`, so the 70% threshold gates those 5 files and nothing else. **Every controller is at 0%.** Tiers ranked in `COMPLETION-ROADMAP.md` Part 4.

---

# FRONTEND (mobile) — step by step

### ✅ F1 — P0: Cloud builds ship pointing at `localhost:3000`

No build profile supplies `EXPO_PUBLIC_API_URL` / `EXPO_PUBLIC_SOCKET_URL`; both fall through to a localhost default (`env.ts:12-13`) that is unreachable from a device. **The build succeeds and the app is silently dead on launch.**

`eas env:list` could not run here — TLS failure in this sandbox, not a login problem. **Run it yourself first** to check whether these are already set on the EAS dashboard.

```bash
eas env:list --environment production   # check first

eas env:create --environment production --name EXPO_PUBLIC_API_URL    --value https://eastpark-backend.fly.dev --visibility plaintext
eas env:create --environment production --name EXPO_PUBLIC_SOCKET_URL --value https://eastpark-backend.fly.dev --visibility plaintext
eas env:create --environment preview    --name EXPO_PUBLIC_API_URL    --value https://<staging-host> --visibility plaintext
eas env:create --environment preview    --name EXPO_PUBLIC_SOCKET_URL --value https://<staging-host> --visibility plaintext
```

**No `/v1` suffix** — `services/api/client.ts:30` appends it.

---

### ✅ F2 — P1: `eas.json` submit block is empty  ← needs your store IDs

`"submit": { "preview": {}, "production": {} }` — store submission is **impossible** as configured.

| Key | Platform | How to obtain |
|---|---|---|
| `appleId` | iOS | Apple Developer account email |
| `ascAppId` | iOS | App Store Connect → App Info → General → Apple ID (numeric). Optional — omitting lets `eas submit` create the entry |
| `appleTeamId` | iOS | developer.apple.com → Membership → Team ID |
| `ascApiKeyPath` / `Id` / `IssuerId` | iOS | App Store Connect → Users and Access → Integrations → Generate API Key. All three replace interactive auth — required for CI |
| `serviceAccountKeyPath` | Android | Play Console → Setup → API access → service account in GCP → download JSON |
| `track` | Android | `production` \| `beta` \| `alpha` \| `internal` |

Full JSON block in `COMPLETION-ROADMAP.md` §3b. **Keep the `.p8` and the service-account JSON out of git.**

```
Verify  eas submit -p ios --profile production --dry-run  resolves without prompting
```

---

### ✅ F3 — P2: `preview` profile is self-contradictory

Mixes `"distribution": "store"` with `android.buildType: "apk"`. Play has been **AAB-only since August 2021**, and `store` vs `internal` changes which credentials EAS provisions — so a store-distribution APK cannot be delivered anywhere.

```
Fix     "distribution": "internal"  (keep buildType: "apk" — correct for internal test builds)
Verify  eas build -p android --profile preview  produces an installable APK with a share link
```

---

### ✅ F4 — P2: `package-lock.json` is tracked in a pnpm-only repo

```bash
git rm --cached package-lock.json && rm package-lock.json
echo package-lock.json >> .gitignore
# Verify: git ls-files package-lock.json  returns nothing
```

---

### ✅ F5 — P2: 37 deferred lint errors + CRLF churn

3915 → 37 after `--fix`; the remainder were deferred by choice. Also add a `.gitattributes` with `* text=auto eol=lf` to stop the CRLF churn recurring.

---

# WEB APP — done

`eastpark-web-app` is complete: build / lint / tsc all exit 0, three routes prerender static, runtime-verified (Arabic RTL default, content visible with JS disabled, all 12 buildings grouped by phase, full ARIA combobox).

**Only remaining step is deployment** — see `eastpark-web-app/DEPLOY.md`.

Two gaps in the verification, both needing a real browser:
- **Lighthouse ≥90 is unmeasured** — built to spec, markup verified via SSR HTML, never actually scored.
- **The form has never completed a successful submission** — the backend wasn't running, so only the failure path was exercised.

---

# THE ORDER

```
 1. YOU   Brevo SMTP host + Supabase project URL                        ⛔ blocks deploy
 2. ME    B0  Paymob amount verification                                  P0 · no deploy needed
 3. ME    B1  Float → Decimal + .toNumber() boundary (same commit)        P0 · cheap only while DB is empty
 4. ME    B2  directUrl + B3 fly.toml env                                 needs step 1
 5. ME    F1  EAS env vars  ·  F2 submit block  ·  F3 preview profile     needs your store IDs
 6. YOU   Neon pooled + unpooled connection strings
 7. YOU   docker build          ← never run
 8. YOU   prisma migrate deploy ← never run
 9. YOU   Deploy web app (DEPLOY.md) → send me the Vercel domain
10. ME    Swap the real domain into APP_CORS_ORIGINS
11. YOU   curl POST /v1/residents/leads to confirm end-to-end
12. ME    B4 seed hook · B5 coverage · F4 lockfile · F5 lint             P2 cleanup
```

**Steps 2 and 3 are the ones that cost real money if skipped.** Neither needs anything from you, and both get more expensive the longer they wait — Decimal especially, which is nearly free now and a migration project once real orders land.

---

## Deferred by decision — not forgotten

**Monorepo + `shared-logic` package.** Requested, then deliberately deferred until the web app ships — converting two live repos mid-flight (mobile 786 commits, backend 35) risked the fragile Metro/Jest/EAS config for ~100 lines of duplication. Plan and traps in `restructure.md`.

Agreed shared scope: `theme/tokens.ts`, the translation JSONs, Zod schemas, `compound.ts`. Pure data — no React, RN, or Next imports. All four are already kept import-clean, so it is a move rather than a rewrite.

Two caveats for whoever does it:
- `tokens.ts` is **no longer byte-identical** between mobile and web — `eslint --fix` reformatted mobile's copy to double quotes in `03d13bd`. **Values are identical; diff values, not bytes.**
- Sharing `compound.ts` implies the mobile app adopting structured units. Mobile has no building/floor/flat concept today (`User.unitNumber` is free text), so that is a **product decision, not a refactor**.

**Analytics (Posthog / Sentry / GlitchTip)** — descoped pending a product decision.

---

## Things that will bite you if you forget them

- **`APP_CORS_ORIGINS` currently holds a placeholder Vercel domain.** Until the real one is set, every form submission fails with a CORS error in the browser. The config now filters blank entries so a malformed value fails loudly rather than silently matching nothing.
- **A missing `resident_leads` table surfaces as an opaque 500**, which the web client correctly reports as a generic "something went wrong on our side" — indistinguishable from a real bug. Check the migration before debugging the form.
- **`isValidFloorForBuilding` in `eastpark-web-app/src/config/compound.ts` is load-bearing.** The API accepts `"G"` for *any* building — there is no enum and no CHECK constraint — so client-side validation is the only thing preventing an impossible unit. There is a warning comment on it; do not "simplify" it into a plain range check.
- **The compound layout lives in exactly one file.** Changing buildings, phases, or which phases have a ground floor is a one-file edit in `compound.ts` — no migration, no backend change.
- **`NEXT_PUBLIC_*` vars are baked in at build time.** Changing one in the Vercel dashboard does nothing until you redeploy.
