# Accounting slice 5 review: ownership writers + listings link

- **Commits reviewed:** `cf20fc8`, `f327c19` (diff `a976f35..f327c19`, branch `feature/accounting`)
- **Date:** 2026-11-02
- **Scope:** `FlatOwnershipService`, every unit/user writer, listings `flatId`, catch-up and invariant SQL, tests.
- Periods are half-open `[fromDate, toDate)` (plan 2.2), so a same-day close + open is not an overlap.

## Findings

### M1. "User not deleted" is read without a lock; writers race `deleteUser` / `restoreUser`

- **Where:** `resident-units.service.ts:140` (addToUser reads `deletedAt` before its transaction),
  `:413` (updateKey reads `user.deletedAt` inside the tx but does not lock the user row),
  `auth.service.ts:314` / `residents.service.ts:226` (same pre-transaction check), `user.service.ts:219`
  (`closeAllForUser` runs before the `user.update` in the batch), `flat-ownership.service.ts:176` +
  `trash.service.ts:333` (`reopenForUser` reads the units without `FOR UPDATE`).
- **Problem:** inserting a `resident_units` / `flat_ownerships` row takes only `FOR KEY SHARE` on `users`,
  which does not conflict with `deleteUser`'s non-key `UPDATE`. Nothing serialises the writers against
  delete/restore, so the invariant can break under READ COMMITTED.
- **Scenario A:** SUPER_ADMIN adds flat X to user U (addToUser passes the `deletedAt` check) while another
  admin deletes U. `deleteUser`'s `updateMany` closes U's committed periods (X is not yet committed), then
  addToUser commits unit + open period on X. Result: open period on a deleted user (`period_of_deleted_user`
  = 1). Same with updateKey's link step and lead approval for an existing account.
- **Scenario B:** restore of U runs `reopenForUser` (reads unit X) while `removeFromUser` deletes X on the
  still-deleted account. remove locks X, deletes it, `closeForUnit` sees no committed open period (no-op);
  restore then inserts and commits a period for X. Result: open period without a unit (`period_without_unit`).
- **Fix:** take `SELECT ... FROM users WHERE id = $1 FOR UPDATE` as the first statement of every ownership
  writer transaction (addToUser, updateKey, lead approval, accept-invitation for an existing account,
  deleteUser — make it interactive or put the user `update` first in the batch — and restoreUser), and
  re-check `deletedAt` after the lock. In `reopenForUser`, lock the units (`FOR UPDATE`) or rely on the user lock
  with removeFromUser also locking the user row. Add a DB-level test with two concurrent transactions.

### M2. `FLAT_KEY_STRICT` blocks listings, against the plan ("the link never blocks a listing")

- **Where:** `listings.service.ts:144` (create) and `:202` (update) call `resolveFlatId`, which throws 400
  `unit.error.unknownFlat` in strict mode.
- **Problem:** plan 2.2 says the listing link is informational in v1 and never blocks a listing; who may list is
  decided by `ResidentUnit` ownership (`assertOwnsFlat`). Units with unknown keys legitimately survive strict
  mode until a super admin repairs them, and `assertOwnsFlat` matches on their text.
- **Scenario:** a legacy unit `Building A-3-2` (flatId NULL) is still unrepaired when the owner flips
  `FLAT_KEY_STRICT=true`. Its owner passes `assertOwnsFlat`, then gets 400 `unit.error.unknownFlat` on
  create and on every edit of an existing listing. A live feature breaks for that resident.
- **Fix:** give `resolveFlatId` a `{ strict: false }` option (or a separate `lookupFlatId`) for listings, so
  they always store NULL on an unknown key. Add a test with strict on.

### L1. Catch-up closes window-time periods at the run date, so a flat resold in the window overlaps

