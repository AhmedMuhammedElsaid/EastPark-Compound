# Accounting Phase 1a, slice 4 review (`finance_foundations`)

Reviewer: independent Opus read-only review, 2026-11-02. Diff `9178bc6..b9f1e23` (`e0596e2`, `b9f1e23`).

## Summary

| Severity | Count |
|---|---|
| Critical | 0 |
| High | 0 |
| Medium | 4 |
| Low | 6 |

Nothing found will make the migration fail on a clean prod database, provided the slice 3 diagnostic
shows `resident_units` collision_groups = 0 and Supabase runs Postgres 15 or later. The Medium findings are
traps for slice 5 to 7 and for prod ops, not deploy blockers.

How it was checked:
- The generated part of the migration (lines 14-413) was compared with a fresh offline
  `prisma migrate diff --from-schema-datamodel <9178bc6 schema> --to-schema-datamodel <b9f1e23 schema> --script`
  (Prisma 6.19.0). Ignoring blank lines, the two are **byte-identical**: 400 lines, no `DROP`.
- The hand-written tail (lines 415-746) was read statement by statement, as Postgres 15 would run it.
- `npx jest --config test/jest.json finance-foundations-migration migrations-keep-partial`: 2 suites,
  41 tests pass.

## Implementer deviations

| Deviation | Verdict |
|---|---|
| The 690 flats are a literal `VALUES` list, not a generated `SELECT` | OK. `finance-foundations-migration.spec` parses every tuple and compares the list, in order, with `COMPOUND_FLAT_KEYS`; it is a real check. Phases match `apps/web/src/config/compound.ts` ids (`phase-1`..`phase-4`). |
| View columns omitted: `payerName`, `note`, `attachmentPath`, `requestKey`, `requestHash`; also `reference`, `voidReason`, `replacesId`, `voidedById`, `createdById` | OK. Plan 2.1.1 only requires the dated columns (`receivedAt`, `voidedAt`, `bouncedAt`, `status`) plus amount and flat. Privacy is better. Phase 2 can append columns only at the end (`CREATE OR REPLACE VIEW`), so anything needed later goes last. |
| Threshold seeded as `to_jsonb(5000)`, a JSON number | OK. It matches Q5 (5,000 EGP) and the plan's "Decimal, null = never" rule. Phase 2 must read a JSON number or null. |
| `check-flat-keys.sql` now uses `btrim(x, E' \t\r\n')` | OK, and it now matches the migration. The runtime SQL in `resident-units.service.ts` does not match, see M1. |

## Critical / High

None.

## SQL validity (statement by statement)

- **Enums:** all 15 are created before their tables. No `ALTER TYPE`; nothing references `ACCOUNTANT`.
- **Tables, FKs, indexes:** identical to Prisma's own output. Quoting of camelCase columns is correct. Every FK
  targets an existing table (`users`, `flats`, `finance_categories`, ...). FK and index names follow Prisma's
  conventions, so a later `migrate diff` produces no drift.
- **CHECK `amount > 0`:** present on the 6 money tables. The spec checks only 4 of them (see L5).
- **Partial unique indexes:** valid syntax. `'COMMITTED'` compares to an enum literal, and `"committed" = true`
  is fine. None of them is `CONCURRENTLY`, and no `CONCURRENTLY`, `BEGIN` or `COMMIT` appears in any
  migration folder.
- **`DO $$` blocks:** valid PL/pgSQL. The `DECLARE` initialiser with `EXISTS` works.
- **The view:** `WITH (security_invoker = true)` needs Postgres 15 or later (L3).
- **Transactions (brief items 1, 3 and 6):** `migrate deploy` sends each migration file as one multi-statement
  simple query, and Postgres runs that as one implicit transaction. So:
  - a `RAISE EXCEPTION` rolls back everything, including the two `ADD COLUMN`s (the db-spec models this with
    `psql -1`);
  - `20261101000000_accountant_role` commits in its own earlier transaction, so the ACCOUNTANT value is safe
    even when both migrations ship in the same deploy.
  - The migration is not re-entrant (`CREATE TYPE` has no `IF NOT EXISTS`), but it never needs to be, because a
    failure leaves nothing behind. Recovery is `migrate resolve --rolled-back`, never `--applied`.
