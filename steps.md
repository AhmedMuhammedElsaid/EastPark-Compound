# EastPark release steps (owner-run)

> **IN PROGRESS** (started 2026-11-02). This file collects every prod and provider action for flat listings +
> accounting. When all accounting slices are built it absorbs the draft
> `Documentation/RELEASE-RUNBOOK-LISTINGS-ACCOUNTING.md` (parts A to D), which stays the reference until then.
> The dev machine does code only; every command here is run by Ahmed from his own machine. Secrets are
> placeholders (`$DIRECT_DATABASE_URL`); never paste their values into a chat or a commit.

## Gates before the push that carries `finance_foundations` (slices 4 + 5)

### G1. Run the real-database specs on Postgres 15 (slice 4 review M4)

CI never runs `pnpm test:db`, and the hand-written half of `finance_foundations` has never been executed. It
must pass locally on the same major version as Supabase before the push.

```powershell
# Scratch container, port 5433 so it never touches the dev compose DB on 5432.
docker run -d --name ep-pg15 -e POSTGRES_PASSWORD=pg -p 5433:5432 postgres:15-alpine
# psql must be on PATH (or set PSQL_BIN to its full path).
cd C:\Unite\EastPark-App\apps\backend
$env:TEST_DATABASE_URL = "postgresql://postgres:pg@localhost:5433/postgres"
pnpm test:db
docker rm -f ep-pg15
```

Expect every suite in `test/db/*.db-spec.ts` to pass, none skipped (a skip means `TEST_DATABASE_URL` was not
set). Any failure blocks the push.

### G2. Prod Postgres is 15 or newer (slice 4 review L3)

`live_payments` is created `WITH (security_invoker = true)`, which Postgres 14 rejects. A failure there aborts
the migration and blocks every Render deploy until `prisma migrate resolve --rolled-back`.

```powershell
psql "$env:DIRECT_DATABASE_URL" -X -A -t -c "SHOW server_version;"
```

The major version must be 15 or higher. If it is 14, stop and ask before pushing.

### G3. Flat-key preflight is clean

```powershell
psql "$env:DIRECT_DATABASE_URL" -X -f apps/backend/prisma/scripts/check-flat-keys.sql
```

`resident_units` `collision_groups` must be 0 (a collision aborts the migration). Run it immediately before
the push.

### G4. Back up prod, deploy at a quiet hour

`pg_dump` the public schema to `D:\CodeLab\EastPark-backups\` (outside the repo; it contains PII). The
migration's foreign keys briefly lock `users`, `resident_units` and `listings` against writes (slice 4 review
L2), so push when nobody is onboarding.

## After the push

### A1. Ownership catch-up, then invariant check (slice 4 review M2)

While Render swaps containers, the old code keeps writing units, users and listings without `flatId` or
ownership periods. As soon as Render reports the new deploy live, run the idempotent catch-up once, then the
read-only check:

```powershell
cd C:\Unite\EastPark-App\apps\backend
psql "$env:DIRECT_DATABASE_URL" -X -1 -v ON_ERROR_STOP=1 -f prisma/scripts/finance-ownership-catchup.sql
psql "$env:DIRECT_DATABASE_URL" -X -f prisma/scripts/finance-ownership-invariant.sql
```

The catch-up prints one count per step (usually all 0 at a quiet hour). Every row of the invariant check must
be 0. If one is not, stop and send the counts (counts only, no rows) before anyone uses the finance screens.
Never edit `finance.goLiveAt` in `finance_settings`: late flat links date their periods from it.