- **Where:** `finance-ownership-catchup.sql:60`, `:73` (`toDate` = run date) vs `:110` step 5 (`fromDate` =
  the buyer unit's `createdAt` Cairo date).
- **Scenario:** in the deploy window old code removes A's unit on X (day D) and adds B on X. Catch-up runs on
  D+1: A gets `[1900, D+1)`, B gets `[D, open)`. Both see X's day-D lines; A sees B's payment. Also a unit
  re-keyed by old code (step 0 + 2) closes at the run date instead of as an empty period, unlike `moveLink`.
- **Fix:** for step 2 use `LEAST(run date, MIN(createdAt Cairo date) of a later unit on that flat)` (or the
  `UNIT_REMOVED` audit date), and empty the period for a re-key (`toDate = fromDate`). At least make the
  runbook say "same Cairo day as the deploy".

### L2. `moveLink` empties only the open period; earlier closed periods on the typo flat stay real

- **Where:** `flat-ownership.service.ts:111`.
- **Scenario:** U owns typo flat A (`[1900, d1)` closed ACCOUNT_DELETED, then `[d2, open)` after restore).
  Re-key to B empties only `[d2, d2)`; `[1900, d1)` on A stays, so U still sees A's lines (privacy leak).
  For a deleted owner nothing is emptied at all (no open period exists).
- **Fix:** in `moveLink`, set `toDate = fromDate` (REMOVED) on every period of (oldFlat, user), open or closed.

### L3. Catch-up is not fully safe against concurrent new-code writers

- **Where:** `finance-ownership-catchup.sql:110-136` (step 5).
- **Scenario:** while step 5 reads unit X (committed) and inserts its period, a new-code `removeFromUser` deletes
  X and its `closeForUnit` finds nothing committed to close. Both commit: orphan open period. Also any
  concurrent `openForNewUnit` on the same flat aborts the whole script with a raw unique violation.
- **Fix:** run it in a low-traffic moment and always re-run the invariant SQL (the runbook does); optionally
  `LOCK TABLE resident_units, flat_ownerships IN SHARE ROW EXCLUSIVE MODE` at the start (short script).

### L4. Invariant SQL gaps

- **Where:** `finance-ownership-invariant.sql`.
- **Problem:** no `listing_stale_link` row, although catch-up step 0 repairs exactly that; no check for two
  `resident_units` linked to one flat (there is no unique index on `resident_units.flatId`). The latter makes
  catch-up step 5 abort with an unexplained unique violation instead of being reported.
- **Fix:** add both counts. No false positives found in the existing checks.

### L5. Test gaps

- `flat-ownership.service.spec.ts:173-196`: Cairo dates are tested in winter only; add a summer (UTC+3) case
  (e.g. `2026-07-01T21:30Z` is already 2 July in Cairo).
- The "ownership invariant" suite (`:411`) runs on an in-memory fake; nothing exercises the real row locks,
  the races in M1, or `updateKey` against Postgres. Add a db-spec for addToUser/updateKey/remove/delete/restore.
- No test for listings with `FLAT_KEY_STRICT` on (M2).

### L6. The finance migration is edited in place

- **Where:** `20261102000000_finance_foundations/migration.sql:666-673` (new `finance.goLiveAt` seed).
- **Problem:** any database that already applied the earlier version (local/CI/staging) fails `migrate deploy`
  with a checksum mismatch and lacks the setting, so every late link falls back to the 1900 sentinel (only a
  log warning). Fine for prod (not applied), but confirm no shared environment applied it, or reset it.

## Verdict

No High findings. Writers are complete and transactional, Cairo-date and go-live logic is correct, and listings
set `flatId` on create and update. Fix M1 (user-row locking) and M2 (strict mode must not block listings) before
the PR; the Lows can ride along.

## Resolution (2026-11-02)

- **M1 fixed.** `FlatOwnershipService.lockUser` (`SELECT "deletedAt" FROM users ... FOR NO KEY UPDATE`; does not
  block FK inserts). Taken first in addToUser (re-checks `deletedAt` → 404), removeFromUser, updateKey (looks up
  the owner, locks the user, then the unit: lock order user → unit everywhere), lead approval for an existing
  account and accept-invitation for an existing account (both 409 `user.error.accountDeleted`). `deleteUser` puts
  the user `update` first in its batch, so its row lock waits for a writer and the close sees that writer's
  period. Restore already updated the user row first. Unit tests assert the lock and its order; a two-session
  Postgres race test is not added (the db-spec harness drives `psql` one statement batch at a time).
- **M2 fixed.** `resolveFlatId(client, key, { strict: false })` for listing create and update. Tests added.
- **L1 fixed.** Catch-up step 0 records the re-keyed (flat, user) pairs; step 2 empties those periods and closes a
  removed one on the Cairo day the next owner's unit was created (else the run day). db-spec for the sale case.
  `steps.md` A1 now says "same Cairo day".
- **L2 fixed, narrower than suggested.** `moveLink` empties every period on the old flat that starts on or after
  the unit's own start (`linkFromDate(createdAt)`), so the open period and any delete/restore period go, while a
  genuine period from an older, removed unit of the same user on that flat stays. Test added.
- **L3 fixed.** The catch-up takes `LOCK TABLE resident_units, flat_ownerships IN SHARE ROW EXCLUSIVE MODE`.
- **L4 fixed.** Invariant SQL adds `listing_stale_link` and `flat_linked_to_two_units` (9 checks). db-spec added.
- **L5 partly.** Summer (UTC+3) Cairo case added; strict-mode listing tests added. Real-Postgres writer tests stay
  open (covered by G1 only for the scripts).
- **L6 accepted.** Prod never applied the migration. Any local/CI database that applied the earlier version must
  be reset before `migrate deploy` (it only ever ran in the throwaway db-spec scratch databases).

Gates: tsc 0, eslint 0 errors, 864/864 unit tests. `pnpm test:db` still needs Postgres 15 (gate G1).