- **Live-data safety:**
  - Only additive changes: two nullable columns and an `UPDATE` of two small tables.
  - `ADD COLUMN` without a default is metadata-only, so there is no table rewrite.
  - The FKs to `users` take a SHARE ROW EXCLUSIVE lock on `users` for a moment (L2).
- **Asserts:**
  - The collision check runs before the seed. Its normalisation equals `check-flat-keys.sql` exactly.
  - The 690 check runs after the seed.
  - Unknown keys only raise a NOTICE, and there is no assert on listings. All of this matches the spec.
- **Backfill:**
  - `flatId` is linked on both tables.
  - Ownership periods (`fo_<unitId>`, `1900-01-01`, open) are opened only for linked units of users with
    `deletedAt IS NULL`.
  - `flat_ownership_one_open` cannot fire: the collision assert plus the `flats` unique key give at most one
    unit per flat.
  - Legacy tombstones carry `deletedAt` (soft-delete migration), so they get no period.
- **Seeds:**
  - 16 categories with the plan's names (10 expense, 6 revenue).
  - Settings: threshold 5000, year start month 1, due day 10.
  - `updatedAt` is supplied, because Prisma's `@updatedAt` has no DB default.
- **The view:** it reads `payments` only. Its `REVOKE` is guarded exactly as in plan 2.1.1. The lockdown
  migration's default privileges already withhold grants on new relations, so the `REVOKE` is a backstop.

## Medium

### M1. The runtime holder and lead lookups trim spaces only; the migration trims space, tab, CR and LF
- **Where:** `src/modules/units/resident-units.service.ts:71-73` and `:97-99` use the one-argument `btrim(...)`.
  The migration and `check-flat-keys.sql` use `btrim(x, E' \t\r\n')`.
- **What:** the brief requires one normalisation everywhere. JS `normaliseFlatKey` trims tabs and newlines, so
  the parameter is clean, but a stored legacy row such as `'A1\t'` is not matched by `findHolders`.
- **Failure scenario:**
  - Before the deploy: `addToUser` or accept-invitation creates `A1` next to `A1\t`. The unique index compares
    exact text, so it lets the second row in. The migration's collision assert then aborts the deploy, even
    though the owner's diagnostic run was clean.
  - After the deploy, with slice 5: the second unit tries to open a period, hits `flat_ownership_one_open`
    with P2002, and the invitation fails with a 500.
  - Unlikely, because DTOs trim, but this is exactly the abort path.
- **Fix:** use `btrim(col, E' \t\r\n')` in both raw queries, and assert the same expression text in the slice 3
  spec, as `finance-foundations-migration.spec` already does.

### M2. Deploy window: old code keeps creating unlinked units after the migration commits
- **Where:** the deploy order on Render. The `Dockerfile` CMD runs `migrate deploy && node dist/main` on the new
  instance, while the old instance keeps serving until the new one is healthy (minutes on the free tier).
- **What:** the new tables exist, but the old code writes a `ResidentUnit` without a `flatId` and without a
  period. The M2 link step only fires through the unit PATCH, so the row stays invisible to finance and breaks
  nothing loudly. "Ships with slice 5" does not close this window.
- **Fix (slice 5):**
  - add an idempotent catch-up: the backfill SQL with `WHERE "flatId" IS NULL`, plus `NOT EXISTS` an open
    period, as a script or a guarded boot task;
  - add the invariant SQL to the runbook and run both right after the deploy.

### M3. No recorded go-live date for the "sentinel or createdAt" rule
- **Where:** plan 2.2 M2. The link step uses `1900-01-01` "if the unit was created before finance go-live",
  else its `createdAt` date. Nothing stores that date: no `finance_settings` key, no column.
- **Failure scenario:** slice 5 hard-codes a date, or reads `_prisma_migrations.finished_at`, or always uses the
  sentinel. Each choice either hides or exposes opening lines incorrectly for late-linked units.
