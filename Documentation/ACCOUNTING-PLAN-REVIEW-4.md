# ACCOUNTING-PLAN.md, Re-review 4 (2026-11-02)

Focused, read-only check of Revision 4 against the 13 findings of `ACCOUNTING-PLAN-REVIEW-3.md`. No plan, code, DB or remote service was touched. Code references were checked under `apps/` (read-only).

## 1. Review-3 findings

| ID | Verdict | Note |
|---|---|---|
| H1 | Fixed | Dated predicates (l.175-180), bounce debit line (l.212-216), 3.2, 3.8 and the "close Oct, bounce Nov" test all agree. Three places still spell the old short form (see L-1). Flow reports still have a hole (see N-1). |
| H2 | Fixed | Allocation-based income in 2.1 p.4, 2.4 (l.712-726), 6.1 R1-R4 and 4.6, with tests (3) and (4). Opening-credit edge case: see N-5. |
| H3 | Fixed | Known-key only for `listings` (l.354-359), uniqueness for `resident_units` only (l.297), preflight (l.274-281), 2.3.1 row 2 and Phase 1 rows all match. |
| H4 | Fixed | Invariant (l.402-408), restore reopen with test (l.390-401), sale runbook (l.376-383), 8.1 and 9 all match. `removeFromUser` does accept soft-deleted accounts (`resident-units.service.ts:146-150`). Small gaps: L-2, L-3. |
| M1 | Partially fixed | The invariant and `credit` are right, but `availableCredit` has two different formulas (N-3). |
| M2 | Fixed | Audited `PATCH /admin/resident-units/:id`, the "link and open period" step, the SQL fallback, and 7.1. Edge case: L-3. |
| M3 | Partially fixed | The view is listed in both migrations, with `security_invoker` and a test. But the unguarded `REVOKE` breaks plain Postgres (N-2). |
| M4 | Fixed | Explicit `{ timeout, maxWait }`, one-statement range reservation (l.985-991), `createMany` per table, 1000-row load test at Phase 1 exit. |
| M5 | Partially fixed | The tab-layout change is right, but the plan says the wrong gates protect the Orders and governance entry points (N-4). |
| L1 | Fixed | Co-owner wording is gone (l.294, l.516). |
| L2 | Fixed | Soft warning, excludes `isOpening` (l.594, l.1525). |
| L3 | Fixed | `/notifications` and `/api/notifications` are on the allow-list and in the tests (l.1678-1704). |
| L4 | Fixed | l.1892. |

Counts: Fixed 10, Partially fixed 3, Not fixed 0.

## 2. New findings

No Blockers.

### High

**N-1: Multi-month flow reports still rewrite a closed month after a bounce (§6.1 l.1369-1373, R1/R2/R4/R8).**
- Problem: every report uses one D, the report's `to` date.
  - Take an October cheque allocated in October that bounces in November. An "Oct–Nov" R1 with D = 30 Nov drops that allocation from the **October column**. So the October column no longer matches the published October report.
  - The November column shows no negative income either: the allocation's `allocatedAt` is in October.
  - R4 has the same problem: a `DEPOSIT_IN` row voided at `bouncedAt` has no reversal line in November.
  - Only R3 says what to do with bounces ("negative line at `bouncedAt`").
- Fix: flow reports book reversals on the date of the event.
  - An allocation or fund entry voided at V counts +amount in its `allocatedAt`/`entryDate` bucket and −amount in V's bucket.
  - Equivalent rule: each month's column is computed as of its own month-end.
  - Test: R1(Oct–Nov) equals R1(Oct) + R1(Nov), before and after the bounce.
- Phase 3 work, so it does not block Phase 1a.

**N-2: The unguarded `REVOKE ... FROM anon, authenticated` breaks every non-Supabase database (§2.1.1 l.226, §2.3.1 rows 2-3).**
- Problem: on plain Postgres (local docker `postgres:16-alpine`, CI, the "migrated test DB") the `anon` and `authenticated` roles do not exist.
  - So `..._finance_foundations` fails with "role does not exist", and `migrate dev/reset` and the planned migration test cannot run.
  - The precedent `20261007000000_enable_rls_lockdown:20-21,32-40` guards its revokes with a `pg_roles` check for exactly this reason.
  - `has_table_privilege('anon', ...)` in `finance-view-privileges.spec` also errors when the role is missing.
