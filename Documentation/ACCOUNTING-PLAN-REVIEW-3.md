# ACCOUNTING-PLAN.md, Re-review 3 (2026-11-02)

This is a read-only review of Revision 3 against the code on `feature/flat-listings`. No code, plan, DB or remote service was touched.

## 1. Were the review-2 findings addressed?

Yes. Every C, H, M and L row in the rev-3 changelog appears in the plan body. Spot checks against the code all held:
- `ROLE_RANK` at `auth.service.ts:52`.
- The three `residentUnit.create` writers at `auth.service.ts:405`, `residents.service.ts:272` and `resident-units.service.ts:112`, and the `deleteMany` at `:171`.
- `deleteUser` is a bare soft-delete `update` (`user.service.ts:176-219`).
- `proxy.ts:21` returns early, and the matcher is at `:33-46`.
- `UNRESTRICTED_ROLES` at `access-policy.ts:24`.
- `ROLE_HOME_ROUTE` at `session.ts:31`.
- The listings `(tabs)/flats/*` routes exist.
- The partial-index warnings are in `schema.prisma`.

M6 is honestly marked "mitigated".

Two of the fixes create new problems:
- the C1 bounce fix breaks the closed-period rule (H1 below);
- the H6 ownership fix makes the account-restore rule impossible to carry out (H4 below).

## 2. Findings

No Blockers.

### High

**H1: A bounce changes closed-month figures (§2.1.1 l.139, §3.8 l.948-964, §2.4 as-of rule l.485).**
- Problem: "live payment" is a *current* state (`chequeState <> BOUNCED`). It is not checked against a date.
- Example: a cheque received in October (now closed) bounces in November. From that moment it drops out of every balance.
  - October's statement closing figure, R5 "as of 31 Oct" and the brought-forward lines all change.
  - Only the allocations are dated (`voidedAt = bouncedAt`).
  - So R5 (status-based) and R6 (as-of allocations) disagree for any historical date.
  - The closed month is rewritten. That contradicts §3.2 ("closed numbers stay stable") and l.962.
- Fix: make liveness date-aware.
  - Define `live as of D` = `status = POSTED AND (bouncedAt IS NULL OR bouncedAt > D)`. Today's balance is D = today.
  - The statement keeps the payment at `receivedAt`. It adds a separate debit line "Cheque bounced, R-…" at `bouncedAt`.
  - Use the same as-of treatment for `Charge`/`Payment` `voidedAt`.
  - Add a test: close October, bounce in November, and check that October's R5/R6 are unchanged.

**H2: Deposit money is counted as operating income (§2.1 p.4 l.117, §2.4 "Rule that avoids double counting" l.570, §6.1 R1/R2/R3).**
- Problem: "a flat Payment against a flat Charge is the revenue". A payment allocated to a `MAINTENANCE_DEPOSIT` charge therefore shows in R1/R2 income, and also as `DEPOSIT_IN` in R4.
  - Fund capital ends up in the operating net, which breaks owner decision 5 (keep the funds separate).
  - Unallocated credit (a liability) would also count as income.
- Fix: base income on allocations, not payments.
  - R1/R2 income = live allocations to non-deposit charges, by `allocatedAt`, plus `Revenue`.
  - Deposit allocations appear only in R4.
  - Unallocated credit is reported as "prepayments held", not income.
  - R3 needs two cash lines (operating vs fund), or an explicit note that one bank account holds both.
  - Add a test: a 1,000 deposit payment changes R4 by +1,000 and R1 by 0.

**H3: The listings backfill will abort the migration on normal data (§2.2 l.251-254, §2.3.1 row 2).**
- Problem: `Listing.flatId` is backfilled "with the same collision assertions". But many listings per flat is normal: REJECTED, WITHDRAWN, SOLD and EXPIRED rows stay as history, and only `listings_active_unit_key` limits *active* rows (`20261031000000_flat_listings`).
  - Listings ship before finance, so the first relisted flat makes `RAISE EXCEPTION` fire on prod.
  - Render's `migrate deploy` then fails every deploy.
- Fix: for `listings`, assert only that a key is known (`RAISE NOTICE` for unknown keys), never that it is unique. Keep the uniqueness assertion for `resident_units` only. Correct the preflight `collision_groups` for listings the same way.

**H4: The restore path cannot work, and `ResidentUnit` drifts from `FlatOwnership` (§2.2 paths 5-6 l.268-279, §8.1 Delete safety).**
- Problem: account deletion closes the period but keeps the `ResidentUnit` row (Restrict).
  - Path 6 says an admin "re-adds the flat through path 3". But `addToUser` refuses with `unit.error.alreadyOwned` when *any* owner, "this account included", already holds the row (`resident-units.service.ts:91-92`).
  - So a restored owner can never regain finance visibility.
  - Meanwhile the deleted user still blocks a new owner's accept-invitation (`auth.service.ts:405`, 409), so the documented sale flow needs path 4 first. The plan does not say so.