- **Fix:** before the deploy, seed `('finance.goLiveDate', to_jsonb(CURRENT_DATE::text), CURRENT_TIMESTAMP)` in
  this migration. It is cheap now and costs a migration later. Use the Cairo date if it matters, see slice 6
  `cairo-date.ts`.

### M4. Nothing has executed the SQL, and CI never will
- **Where:**
  - `test/jest.json` matches `*.spec.ts`, so the `*.db-spec.ts` files are correctly excluded;
  - root `check:backend` and `.github/workflows/ci.yml` never run `test:db`;
  - there is no Postgres service in CI.
- **What:** the db-specs are sound in principle:
  - they create and drop scratch databases;
  - they apply each earlier migration with `psql -1`;
  - the fixtures fill every NOT NULL column of `users`, `resident_units` and `listings`;
  - NOTICEs reach stderr under `-q`;
  - `describe.skip` applies without `TEST_DATABASE_URL`.

  But they have never run. The offline proof covers only the Prisma-generated half; the hand-written tail is
  checked by reading alone.
- **Fix:** make `pnpm test:db` against local docker Postgres a hard runbook gate before the push, ideally on
  `postgres:15` to match Supabase. Optionally add a CI job with a `postgres:15` service.

## Low

### L1. The index-survival spec only sees the quoted `DROP INDEX "name"` form
- **Where:** `test/prisma/migrations-keep-partial-indexes.spec.ts`, regex `DROP\s+INDEX\s+(?:IF\s+EXISTS\s+)?"([^"]+)"`.
- **What:** it does catch the realistic risk, a Prisma-generated `DROP INDEX "listings_active_unit_key";`
  (always quoted). Every check in the spec then fails: "present after replaying" plus "never dropped without
  recreate". It also catches a `DROP TABLE` of an owning table. It misses:
  - the unquoted form `DROP INDEX listings_active_unit_key`;
  - the schema-qualified form `DROP INDEX public."..."`;
  - a `CREATE UNIQUE INDEX` without the `WHERE` that replaces the partial index under the same name after a
    drop. The `partial` check covers only the create events, and it does cover this case.
- **Fix:** allow an optional schema prefix and optional quotes:
  `DROP\s+INDEX\s+(?:CONCURRENTLY\s+)?(?:IF\s+EXISTS\s+)?(?:"?public"?\.)?"?(\w+)"?`.

### L2. Short SHARE ROW EXCLUSIVE locks on `users`, `resident_units` and `listings`
- **Where:** the `ADD CONSTRAINT ... FOREIGN KEY` statements (about 20 of them reference `users`).
- **What:** each one locks the referenced table against writes until the migration commits. The new tables are
  empty and the backfill touches tens of rows, so this lasts well under a second. A long-running transaction
  on `users` could make the migration wait. Acceptable; the runbook says "deploy at a quiet hour".

### L3. `security_invoker` needs Postgres 15 or later; prod's version has not been verified here
- **What:** on Postgres 14 the `CREATE VIEW` fails with "unrecognized parameter", which blocks every deploy.
  Supabase projects created since 2023 run 15 or later, but nothing in the repo proves it.
- **Fix:** add a runbook step, `SHOW server_version` on prod, to the pre-push check.

### L4. No `toDate >= fromDate` guard on `flat_ownerships`
- **What:** the plan's "empty period" for a re-key (`toDate = fromDate`) is valid. A slice 5 bug that sets
  `toDate < fromDate` (UTC versus Cairo dates) would pass silently.
- **Fix (optional):** `CHECK ("toDate" IS NULL OR "toDate" >= "fromDate")` here, or a slice 5 test.

### L5. The file-level spec asserts the CHECK on 4 of the 6 money tables
- **Where:** `finance-foundations-migration.spec.ts`. It omits `billing_runs` and `fee_schedules`. The SQL has
  all 6.
- **Fix:** add the two tables to the loop.

### L6. The flat id differs from the Prisma default
- **What:** seeded ids are `flat_A1-3-2`, while `Flat.id` is `@default(cuid())`. That is harmless, and readable
  in logs. Flats added later through an admin form get cuids. Slices 6-8 must never parse `Flat.id`: look a
  flat up by `label` or by `(building, floor, flatNumber)`.