- Fix:
  - Wrap the `REVOKE` in a `DO $$` block with the same `supabase_roles` guard, in both migrations.
  - The spec either creates the two roles in its setup or skips the privilege assertion when they are absent. It always keeps the `security_invoker` check.

### Medium

**N-3: `availableCredit` has two formulas (l.180, l.197, l.1016 vs l.20, l.687, l.1017).**
- Problem:
  - l.197 and l.1016 say `credit − PENDING_APPROVAL`. That is correct, because `credit` already subtracts approved refunds.
  - l.180 ("`status IN ('PENDING_APPROVAL','APPROVED')` for availableCredit"), l.687 and the changelog say to subtract pending **and approved** refunds.
  - If an implementer applies that to `credit`, approved refunds are subtracted twice. Valid refunds and `apply-credit` calls would then fail with `insufficientCredit`.
- Fix: keep one formula, `availableCredit = credit − sum(PENDING_APPROVAL refunds)`, or spell it out from raw terms: `payments − allocations − (approved + pending) refunds`. Reword l.180, l.20, l.687 and l.1017 to match.
- In Phase 1 the refund terms are 0, so this cannot hurt 1a.

**N-4: M5 names gates that do not protect the Orders and governance entry points (§8.1 l.1651, §8.3 l.1831-1834).**
- Problem: the plan says Orders is reachable only from Profile and a Home tile, "both gated through `useGuestGate`". That is false:
  - Profile "My orders" is a plain `router.push` (`(tabs)/profile/index.tsx:352`).
  - The Home tiles use `useAuthGuard().requireAuthNavigation` (`resident-home.tsx:108,235`).
  - The governance, community and reports tiles, and "View all", push directly (`:169`, `:215-219`).
  - So extending `useGuestGate` changes none of these, and an accountant still reaches the Orders and polls screens and gets 403s.
- Fix: in `QUICK_ACTIONS`, add `visible: role => role !== 'ACCOUNTANT'` to the orders, governance and community tiles. Hide the Profile orders row for ACCOUNTANT. Add jest cases for both.

### Low

- **L-1 (l.16, l.595, l.1113-1114):** these lines still use the short liveness form `status = POSTED AND (bouncedAt ... > D)`. It drops `receivedAt <= D` and the dated void clause from l.177. Replace it with "live as of D (2.1.1)".
- **L-2 (l.327-331):** the M2 link step opens a period without checking `deletedAt`. Running the `PATCH` on a soft-deleted user's unit would break the H4 invariant. Open the period only when the user is not deleted; `restoreUser` opens it later.
- **L-3 (l.323, l.1516):** the unit-key `PATCH` is ADMIN, but adding and removing units is SUPER_ADMIN-only (`user.admin.controller.ts:52-129`). Re-keying moves ownership, so make it SUPER_ADMIN, or record the reason for the difference.
- **L-4 (l.722 vs l.723):** opening-credit rows contradict each other. One line says credit "becomes income when `apply-credit` allocates it". The next says an opening payment's allocations are "never income". Fix: exclude only the allocations the import creates (dated `as_of`). A later `apply-credit` against a non-deposit charge is income (not cash).
- **L-5 (l.1630 vs l.1651, l.1683):** the backend opens comments to ACCOUNTANT, but web denies `/announcements` and mobile locks Community. Either drop the comments grant or note that it is unused in v1.

## 3. Verdict

**Ready to implement Phase 1a: yes, after two small plan edits.**
- N-2: guard the `REVOKE`, otherwise the Phase 1 migration fails locally and in CI.
- N-4: correct the mobile gating list, which is Phase 1 mobile scope.
- N-1 (Phase 3) and N-3 (Phase 2) must be fixed before those phases. The Lows can be fixed during implementation.

Counts: findings Fixed 10 / Partially 3 / Not fixed 0. New: Blocker 0, High 2, Medium 2, Low 5.