- Fix:
  - State the invariant: an open `FlatOwnership` exists ⇔ a `ResidentUnit` exists ⇔ the user is not deleted.
  - On restore, reopen a period (new row, `fromDate` = restore date) for every `ResidentUnit` the user still holds. A sale would have deleted that row, so its presence proves ownership.
  - Or add an explicit admin "reopen ownership" action. Either way, add a test.

### Medium

**M1: The invariant fails while a refund is pending (§2.1.1 l.152-154).**
- With a PENDING refund R:
  - credit = payments − allocations − R;
  - balance excludes R.
- So `sum(open) − credit` = balance + R. The "asserted on every fixture" test fails.
- Fix: name two figures. `credit` (no refund term) satisfies the invariant. `availableCredit = credit − pending/approved refunds` gates refunds and apply-credit.

**M2: Bad `resident_units` keys have no repair path, and late links never get ownership (§2.2 l.208, l.238-248).**
- The plan says to fix bad keys by "an admin edit of the unit". No such endpoint exists: `ResidentUnitsService` has only `addToUser` and `removeFromUser`.
- Remove plus re-add produces a real-date period instead of the 1900 sentinel.
- Under `FLAT_KEY_STRICT=false`, a unit stored with `flatId = NULL` never gets a `FlatOwnership` row, even after correction.
- Fix:
  - add an audited `PATCH` for the unit key (sets `flatId` and opens a sentinel period when the row predates go-live);
  - or fix bad keys with owner-run SQL before the migration;
  - add a "link and open period" step whenever `flatId` changes from NULL.

**M3: The `finance_live_payments` view has no migration, and its exposure is unchecked (§2.1.1 l.134, l.161-164; §2.3.1).**
- Phase 2 "adds the refund terms behind the same function name". A view change needs `CREATE OR REPLACE VIEW` in `..._finance_ledgers`, and row 3 does not list it.
- Views in `public` are reachable through the Supabase Data API and bypass RLS by default. The lockdown (`20261007000000_enable_rls_lockdown:33-40`) revokes grants on tables, not specifically on views.
- Fix: list the view in rows 2 and 3. Create it `WITH (security_invoker = true)`, add an explicit `REVOKE ALL … FROM anon, authenticated`, and add a migration test.

**M4: Big commits will hit Prisma's 5 s interactive-transaction timeout (§4.2 step 3, §4.6 step 3).**
- An import commit of up to 1000 flats does all of this in one transaction:
  - charges, payments, allocations, fund entries and audit rows;
  - one `O-` counter increment per payment.
- It runs over the Supabase pooler from Render. That exceeds the default `timeout: 5000`. A failure rolls back everything: safe, but the commit can never succeed.
- Fix: set `{ timeout, maxWait }` explicitly, reserve the counter range with one `UPDATE … SET last = last + n RETURNING`, use `createMany` per table, and load-test with 1000 rows.

**M5: Mobile has no confinement for ACCOUNTANT (§8.3).**
- Web gets an allow-list. Mobile only gets a landing route.
- An accountant still sees the `(tabs)` Orders and Community tabs. Their backend routes exclude ACCOUNTANT (`orders.controller.ts:45,57`; polls/elections `[RESIDENT]`), so they show 403 error toasts.
- Fix: gate those tabs for ACCOUNTANT with the existing `useGuestGate`/Coming-soon pattern, or hide them. Add this to the Phase 1 mobile scope.

### Low

- **L1 §2.2 l.215-216:** assertion (c) mentions co-owners, but `resident_units` is unique per flat, and no writer ever opens a second ownership row. Drop the co-owner wording or name the writer.
- **L2 §2.4 Payment.reference l.457:** opening imports put about 690 payments with `(CASH, 'OPENING')`. Say the duplicate check is a soft warning (not a unique index) and that it excludes `isOpening`.
- **L3 §8.1 l.1480:** the ACCOUNTANT web allow-list omits `/notifications` and `/api/notifications`, while §8.1 adds ACCOUNTANT to the backend notification routes. Pick one.
- **L4 §10 l.1685:** "grew from 10 to 14 days" is stale; the estimate is 18 to 25.

## 3. Breakage check

- Roles: `ROLE_RANK` and `ROLE_HOME_ROUTE` are exhaustive `Record`s, so the compiler forces both edits. Other code compares roles with strict equality, so ACCOUNTANT falls through safely. The web proxy restructure is pinned by tests.
- Migrations: the enum is split out correctly (precedent `20261004000000_super_admin_role`), and `RAISE EXCEPTION` follows `20261003000000_lowercase_emails:25-36`. The risk is H3.
- Soft delete and ownership: safe for the ledger (Restrict, no cascade). The restore and sale ordering issues are in H4.

## 4. Verdict

**Not ready yet. Yes, once H1-H4 and M1-M4 are applied.**
- H1 and H2 are accounting-correctness changes to the definitions: date-aware liveness, and allocation-based income.
- H3 would fail the prod deploy.
- The rest are small plan edits.
- Phasing (1a/1b/2/3) is deliverable in safe slices.

Counts: Blocker 0, High 4, Medium 5, Low 4.