## Schema parity

- An offline `migrate diff` from the old schema to the new one equals the migration's generated block byte for
  byte, so `schema.prisma` is in parity with the SQL:
  - names, `@@map`, enums, defaults;
  - `Decimal(12,2)` = `DECIMAL(12,2)` and `Decimal(8,4)`;
  - `@db.Date` = `DATE`;
  - `onDelete`: Restrict, plus SetNull on `openedById`, `closedById` and the two `flatId` links;
  - all relation names.
- The hand-written objects are the CHECKs, the 4 partial indexes, RLS, the view and the seeds. Prisma does not
  model any of them:
  - CHECKs, RLS and views are invisible to `migrate diff` in Prisma 6 without the `views` preview feature, so
    they do not drift;
  - the partial indexes WILL show as drops in a future `migrate dev`. All four carry the WARNING block, and the
    survival spec enforces it.
- The 2.4 deviations are the ones the plan documents: no `serviceSaleId` and no `expenseId` (Phase 2).
  `FundEntry` has no `expense_id`, `Payment` has `requestKey`, `requestHash`, `isOpening` and `replacesId`, and
  the 1b tables (`FundEntry` and the import tables) ship now.

## Tests

| Spec | Runs in CI | Verdict |
|---|---|---|
| `test/prisma/migrations-keep-partial-indexes.spec.ts` | yes (root `check:backend`) | It fails on a quoted `DROP INDEX`, a recreate without `WHERE`, a dropped owning table or a missing WARNING. Gaps in L1. |
| `test/common/finance-foundations-migration.spec.ts` | yes | It checks the seed against `COMPOUND_FLAT_KEYS` (a real comparison), additivity, RLS, asserts, normalisation text, backfill, settings and view columns. Gap in L5. |
| `test/db/finance-foundations.db-spec.ts` | no (M4) | Covers count, collision abort with full rollback, notice, listings without an assert, tab-padded link, deleted user, index presence, one-open and CHECK. Looks correct, never executed. |
| `test/db/finance-view-privileges.db-spec.ts` | no (M4) | Covers `security_invoker`, hidden columns, guarded anon/authenticated checks and RLS on `payments`. Looks correct, never executed. |

Two smaller test notes:
- The db-helper builds SQL by string concatenation. That is fine, because the input is test fixtures only.
- `ScratchDb` drops `ff_test_*` databases `WITH (FORCE)`, which needs Postgres 13 or later.

## Slice 5-7 assumptions (brief item 9)

- **Slice 5:**
  - Writers open periods against `flat_ownership_one_open`. Map P2002 on that index to 409 `alreadyOwned`,
    not a 500.
  - `deleteUser` and `restoreUser` must use Cairo `DATE` values.
  - The catch-up from M2 and the go-live date from M3 are needed.
  - Also fix M1.
- **Slice 6:**
  - The receipt counter (`receipt_counters` PK scope+year) is ready for `INSERT ... ON CONFLICT`.
  - `fiscal_periods` has no row seeded, which is the plan's intent: postings upsert.
  - The view exposes `createdAt`, `voidedAt` (timestamp) and `receivedAt` (date), as 2.1.1 needs.
- **Slice 7:** `attachmentPath`, `chequeState`, `clearedAt` and `bouncedAt` exist. The allocation unique key
  `[paymentId, chargeId]` blocks a second allocation of the same payment to the same charge after a void.
  Plan 3.5 `apply-credit` creates new allocations from credit, never from the same payment, so this is fine.
  But a "void allocation then re-allocate the same payment" flow would hit P2002; confirm that it is not
  planned.

## Verdict

- **Safe to build slice 5 on:** yes. Fix M1 first (two lines), and design the M2 catch-up and the M3 go-live
  date into slice 5.
- **Safe to deploy with slice 5:** yes, conditionally. Before the push:
  1. `pnpm test:db` green on local docker `postgres:15` (M4);
  2. prod `SHOW server_version` 15 or later (L3);
  3. re-run `check-flat-keys.sql` with `resident_units` collision_groups = 0;
  4. take a backup;
  5. after the deploy, run the catch-up backfill and the invariant SQL (M2).
