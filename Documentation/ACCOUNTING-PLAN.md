# EastPark Accounting System — Plan

Status: REVISION 5, DRAFT for owner review (2026-11-02). Applies every new finding of
`ACCOUNTING-PLAN-REVIEW-4.md` section 2 (on top of revision 4, which resolved `ACCOUNTING-PLAN-REVIEW-3.md`, and
revision 3, which resolved `ACCOUNTING-PLAN-REVIEW-2.md`). Plan only; no code, schema or config changed.
Scope: backend (`apps/backend`), web (`apps/web`), mobile (`apps/mobile`).

## Revision 5 changelog (review 4 new finding to where it is fixed)

Section numbers are unchanged. One rule is new: **flow reports book a reversal in the month it happens**
(6.1 "Reversals in flow reports"). One formula is now written the same way everywhere: `availableCredit = credit −
sum(PENDING_APPROVAL refunds)`.

| ID | Status | Where | What changed |
|---|---|---|---|
| N-1 | Fixed | 6.1 (preamble, "Reversals in flow reports", R1, R2, R3, R4, R8), 2.1.1 | Flow reports (R1, R2, R3, R4, R7, R8) no longer use one D for the whole range: a row voided or bounced on V counts +amount in its original bucket (`allocatedAt`/`entryDate`/`receivedAt`/`accrualPeriod`) and −amount in V's bucket, so every month column equals that month computed on its own. Test: R1(Oct–Nov) = R1(Oct) + R1(Nov), before and after a November bounce of an October cheque; same test for R2, R4 and R8. Stock reports (R5 closing balance, R6, the brought-forward line) keep the single as-of D |
| N-2 | Fixed | 2.1.1 (view exposure), 2.3.1 rows 2 and 3, 10 (Phase 1, Phase 2) | Every `REVOKE ... FROM anon, authenticated` sits in a `DO $$` block with the `pg_roles` guard of `20261007000000_enable_rls_lockdown:17-43`, in both migrations, so plain Postgres (local docker, CI, the migrated test DB) does not fail with "role does not exist". `finance-view-privileges.spec` skips the anon/authenticated assertions when those roles are absent and always checks `security_invoker` |
| N-3 | Fixed | changelog rev 4 M1, 2.1.1 (live refund, available credit), 2.4 (credit reservation), 3.5 | One formula everywhere: `availableCredit = credit − sum(PENDING_APPROVAL refunds)`, where `credit` already subtracts APPROVED refunds. The "pending and approved" wording is gone, so approved refunds cannot be subtracted twice |
| N-4 | Fixed | 8.1 (Mobile), 8.3, 10 (Phase 1 Mobile), changelog rev 4 M5 | Real mechanisms named: Profile "My orders" is a plain `router.push`, the Home orders tile uses `useAuthGuard().requireAuthNavigation`, the governance/community/reports tiles and "View all" push directly. Fix: `visible: role => role !== 'ACCOUNTANT'` on the orders, governance, community and reports tiles and on "View all"; the Profile "My orders" row is hidden for ACCOUNTANT; jest cases for both |
| L-1 | Fixed | rev 4 changelog H1, 2.4 (Payment.chequeState), 3.8 | Short liveness forms replaced with "live as of D (2.1.1)" |
| L-2 | Fixed | 2.2 (link and open period) | The link step opens a period only when the unit's user is not soft-deleted; `restoreUser` opens it later (2.2 path 6) |
| L-3 | Fixed | 2.2 (unit-key `PATCH`), 7.1 | `PATCH /admin/resident-units/:id` is SUPER_ADMIN, matching unit add/remove (`user.admin.controller.ts:52-129`): re-keying moves ownership |
| L-4 | Fixed | 2.4 (Revenue rule), 4.6 | Only the allocations the opening import creates (dated `as_of`) are excluded from income; a later `apply-credit` of opening credit against a non-deposit charge is income (not cash) on its allocation date |
| L-5 | Fixed | 8.1 (backend role table) | ACCOUNTANT comments grant dropped from the v1 backend scope (web denies `/announcements`, mobile locks Community) |

## Revision 4 changelog (review 3 finding to where it is fixed)

Section numbers are unchanged. Two definitions changed and were updated everywhere they are used: **liveness is
now date-aware** ("live as of D", 2.1.1) and **income is allocation-based** (2.4 "Rule that avoids double
counting", 6.1). The credit figure is split into `credit` and `availableCredit` (2.1.1, 3.5).

| ID | Status | Where | What changed |
|---|---|---|---|
| H1 | Fixed | 2.1.1, 2.4 (Payment, as-of rule), 3.2, 3.8, 6.1, 7.2 | Payments are counted when live as of D (2.1.1: received by D, not voided by D, not bounced by D), same as-of treatment for Charge `voidedAt`; the statement keeps a bounced payment at `receivedAt` and adds a separate "Cheque bounced" debit line at `bouncedAt`; closed months never change; test "close October, bounce in November, October R5/R6 unchanged" |
| H2 | Fixed | 2.1 p.4, 2.4 (Revenue rule), 6.1 (R1-R4), 6.4, 4.6 | Income = live allocations to non-deposit charges by `allocatedAt` plus `Revenue`; deposit allocations only in R4; unallocated credit is "prepayments held", never income; R3 splits operating and fund cash (or states one bank account holds both); test "1,000 deposit payment: R4 +1,000, R1 0" |
| H3 | Fixed | 2.2 (diagnostic, normalisation, listings link), 2.3.1 row 2, 10 (Phase 1) | Listings backfill asserts only a known key (`RAISE NOTICE` for unknown), never uniqueness; uniqueness stays for `resident_units` only; preflight reports no `collision_groups` for listings (only `active_collision_groups` for informational use) |
| H4 | Fixed | 2.2 (invariant, paths 4-6), 2.4 (FlatOwnership), 8.1 Delete safety, 9 | Invariant "open `FlatOwnership` ⇔ `ResidentUnit` exists ⇔ user not deleted"; restore reopens a period (`fromDate` = restore date) for every `ResidentUnit` the user still holds, with a test; a sale whose seller account is deleted needs path 4 (remove the unit) before the buyer's accept-invitation (`auth.service.ts:405` returns 409 otherwise) |
| M1 | Fixed | 2.1.1, 2.4 (credit reservation), 3.5, 7.1 | `credit` (no refund term, satisfies the invariant) and `availableCredit = credit − sum(PENDING_APPROVAL refunds)` (`credit` already subtracts APPROVED ones; gates refunds and apply-credit; wording unified in revision 5, N-3); invariant test wording fixed |
| M2 | Fixed | 2.2 (diagnostic, flatId paragraph), 7.1 | Audited `PATCH /admin/resident-units/:id` corrects the unit key and sets `flatId`; a "link and open period" step whenever `flatId` goes NULL to a value (sentinel `fromDate` if the row predates go-live); owner-run SQL before the migration is the fallback |
| M3 | Fixed | 2.1.1, 2.3.1 rows 2 and 3 | `finance_live_payments` view listed in both migrations (`CREATE OR REPLACE VIEW` in `..._finance_ledgers`), `WITH (security_invoker = true)`, explicit `REVOKE ALL ... FROM anon, authenticated` (guarded by a `pg_roles` check since revision 5, N-2), migration test |
| M4 | Fixed | 3.4, 4.2, 4.6 | Large commits set `{ timeout, maxWait }`, reserve the counter range with one `UPDATE ... SET last = last + n RETURNING`, use `createMany` per table, load-tested with 1000 rows |
| M5 | Fixed | 8.1 (Mobile), 8.3, 10 (Phase 1 Mobile) | ACCOUNTANT on mobile: Community tab opens the Coming soon sheet (existing `guestLocked`/`useGuestGate` pattern, extended to a role check), Orders stays hidden, Flats stays hidden (`canBrowseListings`), Home tiles to Orders gated (the named gates were wrong; corrected in revision 5, N-4) |
| L1 | Fixed | 2.2, 2.4 (FlatOwnership) | Co-owner wording dropped: at most one open period per flat |
| L2 | Fixed | 2.4 (Payment.reference), 7.2 | Duplicate reference is a soft warning, not a unique index, and excludes `isOpening` rows |
| L3 | Fixed | 8.1 (web lockdown, tests) | `/notifications` and `/api/notifications` added to the ACCOUNTANT web allow-list, matching the backend notification routes |
| L4 | Fixed | 10 (Phase 1) | Stale "grew from 10 to 14 days" sentence corrected to the 18 to 25 estimate |

**Code references re-checked on 2026-11-02:** `addToUser` refuses any existing owner (`resident-units.service.ts:91-92`);
`restoreUser` is a bare `db.user.update` (`trash.service.ts:294-316`); the RLS lockdown revokes on tables and default
privileges for tables (`20261007000000_enable_rls_lockdown:33-40`), not on views; the mobile Orders tab is already
`href: null` and Flats is hidden for roles failing `canBrowseListings` (`(tabs)/_layout.tsx`, `lib/listings-access.ts`).

## Revision 3 changelog (review 2 finding to where it is fixed)

Section numbers are unchanged from revision 2; new sub-sections are 2.1.1 (live predicates) and 2.3.1 (migration list).
Every code claim in the review was re-checked against the tree on 2026-10-31 and is accurate; two extra problems the
review did not list are noted at the end.

| ID | Status | Where | What changed |
|---|---|---|---|
| C1 | Fixed | 2.1, 2.1.1, 3.8, 3.5, 6.1 | One "live payment" predicate (`status = POSTED AND chequeState <> 'BOUNCED'`, SQL view plus `livePaymentWhere()`), used by balance, statement, credit, R3/R5/R6, me-finance and the brought-forward line; equality and lint tests |
| C2 | Fixed | 8.3, 10 (Phase 1, 2), 8.1 | Listings own `/flats`. Staff screens are `(finance)/finance/...`, URLs `/finance/...`; full planned-URL table; no `index` file; `ROLE_HOME_ROUTE.ACCOUNTANT = "/finance/today"`; collision test gains a `/finance/` prefix case |
| H1 | Fixed | 2.3, 2.3.1, 2.4 (FundEntry, Payment), 4.6, 10 | `FundEntry` (`countsInFundTotal`, `holding: FundHolding`, `OPENING_BALANCE`) and `Payment.isOpening` ship in `..._finance_foundations`; Phase 2 only adds `fund_entries.expense_id` |
| H2 | Fixed | 2.3.1, 10 | One list of five migrations, section 10 refers to it; "notification preference defaults" removed |
| H3 | Fixed | 2.2 | Preflight `check-flat-keys.sql`; `RAISE EXCEPTION` on any collision or if flats are not 690; offline `migrate diff` generation; `migrations-keep-partial-indexes` test; explicit warning that `migrate dev` drops `listings_active_unit_key` and `resident_leads_active_unit_key` |
| H4 | Fixed (decision) | 2.2, 2.4, 2.5, 11 Q16 | Link: nullable `Listing.flatId`, informational in v1; Q16 warning on SELL approval |
| H5 | Fixed (owner decision) | 2.2, 9, 11 Q3 | New owner sees only own-period lines plus one brought-forward line; previous-owner history is staff-only; Q3 default changed to "No" |
| H6 | Fixed | 2.2, 2.4 (FlatOwnership), 8.1, 9 | Six ownership writer paths incl. `deleteUser` (closes periods with `ACCOUNT_DELETED`, now in a `$transaction`) and a restore rule; backfill `fromDate = 1900-01-01` |
| H7 | Fixed | 2.1, 2.1.1, 2.4 (credit reservation), 3.5 | Balance = live charges - live payments + APPROVED refund expenses; refund shows as a statement line; credit and balance stay consistent |
| H8 | Fixed (owner decision) | 8.1, 10 (Phase 1 Web), Appendix A | `/finance` and `/api/finance` added to the deny lists and the proxy matcher; ACCOUNTANT is **not** in `UNRESTRICTED_ROLES`, it has its own allow-list (finance, home, profile); `postLoginPath`; tests |
| H9 | Fixed | 2.4 (FiscalPeriod), 3.2, 3.4 | Mechanism: transaction plus row lock (not compare-and-set). Postings upsert the period row and take `FOR SHARE`; close takes `FOR UPDATE`; step 0 of the lock order; barrier concurrency test |
| M1 | Fixed | 2.4, 3.3 | `requestKey` unique and `requestHash` on Expense, Revenue, FundEntry; P2002 re-read; `idempotencyConflict` on a hash mismatch |
| M2 | Fixed | 6.4 point 4, 8.3, 10 (Phase 3) | One path, `/(tabs)/profile/finance/reports/<id>`; `routing.test.ts` case; `finance-reports` wording removed |
| M3 | Fixed | 2.4 (BillingRun, Charge), 4.2 | `accrualPeriod` defined for monthly, quarterly, annual, custom; the commit checks it is OPEN under the lock |
| M4 | Fixed | 3.8, 7.2 | Cheque clearance and bounce dates validated against period status (`periodClosed`), default today |
| M5 | Fixed | 2.1 principle 6, 3.4, 3.6 | All finance dates derived in `Africa/Cairo` through one helper |
| M6 | Mitigated, not eliminated | 2.2 | Staged: preflight over leads, DTO validation first, admin lead-unit correction `PATCH`, then `FLAT_KEY_STRICT`. Until the owner flips the flag an unknown key is stored with `flatId = NULL`, so a bad lead is never blocked but also never gets ownership or statements |
| M7 | Fixed | 2.3, 2.4 (PublishedReport) | `approvalRef` added; "superseded" is derived from a newer row's `supersedesId`, no new enum value |
| M8 | Fixed | 3.7, 7.5 | Finance audit actions hidden from the default `GET /admin/activity` (`scope=finance` or `scope=all`, `FINANCE_AUDIT_ACTIONS`); full feed at `/finance/audit` |
| L1 | Fixed | 2.5 | Diagram redrawn with `flatId`, `FlatOwnership`, `Listing.flatId` |
| L2 | Fixed | 9 | Concurrency row now states the 3.4 lock order |
| L3 | Fixed | 2.4 (Expense) | "Number assigned at creation, whatever the approval status" |
| L4 | Fixed | 2.4, 3.4, 8.2 | `receipt.prefix` dropped; scopes R/O/E/V/F are fixed |
| L5 | Fixed | 8.1 | ACCOUNTANT left out of public self-delete, same as ADMIN and SUPER_ADMIN, with the reason; delete-safety row covers ownership close and the open-work check |
| L6 | Fixed | 10 (Phase 1 Mobile delivery) | OTA reaches only `expo-updates` builds (v11+); older installs fall back to Home |
| L7 | Fixed | Appendix A | Added: listings `/flats` route, collision rule, `ROLE_HOME_ROUTE`, both partial indexes and their schema lines, `deleteUser` soft delete, access-policy structure, proxy matcher, `postLoginPath`, `GatedLink` |

**Deferred / accepted.** (1) M6 is mitigated by staging, not removed (see the row above): a lead typed as free text stays
unlinked until an admin corrects it (revision 4, M2: the unit-key `PATCH` now gives a stored unit the same
correction path and opens its ownership period on linking). (2) `Listing.flatId` is informational in v1: it does not gate who may list or block
approval. (3) The Phase 1 refund terms are zero (no expense can reference a refund before Phase 2), so the H7 refund term
in the balance formula is exercised only from Phase 2; the predicate and the tests still ship in Phase 1.
(4) Self-delete for accountants is intentionally unavailable (L5); ask SUPER_ADMIN. (5) Multi-role users remain out of
scope (Q18).

**Extra findings from the verification (not in the review).** (a) `apps/web/src/proxy.ts` has an explicit path `matcher`
and its body returns early for paths outside the deny lists, so adding `/finance` to a deny list alone does nothing: the
matcher entry and a proxy restructure are part of H8 (8.1). (b) `UserService.deleteUser` is a bare `db.user.update` with
no transaction (`user.service.ts:176-219`), so the H6 ownership close needs a new `$transaction` around it, with the
existing session `bump` calls kept outside.

---

## 1. Summary, scope, out of scope

### 1.1 Summary

A compound-finance module for the people who run EastPark's money. An **ACCOUNTANT** records what flats owe
and pay, what the compound earns and spends, and the maintenance fund. **Admins** approve large expenses and
see everything. **Residents** see their own flat statement and the financial summaries management publishes.

It is a **single-entry ledger with audit discipline**, not a double-entry ERP. Accountants think in
"charge a flat", "receive a payment", "record an expense". The system keeps them honest with immutable
rows, void-with-reason, gap-free receipts, period locks and a full audit trail.

### 1.2 Who does what

| Role | Short version |
|---|---|
| ACCOUNTANT | Records charges, payments, expenses, revenues, fund entries. Runs reports. Cannot approve expenses above the threshold, change roles, or touch non-finance data. |
| ADMIN / SUPER_ADMIN | Everything an accountant does, plus: approve expenses, set the threshold, close/reopen periods (SUPER_ADMIN reopens), publish summaries, void anything. |
| RESIDENT | Read-only: own flat statements and published summaries. |
| MERCHANT | No access. |

### 1.3 In scope (v1)

- Flat registry with a per-flat ledger (charges, payments, balance, arrears).
- Recurring fee billing to all flats (service charge, shortfall collection).
- Maintenance fund: deposit contributions, investment income, maintenance spend, balance and movements.
- Compound expenses with vendors and an approval threshold; revenues (incl. paid services sold to residents).
- Opening-balance import from CSV/Excel with preview.
- Reports, CSV export, published resident summaries, push notifications.
- Receipt documents in a private bucket.

### 1.4 Out of scope (and why)

| Not in v1 | Reason |
|---|---|
| Tax filing, VAT invoices, e-invoicing (ETA) | Compound is not a taxable merchant here; legal exposure and certification cost. Revisit if the owner needs it. |
| Bank feeds / reconciliation automation | Needs paid or unstable bank APIs in Egypt; violates the free-stack rule. A manual "cleared date" field is enough. |
| Online payment collection (Paymob for dues) | Payments are already postponed app-wide (`PAYMENTS_ENABLED=false`). Accountants record cash / transfer / InstaPay received outside the app. |
| Multi-currency | EGP only. One currency removes FX rounding and revaluation. |
| Late fees / penalties | Owner decision 6. Overdue days and aging only. |
| Double-entry chart of accounts, payroll, inventory, budgets | ERP territory. A simple budget-vs-actual per category is a v2 candidate. |
| Refunds of maintenance deposits | Deposits are non-refundable by owner decision 5. A flat credit can still be refunded as a payment-out, see 3.5. |
| Resident online payment, auto-reminders by SMS | Later. Push on published reports and overdue reminders (manual trigger) only. |

---

## 2. Domain model

### 2.1 Design principles

1. **Everything money-related is append-only.** A row is created once. Mistakes are fixed by voiding the row
   (status change with reason, actor and time) and posting a replacement. No `DELETE`, no editing of amount,
   flat, date or category after posting.
2. **Money is `Decimal(12,2)`** in EGP, returned to clients through `toMoneyNumber` (same as orders,
   `apps/backend/src/common/helper/money.ts`). The flat ledger and fund use integer-safe Decimal arithmetic
   only; no `Float` anywhere.
3. **Balances are derived, never stored as the source of truth.** A flat's balance is
   `sum(live charges) − sum(live payments) + sum(approved refund expenses)` computed from rows, where "live" is
   the single, **date-aware** definition in 2.1.1 ("live as of D"; today's balance is D = today). A small read-through cache table is optional later; v1 computes with indexed
   aggregates (compound has about 700 flats, so this is cheap).
4. **One ledger for dues, one for the company's own cash.** Flat-side tables (charges, payments) explain who
   owes. Cash-side tables (expenses, revenues, fund entries) explain where money went. A payment from a flat
   also appears in cash-side reports through a view, not a duplicate row. **Income is recognised from
   allocations, not from payments (review 3, H2):** operating income is a live allocation to a non-deposit
   charge (plus `Revenue` rows); an allocation to a `MAINTENANCE_DEPOSIT` charge is fund capital (R4 only); an
   unallocated remainder is a liability ("prepayments held"), never income (6.1).
5. **Periods are calendar months.** Each posting has an `accrualPeriod` (`YYYY-MM`) and a `cashDate`.
   Period close locks both.
6. **Finance dates are Cairo dates (review 2, M5).** "Same calendar day" voids, the receipt year, `YYYY-MM`
   periods, aging as-of dates and the 31 December / 1 January boundary are all computed in `Africa/Cairo`
   (UTC+2, UTC+3 in summer), never in the server's UTC. One helper `cairoDate(instant)` returns the
   `YYYY-MM-DD` string; every `Date` column in the finance tables stores the Cairo-local calendar date (Prisma
   `@db.Date`), and `createdAt`/`voidedAt` stay UTC instants. A unit test pins `2026-12-31T22:30Z` to
   `2027-01-01`, and pins the DST change.

### 2.1.1 The shared "live" predicates (review 2, C1 and H7)

The first draft defined the balance as non-void charges minus non-void payments, while 3.8 left a bounced
cheque at `status = POSTED`. A bounced cheque then still reduced the balance, but aging (which is
allocation-based) showed the charges open again, so R5 and R6 disagreed. There is now **one definition**, in
**one SQL helper** (a Postgres view `finance_live_payments` plus a TypeScript `livePaymentWhere(asOf)`
that returns the same Prisma `where`); nothing in the codebase may re-spell it.

**Liveness is date-aware (review 3, H1).** Revision 3 defined "live payment" as a *current* state
(`chequeState <> BOUNCED`). A cheque received in October (closed) that bounced in November then dropped out of
every October figure the moment it bounced: October's statement closing balance, R5 "as of 31 Oct" and every
brought-forward line changed, while R6 (dated allocations) did not, so a closed month was rewritten. Every
predicate below therefore takes an **as-of date D**. "Today's balance" is simply D = today (Cairo, 2.1 point 6).

| Name | Definition, **as of date D** |
|---|---|
| **live payment** | `receivedAt <= D AND (status = 'POSTED' OR cairoDate(voidedAt) > D) AND (bouncedAt IS NULL OR bouncedAt > D)`. A `PENDING_CLEARANCE` cheque is live (provisional, 3.8); a cheque is live on every date before its `bouncedAt` and not live from that date on; a voided payment is live on every date before its void. |
| **live charge** | `accrualPeriod/dueDate <= D AND (status = 'POSTED' OR cairoDate(voidedAt) > D)`, i.e. a voided charge still counts for any D before its void |
| **live allocation** | `allocatedAt <= D AND (voidedAt IS NULL OR cairoDate(voidedAt) > D)` (the as-of rule in 2.4) |
| **live refund** | `Expense.refundFlatId IS NOT NULL AND approvedAt <= D AND (status = 'APPROVED' OR (status = 'VOID' AND approvedAt IS NOT NULL AND cairoDate(voidedAt) > D))` (for the **balance** and **`credit`**). **Pending refund** (for **`availableCredit`** only, 3.5): `refundFlatId IS NOT NULL AND status = 'PENDING_APPROVAL'`, a current-state figure used only to gate new refunds and credit applications, never evaluated as of a past date. APPROVED refunds are not in this term because `credit` already subtracts them (review 4, N-3) |

Void note: a void never edits the amount or date, and voiding a row dated in a CLOSED period is refused (3.2),
so a void can only affect dates in open periods. The dated predicates matter for (a) mid-month as-of dates, and
(b) **bounces**, the one state change that legitimately happens after the payment's own month is closed (3.8):
there, `bouncedAt` falls in the open period and the as-of predicates keep the closed month unchanged.

Formulas, all built from these predicates and nothing else (each is "as of D"):

- **Balance** (what the flat owes; negative = the flat is in credit) =
  `sum(live charges) − sum(live payments) + sum(live refunds, APPROVED)`.
  A refund paid out of the compound's cash puts money back into the flat's hands, so it must raise the balance
  back toward zero; otherwise, after refunding 1,200 the statement would still show −1,200 and
  `balance <> −credit`. The refund appears as its own statement line ("Refund paid, E-2026-000045").
- **Credit** (review 3, M1) = `sum(live payments) − sum(live allocations) − sum(live refunds, APPROVED)`.
  It has **no pending-refund (reservation) term**. In words: unallocated live money, less what has actually
  been paid back. This is the figure that satisfies the invariant and that statements, `/me/finance` and R5 show.
- **Available credit** (M1; one formula everywhere, review 4 N-3) = `credit − sum(PENDING_APPROVAL refunds for
  the flat)`. Never subtract APPROVED refunds here: `credit` already subtracts them, so doing it again would
  count them twice and fail valid refunds and `apply-credit` calls with `insufficientCredit`. From raw terms the
  same figure is `live payments − live allocations − (APPROVED + PENDING_APPROVAL) refunds`, each refund counted
  once. A pending refund is reserved but not yet paid. `availableCredit` is **only** a gate: it
  decides whether a new refund expense or an `apply-credit` call may proceed (3.5). It is never shown as the
  flat's credit and never enters the invariant. (Revision 3 had one "credit" that subtracted pending refunds,
  so the invariant failed while a refund was pending: `sum(open) − credit` came out as `balance + R`.)
- **Invariant, asserted by a test on every fixture (including one with a PENDING refund):** for any flat and
  any D, `balance = sum(open charge amounts) − credit`, where a charge's open amount is the allocation-based
  figure of 2.4; for a flat with no open charges this is `balance = −credit`. `availableCredit` is not part of
  it. This is what keeps statement, `/me/finance`, R5 and R6 equal for any date, past or present.
- **Statement, brought-forward line, R3, R5, R6, R8 and the collection rate** all read the same helper.
  Stock figures (a balance, an open amount, aging) use one D; flow reports over a range (R1 to R4, R7, R8)
  evaluate each row's liveness at its own event dates and book a reversal in the month it happens (6.1
  "Reversals in flow reports", review 4 N-1). Required tests (`finance_live_payments.spec`): (1) "post cheque, clear nothing, bounce it: balance
  and aging as of today are identical to the state before the cheque"; (2) **"close October, bounce an October
  cheque in November: October's R5 closing balance and R6 open amounts as of 31 October are byte-identical
  before and after the bounce; November's figures include the bounce"** (H1).
- **How a bounce shows on the statement (H1).** The payment line stays on its `receivedAt` date with its
  receipt number, tag "Bounced", and still credits the running balance on that date. A **separate debit line**
  "Cheque bounced, R-2026-000123" dated `bouncedAt` adds the amount back. A statement covering both dates nets
  to zero; a statement for the closed month alone is unchanged. (Revision 3 greyed the line and zeroed it,
  which rewrote the closed month.)
- **Phase 1 caveat:** the `Expense` table arrives in Phase 2 (2.3.1), so in Phase 1 the "refund" terms of the
  balance, credit and available-credit formulas are identically 0. Phase 1 ships the helper without them (a
  join on a table that does not exist yet is not possible) and the Phase 2 migration `..._finance_ledgers`
  replaces the view with `CREATE OR REPLACE VIEW` (M3, 2.3.1 row 3) while the code change adds the terms behind
  the same function name and the same tests.
- **The view's exposure (review 3, M3).** Views in `public` are reachable through the Supabase Data API and, by
  default, run with the owner's rights (bypassing RLS). The lockdown migration
  (`20261007000000_enable_rls_lockdown:33-40`) revokes grants on tables and sets default privileges for tables,
  not specifically for views. So `finance_live_payments` is created `WITH (security_invoker = true)` and followed
  by an explicit revoke from `anon` and `authenticated`, in both migrations that (re)create it.
  **The revoke is guarded (review 4, N-2).** On plain Postgres (local docker `postgres:16-alpine`, CI, the
  migrated test DB) the `anon` and `authenticated` roles do not exist, so a bare `REVOKE ... FROM anon,
  authenticated` fails with "role does not exist" and breaks `migrate dev/reset` and the migration test. Both
  migrations therefore mirror the pattern of `20261007000000_enable_rls_lockdown/migration.sql:17-43`, which
  computes `supabase_roles boolean := EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') AND EXISTS (SELECT 1
  FROM pg_roles WHERE rolname = 'authenticated');` in a `DECLARE` and revokes only `IF supabase_roles THEN`:

  ```sql
  CREATE OR REPLACE VIEW public.finance_live_payments WITH (security_invoker = true) AS ...;

  DO $$
  DECLARE
      supabase_roles boolean := EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
          AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated');
  BEGIN
      IF supabase_roles THEN
          REVOKE ALL ON public.finance_live_payments FROM anon, authenticated;
      END IF;
  END
  $$;
  ```

  A migration test (`finance-view-privileges.spec`, run against the migrated test DB) **always** asserts that
  `reloptions` contains `security_invoker=true`. It asserts that
  `has_table_privilege('anon', 'public.finance_live_payments', 'SELECT')` and the same for `authenticated` are
  false **only when both roles exist** (same `pg_roles` check; `has_table_privilege` errors on a missing role);
  otherwise it skips those two assertions with a logged reason. The view takes D as a column filter applied by
  the caller (`receivedAt <= $D AND (bouncedAt IS NULL OR bouncedAt > $D) ...`), so it exposes the dated columns
  rather than a precomputed "live now" flag.

### 2.2 Flat registry (new table, decided: yes)

`ResidentUnit` only exists when an account owns the flat (`apps/backend/prisma/schema.prisma`, unique
`[building, floor, flatNumber]`, `userId` required, `onDelete: Restrict`). Accounting must charge flats that
have **no account yet** (never registered, sold, owner left) and must keep history when the owner changes.
Decision-5 also says the deposit balance belongs to the flat, not the person.

So we add a **`Flat`** table: one row per physical flat, created once by a seed from the compound layout.

- Layout source of truth: `apps/web/src/config/compound.ts` (`BUILDINGS`, `PHASES`, `FLOOR_RANGE`, `FLAT_RANGE`).
  The 12 buildings are **A1 B1 C1 | A2 B2 C2 | D1 E1 F1 | C3 E2 F2** (phase 4 is C3/E2/F2 in the code, not
  D2-F2 as the brief assumed; the plan follows the code). Ground floor `G` exists only in phases 2 and 3.
  Flats 1 to 5 per floor.
- Expected count: phases 1 and 4 have 6 buildings x 11 floors x 5 flats = 330; phases 2 and 3 have
  6 buildings x 12 floors (G + 1-11) x 5 flats = 360. **Total 690 flats.** The seed script computes this from
  one shared definition and asserts the number; the owner confirms 690 before the import (open question).
- The backend does not know the layout today (`building` is a free string). The seed lives in the backend as
  a constant list generated once and checked in a unit test against the web config values, so the two cannot
  drift silently. If the layout changes, a SUPER_ADMIN adds a flat from an admin form (no migration).
- `Flat.label` = `formatUnitLabel` output (`A1-3-2`, `apps/backend/src/common/helper/utils/unit-label.ts`).
  Unique. The link to accounts is `ResidentUnit.flatId` and `FlatOwnership` (below), not a text join at read time.

**Link to ownership (revised after review).** Two facts in the current code break a plain
`ResidentUnit`-by-text join:

1. `ResidentUnit.building/floor/flatNumber` are **free text**: trimmed but case-sensitive and not validated
   against the layout (the lead DTO's own example is "Building A"; see
   `residents/dtos/request/resident-lead.create.dto.ts`). A resident stored as `a1`, `A1 ` or `Building A`
   would never match `Flat.label = A1-3-2`, so their statement would silently be empty.
2. A sale **hard-deletes** the row: `ResidentUnitsService.remove` runs `residentUnit.deleteMany`
   (`units/resident-units.service.ts`). Ownership history is lost, so "the seller keeps seeing their own
   history" and "the new owner sees only what they should" cannot be answered from `ResidentUnit` alone.

Therefore, in Phase 1:

- **Pre-migration diagnostic (read-only SQL, run on prod before the migration, output reviewed by the
  owner):** a new script `apps/backend/prisma/scripts/check-flat-keys.sql`, same style as
  `prisma/scripts/check-email-case.sql` (counts only, never prints names or emails; run with
  `psql "$DIRECT_DATABASE_URL" -f ...`). It reports, for each of `resident_units`, `resident_leads` (status
  PENDING or INVITED) and `listings` (status PENDING or APPROVED): total rows, rows whose
  `(upper(trim(building)), upper(trim(floor)), trim(flatNumber))` is **not** one of the 690 seeded keys
  (`unknown_rows`). For `resident_units` **only** it also reports groups of rows that collide after
  normalisation (`collision_groups`, `collision_rows`). **For `listings` it reports no `collision_groups`
  (review 3, H3):** many listings per flat is normal (REJECTED, WITHDRAWN, SOLD and EXPIRED rows stay as
  history), and only `listings_active_unit_key` limits active rows. The listings section instead reports
  `active_collision_groups` = groups of rows in status PENDING or APPROVED that collide **after normalisation**
  (the text index cannot see `a1` vs `A1`), informational only; a non-zero value is resolved by withdrawing the
  duplicate listing, never by the migration. Same rule for `resident_leads`: its section reports only
  `unknown_rows` and active collisions, informational (the live guard is `resident_leads_active_unit_key`).
  Expected result: zero `unknown_rows` everywhere and zero `resident_units` collisions. Any non-zero row is
  fixed by hand: a `resident_units` key through the new audited unit-key `PATCH` (M2, below; its key-edit part
  ships in a small preparatory release **before** the finance migration, so collisions can be fixed first, and
  an unknown key can also be fixed after the migration because it only leaves `flatId = NULL`), or, as the
  fallback, owner-run SQL reviewed against the diagnostic output and run before the migration; a lead by the
  lead-unit `PATCH` or by rejecting and re-submitting it. The seeded key list is
  generated from the same constant as the seed, so the diagnostic and the migration cannot disagree.
- **Normalisation step in the migration, with assertions (review 2, H3).** After seeding `Flat`, the migration's
  SQL sets `ResidentUnit.flatId` for every row whose normalised key matches, and **asserts instead of
  trusting the diagnostic**: a `DO $$ ... $$` block runs `RAISE EXCEPTION` (aborting the whole migration, so
  nothing is half-applied) if (a) the `flats` table does not contain exactly 690 rows after the seed, or (b) any
  normalised key maps to more than one `resident_units` row (equivalently, any `flat_id` would be assigned to
  two `resident_units` rows; review 3, L1: there are no co-owners, `resident_units` is unique per flat and no
  writer opens a second ownership row). Rows whose key does not match any flat keep `flatId = NULL` and are
  counted in a `RAISE NOTICE`; a NULL link means "no finance visibility yet", never a wrong flat. **These
  uniqueness assertions apply to `resident_units` only** (review 3, H3); the `listings` backfill has its own,
  weaker rule (below). If the
  migration aborts, recovery is `prisma migrate resolve --rolled-back <name>` after the data is fixed, the same
  runbook as the email-case migration.
- **Generate the finance migrations offline and hand-review every one (review 2, H3).** `prisma migrate dev`
  proposes a diff that **drops the hand-written partial unique indexes** `listings_active_unit_key`
  (`schema.prisma`, warning above `model Listing`, line 259) and `resident_leads_active_unit_key`
  (`schema.prisma`, line 189), because Prisma cannot model partial indexes. Any finance migration produced that
  way would carry those two `DROP INDEX` statements, and the unique-flat guards on live lead and listing
  submission would silently disappear. Therefore: (1) migrations are written with `prisma migrate diff
  --from-schema-datamodel ... --to-schema-datamodel ... --script` (offline, as for the listings migration) and
  then edited by hand; (2) the reviewer's checklist for **every** finance migration is "contains no `DROP INDEX`
  and no `DROP CONSTRAINT` for `listings_active_unit_key`, `resident_leads_active_unit_key`,
  `billing_runs_period_key` or the import and ownership partial indexes"; (3) a CI-able test
  (`migrations-keep-partial-indexes.spec`) greps the new migration folders for those index names inside a
  `DROP` statement and fails; (4) the new partial indexes of this plan get the same WARNING comment block in
  `schema.prisma` as the listings and lead indexes.
- **`ResidentUnit.flatId String?`** (new nullable FK to `Flat`, `onDelete: SetNull`, `@@index([flatId])`).
  This is the only change to `ResidentUnit`. The three text columns stay untouched for old mobile builds.
  Every code path that creates a `ResidentUnit` (`auth.service.ts:405` accept-invitation,
  `residents.service.ts:272` lead approval, `resident-units.service.ts:112` add flat) resolves the `Flat` through a
  shared `normaliseFlatKey()` helper and sets `flatId`.
- **Repairing a unit key, and late links (review 3, M2).** `ResidentUnitsService` has only `addToUser` and
  `removeFromUser` today, so "an admin edit of the unit" did not exist, remove plus re-add would give a real-date
  period instead of the 1900 sentinel, and a unit stored with `flatId = NULL` (allowed while `FLAT_KEY_STRICT` is
  off) would never get a `FlatOwnership` row even after correction. **Primary fix:** a new audited
  `PATCH /admin/resident-units/:id` (**SUPER_ADMIN only**, review 4 L-3: re-keying moves ownership, so it
  matches unit add and remove, which are SUPER_ADMIN-only in `user.admin.controller.ts:52-129`)
  `{ building, floor, flatNumber }`. In one transaction it
  normalises the key, refuses an unknown key (`unit.error.unknownFlat`) or a key already held by another
  `resident_units` row (`unit.error.alreadyOwned`), updates the three text columns, sets `flatId`, and writes an
  audit row (old and new key; existing `AuditService`, plus `FLAT_OWNERSHIP_CHANGED` through
  `FinanceAuditService` when a period is opened or moved). **"Link and open period" step:** whenever `flatId`
  goes from NULL to a value (this `PATCH`, or any later code path that resolves a previously unknown key), the
  same transaction opens a `FlatOwnership` period for the unit's user, with `fromDate = '1900-01-01'` (the
  cut-over sentinel) if the `ResidentUnit` row was created before finance go-live, else its `createdAt` Cairo
  date. **The period is opened only when the unit's user is not soft-deleted** (`deletedAt IS NULL`, review 4
  L-2); for a deleted user the step only sets `flatId`, and `restoreUser` opens the period on restore (path 6),
  so the invariant "open `FlatOwnership` ⇔ `ResidentUnit` exists ⇔ user not deleted" holds. When an already-linked unit is moved to a different flat (a typo between two real flats), the old
  period is closed with `closedReason = REMOVED` and `toDate = fromDate` (an empty period: the user never owned
  that flat, so they must see none of its lines; the audit row keeps the history), and the new period opens as
  above. A unit-test covers NULL to linked (sentinel), NULL to linked (post-go-live
  date) and linked to other flat. **Fallback:** owner-run SQL before the finance migration (the diagnostic's
  `unknown_rows` list, fixed by `UPDATE resident_units SET building/floor/flat_number` after a backup), used if
  the `PATCH` is not shipped in time; the migration's backfill then links and opens periods as usual.
- **Unknown-flat rejection is staged, so it cannot break the live lead flow (review 2, M6).** The existing
  leads were typed as free text (the lead DTO's own example is "Building A"), and approval
  (`residents.service.ts:272`) and invitation acceptance (`auth.service.ts:405`) read them later. Order of
  work: (1) the diagnostic above also covers `resident_leads` in PENDING/INVITED; (2) the lead DTO
  (`resident-lead.create.dto.ts`) starts validating new submissions against the layout **first**, so no new
  bad lead can enter; (3) an admin can correct a lead's unit before approving it (small `PATCH
  /admin/residents/leads/:id` edit of building/floor/flatNumber, audited with the existing `AuditService`),
  and every pre-existing bad lead is fixed that way; (4) only then does `normaliseFlatKey()` start throwing
  `unit.error.unknownFlat` at approval and acceptance. Until step 4 is switched on (a config flag
  `FLAT_KEY_STRICT`, flipped by the owner after the diagnostic is clean), an unknown key is stored with
  `flatId = NULL` and no ownership row **until a super admin corrects it** through the unit-key `PATCH` (L-3), whose
  "link and open period" step then opens the period (M2, below).
- **Listings use the same flat key, so they are linked too (review 2, H4; decision, see changelog).**
  `Listing` has its own free-text `building/floor/flatNumber` (`schema.prisma`, listings block), so a listing
  for `a1-3-2` would never join the finance flat `A1-3-2`. Decision: **link them.** `..._finance_foundations`
  adds a nullable `Listing.flatId` (FK `Flat`, `onDelete: SetNull`, `@@index([flatId])`) and backfills it
  with the same normalisation SQL. **The listings backfill asserts only that a key is known, never that it is
  unique (review 3, H3):** a flat legitimately has many listings over time (REJECTED, WITHDRAWN, SOLD and EXPIRED
  rows stay as history, and only `listings_active_unit_key` limits active rows, migration
  `20261031000000_flat_listings`), so a uniqueness `RAISE EXCEPTION` would abort the migration on the first
  relisted flat, and Render's `migrate deploy` would then fail every deploy. Listings whose key matches no flat
  keep `flatId = NULL` and are counted in a `RAISE NOTICE` (no exception); many rows may share one `flatId`.
  `ListingsService` create and update call
  the shared `normaliseFlatKey()` and set it (and validate against the 690-flat layout, as the lead DTO does).
  Why link instead of deferring: the `listings` table and migration `20261031000000_flat_listings` ship
  **before** finance, so by the time `..._finance_foundations` runs the table may hold real rows (hence the
  key-only assertion above), but a nullable column in a *later* migration still costs nothing and needs no rewrite; and
  Q16 (clearance before transfer) needs exactly this join to warn an admin when a SELL listing is approved
  for a flat with arrears. The link is **informational in v1**: it never blocks a listing, never changes who
  may list (that stays `ResidentUnit` ownership), and `listings_active_unit_key` keeps working on the text
  columns, unchanged. The finance migration must not touch that index (see the offline-migration rule above).
- **`FlatOwnership` table** (section 2.4) is the historical record: `(flatId, userId, fromDate, toDate)`.
  It is **written by every code path that changes who owns a flat**, in the same transaction (plus the M2
  "link and open period" step above):
  1. `auth.service.ts:405` (accept-invitation creates a `ResidentUnit`): open a period;
  2. `residents.service.ts:272` (lead approval creates a `ResidentUnit`): open a period;
  3. `resident-units.service.ts:112` (admin adds a flat): open a period;
  4. `resident-units.service.ts:171` (remove or sale, hard `deleteMany`): close it (`toDate = now`,
     `closedReason SOLD` or `REMOVED`). **Sale where the seller's account is deleted (review 3, H4):** account
     deletion keeps the `ResidentUnit` row (FK `Restrict`), and accept-invitation creates the buyer's
     `ResidentUnit` under the unique flat key, so it fails with 409 (`auth.service.ts:405`, unique violation)
     while the deleted seller still holds the row. The runbook for such a sale is therefore: **path 4 first**
     (an admin removes the deleted seller's unit; the period is already closed with `ACCOUNT_DELETED`, so path 4
     only deletes the row and writes the audit entry), **then** the buyer's lead approval and accept-invitation.
     The admin resident-requests screen shows "Flat still held by a deleted account: remove it first" when a
     lead targets such a flat;
  5. **`UserService.deleteUser` (`user.service.ts:176`, soft delete; review 2, H6):** in the same
     transaction as the `deletedAt` update, close every open `FlatOwnership` row of that user with
     `closedReason = ACCOUNT_DELETED`. Without this, a soft-deleted owner would keep an open period, `sendMany`
     would still target them (it filters `deletedAt`, but the flat would keep listing them as a current owner)
     and `/me/finance/flats` would present the flat as current. `deleteUser` is today a single `db.user.update`
     (no transaction); it becomes `$transaction([...])` so the close and the soft delete commit together;
  6. **restore** (`trash.service.ts:294` `restoreUser`, `USER_RESTORED`; review 3, H4): revision 3 re-opened
     nothing and told the admin to re-add the flat through path 3, but `addToUser` refuses with
     `unit.error.alreadyOwned` whenever **any** `ResidentUnit` holds the flat, this account included
     (`resident-units.service.ts:91-92`), and the deleted user's row is still there, so a restored owner could
     never regain finance visibility. Now: `restoreUser` becomes a `$transaction` that clears `deletedAt` and,
     for **every `ResidentUnit` the user still holds that has a `flatId`**, opens a new `FlatOwnership` row with
     `fromDate` = restore date (Cairo) and `openedById` = the restoring SUPER_ADMIN. The row's presence proves
     ownership: a sale meanwhile would have run path 4 and deleted it, so a restored account whose flat was sold
     regains nothing. The gap between deletion and restore stays outside every period (the user sees no lines
     from it; staff do). The audit row lists the reopened flats. **Test:** delete an owner (period closed
     `ACCOUNT_DELETED`), restore (a second period opens at the restore date, the first stays closed); and delete,
     path 4 removes the unit, restore (no period opens).
  **Ownership invariant (review 3, H4), asserted by a test over every fixture and checked by a read-only SQL
  in the go-live runbook:** for every user and flat, an **open `FlatOwnership` row exists ⇔ a `ResidentUnit`
  row with that `flatId` exists ⇔ the user is not deleted** (`deletedAt IS NULL`); read precisely, "open period
  ⇔ (unit exists AND user not deleted)", because a deleted user's unit row is kept. Paths 1 to 3 and the M2
  link step establish both sides; path 4 removes both; path 5 closes the period while the `ResidentUnit` stays
  (allowed only because the user is deleted), and path 6 reopens it. Units with `flatId = NULL`
  are outside the invariant (no finance visibility, 2.2 staging).
  `ResidentUnit` stays the "current owner" shortcut; finance visibility is decided by `FlatOwnership`, never by
  `ResidentUnit` alone. The `ResidentUnit` row itself is **not** deleted by account deletion (FK `Restrict`,
  unchanged behaviour); only the ownership period closes.
- **Backfill (revised, review 2, H6):** for every existing `ResidentUnit` with a `flatId`, create one open
  `FlatOwnership` row with **`fromDate = '1900-01-01'`**, meaning "owned since before finance go-live". It is
  **not** `ResidentUnit.createdAt`: for owners who existed before the app, that is the app-registration date,
  not the purchase date, and almost every opening-balance line is dated `as_of` **before** that registration
  date. With `createdAt` as `fromDate` the real current owner would not see their own opening charges and the
  brought-forward line would start after the debt it should explain. Periods opened after cut-over (paths 1 to 3,
  and the restore reopen of path 6) use the real transaction date; the M2 link step uses the sentinel only for a
  unit that predates go-live. The sentinel is documented in the schema comment and rendered in UIs as
  "since before the system started". If the owner supplies real purchase dates later, an admin-only
  `PATCH /finance/flats/:id/ownership/:ownershipId` may move `fromDate` **earlier** only (audited), never later.

**Who sees which lines (decided, Q3 / H5).** A user sees the flat's ledger lines whose accounting date falls
inside one of **their own ownership periods** (`fromDate <= date < toDate`, open period means "until now").
Nothing else, ever.

- The current owner sees lines from their `fromDate`, plus a single **"Balance brought forward"** line at that
  date (the flat's net balance at the moment they became owner, computed with the "live as of D" predicates of
  2.1.1 with D = the day before `fromDate`, so a later bounce or void never changes it; review 3, H1). A
  restored owner (path 6) gets one such line at the start of each of their periods.
  They are told they inherit it (decision 5) without seeing the previous owner's individual payments
  (privacy, section 9). **A new owner sees only their own ownership period's lines**; the previous owner's
  history is **staff-only**. (Q3's default in section 11 was corrected to say exactly this.)
- A former owner keeps seeing their own period's lines read-only after the sale (they may need proof of what
  they paid) and nothing after `toDate`.
- Staff always see the whole flat ledger.
- Whether a **clearance** (arrears settled) is required before a transfer is a policy question, Q16.

### 2.3 Enums

```
enum Role                 + ACCOUNTANT
enum ChargeKind           SERVICE_CHARGE | MAINTENANCE_DEPOSIT | SHORTFALL | SERVICE_FEE | OPENING_BALANCE | OTHER
enum PostingStatus        POSTED | VOID
enum FinancePaymentMethod CASH | BANK_TRANSFER | INSTAPAY | CHEQUE      (the existing PaymentMethod enum is orders-only)
enum ChequeState          NOT_APPLICABLE | PENDING_CLEARANCE | CLEARED | BOUNCED   (Payment.chequeState, 3.8)
enum ExpenseStatus        PENDING_APPROVAL | APPROVED | REJECTED | VOID
enum ImportBatchStatus    PREVIEW | COMMITTED | VOIDED | DISCARDED
enum PublishStatus        DRAFT | PUBLISHED | WITHDRAWN                 (superseded is derived, see PublishedReport in 2.4)
enum EntryDirection       IN | OUT                                      (fund movements)
enum FundEntryKind        DEPOSIT_IN | INVESTMENT_INCOME | MAINTENANCE_OUT | ADJUSTMENT | OPENING_BALANCE
enum FundHolding          CASH | INVESTED                               (FundEntry.holding, named so it is one type)
enum OwnershipClosedReason SOLD | REMOVED | ACCOUNT_DELETED            (FlatOwnership.closedReason)
enum PeriodStatus         OPEN | CLOSED
enum BillingRunKind       SERVICE_CHARGE | SHORTFALL | CUSTOM
enum BillingRunStatus     PREVIEW | COMMITTED | VOID
enum ReportKind           MONTHLY | QUARTERLY | ANNUAL | FUND | CUSTOM
enum NotificationType     + FINANCE_UPDATE                              (already has LISTING_UPDATE, schema.prisma:76)
```

### 2.3.1 The migration list (single source of truth; section 10 refers here)

PostgreSQL cannot use a newly added enum value in the transaction that added it, so **enum extensions are
their own migrations containing only `ALTER TYPE ... ADD VALUE IF NOT EXISTS`** (precedent:
`20261004000000_super_admin_role`). Nothing in the same migration, and nothing in a seed, default or backfill
run inside that transaction, may reference the new value. Names below are final; section 10 must not rename or
re-count them. Every migration is generated offline and hand-reviewed so it keeps the partial unique indexes
(2.2, "Generate the finance migrations offline").

| # | Phase | Migration name | Contains | Notes |
|---|---|---|---|---|
| 1 | 1 | `..._accountant_role` | `ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'ACCOUNTANT'` | enum only |
| 2 | 1 | `..._finance_foundations` | All Phase 1 tables (section 10 lists them), **plus `FundEntry` with `countsInFundTotal`, `holding`, and `OPENING_BALANCE` in `FundEntryKind`, plus `Payment.isOpening`** (H1: both are used by the Phase 1 opening import and `POST /finance/fund/opening-balance`), `Flat` seed (690, asserted), `FlatOwnership` + backfill, `ResidentUnit.flatId` (normalisation with `RAISE EXCEPTION` on count and on any `resident_units` collision) and `Listing.flatId` (normalisation, **known-key check only, `RAISE NOTICE` for unknown keys, never a uniqueness assertion**, review 3 H3), partial unique indexes, RLS on every table, **`CREATE VIEW finance_live_payments WITH (security_invoker = true)` + `REVOKE ALL ON public.finance_live_payments FROM anon, authenticated` inside a `DO $$` block guarded by the `pg_roles` check** (review 3, M3; review 4, N-2; 2.1.1) | no reference to `ACCOUNTANT` anywhere |
| 3 | 2 | `..._finance_ledgers` | `Vendor`, `Expense`, `Revenue`, `ServiceItem`, `ServiceSale`; **`ALTER TABLE fund_entries ADD COLUMN expense_id` + FK to `expenses`** and **`ALTER TABLE charges ADD COLUMN service_sale_id` + FK to `service_sales`** (both nullable, so adding them later is a metadata-only change; the Phase 1 tables cannot carry a FK to a table that does not exist yet); `requestKey`/`requestHash` on these tables; RLS; **`CREATE OR REPLACE VIEW finance_live_payments WITH (security_invoker = true)`** adding the refund terms (columns may only be appended, so the refund columns go last), followed again by the explicit `REVOKE ALL ... FROM anon, authenticated` in the same guarded `DO $$` block (M3, N-2) | no enum extension |
| 4 | 3 | `..._finance_update_notification_type` | `ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'FINANCE_UPDATE'` | enum only. Phase 3, because Phase 1 sends no finance notification (a staff reminder is Phase 3, 6.4) |
| 5 | 3 | `..._finance_reports` | `PublishedReport` (with `approvalRef`, `notifiedAt`), optional `flat_balance_cache` only if R6 is slow; RLS | **no notification-preference rows** |

Five migrations in total: two in Phase 1, one in Phase 2, two in Phase 3. **Notification-preference defaults for
`FINANCE_UPDATE` are never created by any migration** (an absent preference row means enabled; 6.4), so the
earlier "notification preference defaults" item is removed from Phase 3. Seeds that need the `ACCOUNTANT` role
(a first accountant account) are application code run after the migrations, never inside them.

### 2.4 Model sketches

All tables: `ENABLE ROW LEVEL SECURITY` in the migration (backend rule, see the listings migration
`20261031000000_flat_listings`). Ids are `cuid()`. Foreign keys to `User` are `onDelete: Restrict` (users are
soft-deleted, same as `ResidentUnit`). `createdAt` everywhere, `updatedAt` only on mutable config tables.

**Flat**

| Field | Type | Notes |
|---|---|---|
| id | String @id | |
| building, floor, flatNumber | String | `@@unique([building, floor, flatNumber])` |
| label | String @unique | `A1-3-2` |
| phase | String | derived at seed, filter and report grouping |
| isActive | Boolean @default(true) | hide a flat that is merged or never delivered |
| shareWeight | Decimal(8,4) @default(1) | reserved for area-based billing, v1 always 1 |

Indexes: `[phase]`, `[building]`.

**FlatOwnership** (who owned a flat, and when; decides what a resident may see)

| Field | Type | Notes |
|---|---|---|
| id | String @id | |
| flatId | FK Flat Restrict | |
| userId | FK User Restrict | |
| fromDate | Date | start of ownership. **`1900-01-01` for the cut-over backfill** ("owned since before finance go-live", 2.2); the real transaction date (Cairo, 2.1 point 6) for every period opened afterwards |
| toDate | Date? | null = current owner |
| closedReason | OwnershipClosedReason? | SOLD / REMOVED / ACCOUNT_DELETED |
| openedById, closedById | FK User? SetNull | |

Indexes: `[flatId, toDate]`, `[userId]`. Partial unique index
`flat_ownership_one_open (flatId) WHERE toDate IS NULL` (raw SQL, noted in the schema comment): **at most one
open period per flat** (review 3, L1: `resident_units` is unique per flat and no writer ever opens a second
ownership row, so there are no co-owners in v1). Written in the same transaction as **every** code path that
changes who owns a flat: the three `ResidentUnit` creators, the `ResidentUnit` removal, `UserService.deleteUser`,
the account restore and the M2 unit-key link step (2.2); never edited afterwards except to close it (or, admin
only, to move `fromDate` earlier, 2.2). The ownership invariant of 2.2 (open period ⇔ unit exists and user not
deleted) is asserted by a test.

`ResidentUnit` and `Listing` each gain one nullable column `flatId` (FK Flat, `SetNull`, indexed); see 2.2. These
are the only changes to existing tables besides the two enum extensions.

**FeeSchedule** (what a recurring fee is, e.g. "Monthly service charge 450 EGP")

| Field | Type | Notes |
|---|---|---|
| id, name, nameAr | | |
| kind | ChargeKind | SERVICE_CHARGE or SERVICE_FEE |
| amount | Decimal(12,2) | default per flat |
| frequency | enum MONTHLY / QUARTERLY / ANNUAL / ONE_OFF | |
| categoryId | FK FinanceCategory | revenue category it reports under |
| isActive | Boolean | |

**BillingRun** (a bulk charge batch; see section 4)

| Field | Type | Notes |
|---|---|---|
| id | String | |
| kind | BillingRunKind | |
| feeScheduleId | FK? | null for CUSTOM and SHORTFALL |
| period | String | `YYYY-MM` for monthly, `YYYY-Qn`, or `YYYY` |
| accrualPeriod | String | **`YYYY-MM` the run books into (review 2, M3).** Monthly: the period itself. Quarterly `YYYY-Qn`: the **first month of the quarter** (`2026-Q3` books to `2026-07`). Annual `YYYY`: the first month of the fiscal year (`fiscal.yearStartMonth`, January by default). Every charge of the run copies this value, so the "period must be OPEN" check, accrual reports and R8 are defined for all three frequencies. A CUSTOM run takes the month of its `dueDate` unless the accountant picks another open month |
| description, descriptionAr | String | shown on the flat statement line |
| amount | Decimal(12,2) | default per flat |
| dueDate | Date | |
| status | BillingRunStatus | |
| requestKey | String @unique | client-generated UUID sent on draft creation; a double click or retry returns the same draft |
| requestHash | String | sha256 of the canonical request body; a different body under the same `requestKey` is `idempotencyConflict` (3.3) |
| periodKey | String? | the "billed once" key: `SC:<feeScheduleId>:<period>` for SERVICE_CHARGE, `SF:<period>` for SHORTFALL, null for CUSTOM |
| params | Json | scope (phases/buildings), exclusions, overrides snapshot |
| createdById, committedById, committedAt | | |

**One billing per period** is enforced by a partial unique index
`billing_runs_period_key ON billing_runs (periodKey) WHERE status = 'COMMITTED' AND periodKey IS NOT NULL`
(raw SQL in the migration, noted in the schema comment like the listings index). The earlier
`@@unique([feeScheduleId, period])` idea is dropped: it never fires for SHORTFALL because `feeScheduleId`
is NULL. A second shortfall in the same period must be a CUSTOM run (deliberate, with its own description).

**Charge** (amount a flat owes)

| Field | Type | Notes |
|---|---|---|
| id | String | |
| flatId | FK Flat Restrict | |
| kind | ChargeKind | |
| amount | Decimal(12,2) CHECK > 0 | never negative; a flat's credit comes only from unallocated payments (3.5) |
| description, descriptionAr | String | |
| accrualPeriod | String | `YYYY-MM`; for a run charge it is copied from `BillingRun.accrualPeriod` (first month of a quarter or fiscal year for quarterly and annual runs) |
| dueDate | Date | drives overdue days |
| status | PostingStatus | |
| billingRunId | FK? | null for one-off manual charges |
| serviceSaleId | FK? | set when a paid service was billed to the flat. **Column and FK are added by the Phase 2 migration `..._finance_ledgers`** (2.3.1) because `ServiceSale` does not exist in Phase 1; nullable, so it is a metadata-only `ALTER` |
| fundContribution | Boolean | true when kind = MAINTENANCE_DEPOSIT, feeds fund balance when paid |
| voidedAt, voidedById, voidReason | | required together |
| createdById, createdAt | | |

Indexes: `[flatId, status]`, `[accrualPeriod]`, `[dueDate]`, `@@unique([billingRunId, flatId])`
(idempotency guard, one charge per flat per run).

**Payment** (money received from or on behalf of a flat)

| Field | Type | Notes |
|---|---|---|
| id | String | |
| receiptNo | String @unique | `R-2026-000123` (`O-` for opening rows), see 3.4 |
| flatId | FK Flat Restrict | |
| amount | Decimal(12,2) CHECK > 0 | |
| method | FinancePaymentMethod | |
| requestKey | String @unique | client-generated UUID (`Idempotency-Key` header value), stored on the row so idempotency survives a Redis flush or outage (3.3) |
| requestHash | String | sha256 of the canonical request body, compared on a repeated `requestKey` (3.3) |
| reference | String? | transfer ref, cheque no, InstaPay ref. **Not unique (review 3, L2):** a duplicate `(method, reference)` among live non-opening payments is a **soft warning** (`duplicateReference`, 409 with a `force: true` override, 7.2), never a unique index; rows with `isOpening = true` (about 690 opening rows all carry `(CASH, 'OPENING')`) are excluded from the check |
| chequeState | ChequeState @default(NOT_APPLICABLE) | cheques start PENDING_CLEARANCE, see 3.8. Whether a payment counts on a date is "live as of D (2.1.1)", the one dated predicate (it reads `receivedAt`, `voidedAt` and `bouncedAt`); `chequeState` is the current state for the UI, `bouncedAt` is what the as-of rule reads |
| clearedAt, bouncedAt | Date? | set when the cheque state changes; validated against period status (3.8), default today (Cairo). `bouncedAt` dates the separate "Cheque bounced" statement line (2.1.1) |
| receivedAt | Date | cash date, period-lock applies to this |
| payerName | String? | who handed it over (tenant, relative) |
| note | String? | |
| status | PostingStatus | |
| attachmentPath | String? | private bucket path, see section 5 |
| isOpening | Boolean @default(false) | true only for opening-balance imports (4.6); excluded from cash reports, and the allocations the import creates are excluded from income (a later `apply-credit` of opening credit is income, not cash, review 4 L-4). **In the Phase 1 migration** (2.3.1), because the Phase 1 opening import writes it |
| voidedAt, voidedById, voidReason | | |
| createdById, createdAt | | |

Indexes: `[flatId, status]`, `[flatId, chequeState]`, `[receivedAt]`, `[method, reference]` (a plain index for
the duplicate-reference warning, **not** unique, L2).

**PaymentAllocation** (which charges a payment settled; supports partial payments)

| Field | Type | Notes |
|---|---|---|
| id, paymentId FK, chargeId FK | | `@@unique([paymentId, chargeId])` |
| amount | Decimal(12,2) | > 0; sum of live rows per payment <= payment.amount; per charge <= charge.amount |
| allocatedAt | Date | accounting date of the allocation. Default `payment.receivedAt` when made with the payment; the day it was applied for `apply-credit`; `as_of` for opening rows. Period lock, aging as-of and the `DEPOSIT_IN` entry date all read this column |
| voidedAt, voidedById, voidReason | | rows are kept; a voided allocation counts as live for any as-of date before `voidedAt` |
| createdById, createdAt | | |

Unallocated remainder of a **live** payment (2.1.1) is the flat's **credit** (3.5). On void of a payment, its
allocations are voided with it (same `voidedAt`, rows kept). On a cheque bounce they are voided with
`voidedAt = bouncedAt` (3.8).

**As-of rule** (aging, historical statements): a charge's open amount on date D is
`amount - sum(allocations with allocatedAt <= D and (voidedAt is null or voidedAt > D))`. Charges themselves
count from their `accrualPeriod`/`dueDate`. This makes "arrears as of 30 September" reproducible after later
voids. **The same as-of treatment applies to payments and charges (review 3, H1):** a payment counts as of D
while `bouncedAt` and `voidedAt` are null or after D; a charge counts as of D while `voidedAt` is null or after
D (2.1.1). Balances (R5) and open amounts (R6) for any past date therefore read the same dated columns and agree.

**FinanceCategory**

| Field | Type | Notes |
|---|---|---|
| id, name, nameAr | | |
| type | enum REVENUE / EXPENSE | |
| isActive, sortOrder | | |
| isSystem | Boolean | seeded rows cannot be deleted, only hidden |

Seed expense categories: Security, Cleaning, Gardening, Elevators, Utilities (electricity, water), Repairs
and maintenance, Insurance, Admin and office, Resident refunds, Other. Seed revenue: Service charges, Parking, Gate cards and
access, Gym and facilities, Rent of common areas, Other income. Fund-related flows are NOT categories, they
are fund entries.

**Vendor**

| Field | Type | Notes |
|---|---|---|
| id, name, nameAr?, contactName, phone, email?, taxNo? | | free text, no validation beyond length |
| defaultCategoryId | FK? | prefill for expenses |
| contractRef, contractStart, contractEnd | | informational (recurring contracts) |
| isActive | Boolean | vendors are deactivated, never deleted |

**Expense** (compound pays out; covers service contracts, decision 3b)

| Field | Type | Notes |
|---|---|---|
| id, expenseNo | String | `E-2026-000045`, gap-free per year; the number is assigned **at creation, whatever the approval status**, so a rejected or pending expense also holds a number (a rejected number is never reused, like a voided receipt) |
| requestKey | String @unique | client idempotency key, as on Payment (3.3) |
| requestHash | String | sha256 of the canonical body (3.3) |
| categoryId | FK FinanceCategory | type EXPENSE |
| vendorId | FK Vendor? | required when the category is a contract category (flag on category, v1: optional) |
| amount | Decimal(12,2) CHECK > 0 | |
| paidFrom | enum OPERATING / MAINTENANCE_FUND | fund-paid expenses also create a `FundEntry` on approval |
| refundFlatId | FK Flat? Restrict | set only for credit refunds to a flat (3.5), admin only |
| description | String | |
| expenseDate | Date | period lock applies |
| invoiceRef | String? | vendor invoice number; duplicate warning per vendor |
| status | ExpenseStatus | PENDING_APPROVAL if `amount > threshold` **or** `paidFrom = MAINTENANCE_FUND` (every fund payout needs an admin, whatever the amount) **or** `refundFlatId` is set; otherwise APPROVED |
| splitWarning | Boolean @default(false) | set when another non-void expense with the same vendor and the same `expenseDate` exists and the combined total exceeds the threshold (anti-splitting, see below) |
| approvedById, approvedAt, rejectReason | | admin only |
| attachmentPath | String? | private bucket |
| voidedAt, voidedById, voidReason | | |
| createdById, createdAt | | |

Indexes: `[status]`, `[expenseDate]`, `[categoryId]`, `[vendorId]`, `[refundFlatId]`. A PENDING expense counts
in nothing (reports, fund balance) until approved; it shows in a "pending" tile.

**Threshold dodging (splitting one invoice into several small ones).** The threshold is per expense, so it can
be beaten by splitting. Mitigations, all cheap: (1) fund payouts and flat refunds always need approval (above);
(2) on create, if the same vendor already has a non-void expense on the same `expenseDate` and the sum would
exceed the threshold, the new row is created `PENDING_APPROVAL` regardless of its own amount, `splitWarning`
is set, and the approver sees "3 expenses to X today, total 14,500"; (3) `invoiceRef` duplicates per vendor are
warned; (4) the approvals inbox groups by vendor and day. Rule (2) is a guard, not a proof; the monthly
vendor-spend report (R7) is the backstop.

**Credit reservation.** A refund expense (`refundFlatId` set) reserves the flat's credit from the moment it is
created: **`availableCredit`** = `credit − sum(PENDING_APPROVAL refunds)` (2.1.1, 3.5; review 3, M1; review 4,
N-3). `credit` already subtracts APPROVED refunds, so each pending or approved refund is counted exactly once;
REJECTED and VOID refunds count nowhere. Creation locks the flat row (3.4) and fails with
`finance.error.insufficientCredit` if the refund exceeds `availableCredit`, so two pending refunds cannot pay
out the same credit twice. The displayed **`credit`** is not reduced by a pending refund.

**A refund lowers the balance too (review 2, H7).** The reservation affects `availableCredit` from creation, but
the flat's **balance** and **credit** (2.1.1) move only when the refund is `APPROVED`, because only then has the
compound committed the money. On approval the flat's balance rises by the refund amount toward zero (a flat at
−1,200 that is refunded 1,200 shows 0), credit drops by the same amount, and the statement gets a line "Refund
paid, E-2026-000045". Voiding an approved refund reverses the line. All three formulas live in the same helper
(2.1.1), so `balance = −credit` holds for a flat with no open charges before, during (refund pending) and after
a refund.

**Revenue** (compound earns; not flat dues)

| Field | Type | Notes |
|---|---|---|
| id, revenueNo | String | `V-2026-000012` |
| requestKey (@unique), requestHash | String | idempotency, as on Payment (3.3) |
| categoryId | FK (type REVENUE) | |
| amount, method, reference, receivedAt, payerName, note | | as Payment |
| flatId | FK Flat? | optional, links a resident sale to a flat |
| serviceSaleId | FK? | |
| status, void fields, createdBy | | |

**Rule that avoids double counting (revised, review 3, H2):** operating income from flats is the **live
allocation** of a payment to a **non-deposit** charge, recognised on the allocation's `allocatedAt` (the charge's
`FeeSchedule.categoryId` or kind decides the report line). It is **not** the payment itself: revision 3 said "a
flat Payment against a flat Charge is the revenue", which put money allocated to a `MAINTENANCE_DEPOSIT` charge
into R1/R2 income **and** into R4 as `DEPOSIT_IN`, mixing fund capital into the operating net (against owner
decision 5), and would have counted unallocated credit (a liability) as income. Now:
- allocation (other than one created by the opening import, last bullet) to SERVICE_CHARGE, SHORTFALL, SERVICE_FEE, OTHER or
  OPENING_BALANCE charges (old arrears collected after go-live): operating income (R1/R2), on `allocatedAt`;
- allocation to a MAINTENANCE_DEPOSIT charge: **fund capital only** (R4 `DEPOSIT_IN`), never R1/R2;
- unallocated remainder of a live payment: **"prepayments held"** (a liability line in R1 and R3), never income;
  it becomes income only when `apply-credit` allocates it, on that allocation's date;
- opening rows: an `isOpening = true` payment is never cash, and **only the allocations the opening import
  itself creates** (dated `as_of`, 4.6) are excluded from income. Opening credit left unallocated by the import
  is "prepayments held" like any other credit; a **later `apply-credit` of it against a non-deposit charge IS
  income** on that allocation's `allocatedAt` (not cash: the money arrived before go-live), and against a
  MAINTENANCE_DEPOSIT charge it is R4 fund capital as above (review 4, L-4).
A **Revenue** row is only for money that never went through a flat charge (e.g. sponsorship, rent of the
clubhouse to an outsider, a service paid in cash on the spot). A paid service billed to a flat is a Charge (kind
SERVICE_FEE) and appears as income when a payment is allocated to it.

**ServiceSale** (decision 3c: parking, gate cards, gym)

| Field | Type | Notes |
|---|---|---|
| id, flatId FK?, categoryId FK, description, quantity, unitPrice, total | | total = quantity x unitPrice, rounded half-up to 2 dp |
| billTo | enum CHARGE_TO_FLAT / PAID_NOW | CHARGE_TO_FLAT creates a Charge; PAID_NOW creates a Revenue |
| chargeId / revenueId | FK? | exactly one set |
| status, void fields, createdBy | | voiding a sale voids its linked row in the same transaction |

Optional catalogue `ServiceItem` (name, default price, category) saves retyping. Included, small.

**FundEntry** (the maintenance fund, decision 5)

| Field | Type | Notes |
|---|---|---|
| id, entryNo | String | `F-2026-000007` |
| requestKey (@unique), requestHash | String | idempotency for manual entries (investment income, adjustment, opening balance), as on Payment (3.3). Automatic rows (`DEPOSIT_IN`, `MAINTENANCE_OUT`) take `requestKey = '<paymentId or expenseId>:<allocationId or approval>'`, so a replayed transaction cannot create them twice |
| kind | FundEntryKind | DEPOSIT_IN, INVESTMENT_INCOME, MAINTENANCE_OUT, ADJUSTMENT, **OPENING_BALANCE** (all five are in the enum, 2.3) |
| holding | FundHolding @default(CASH) | CASH or INVESTED: where the money sits; used by OPENING_BALANCE (one cash row, one invested row) and the informational "of which invested" figure |
| countsInFundTotal | Boolean @default(true) | false only for the per-flat `DEPOSIT_IN` rows written by the opening import (they explain a flat's deposit progress without double-counting the fund, below) |
| direction | EntryDirection | derived from kind, stored for fast sums |
| amount | Decimal(12,2) CHECK > 0 | |
| entryDate | Date | period lock applies |
| paymentId | FK Payment? | set for DEPOSIT_IN rows created automatically (see below) |
| expenseId | FK Expense? | set for MAINTENANCE_OUT rows created on approval of a fund-paid expense. **Column and FK are added by the Phase 2 migration** (2.3.1): `Expense` does not exist in Phase 1, and nothing in Phase 1 writes this kind |
| investmentRef | String? | bond, certificate, bank name |
| description | String | required for INVESTMENT_INCOME and ADJUSTMENT |
| status, void fields, createdBy | | |

How the fund is fed (no double entry by hand):

| Event | Created automatically | Fund effect |
|---|---|---|
| Payment allocated to a MAINTENANCE_DEPOSIT charge | `FundEntry DEPOSIT_IN` for the allocated amount (linked by `paymentId`) | + |
| Accountant records investment return | `FundEntry INVESTMENT_INCOME` (manual) | + |
| Expense with `paidFrom = MAINTENANCE_FUND` approved | `FundEntry MAINTENANCE_OUT` | - |
| Shortfall run charges flats | nothing at billing time. When flats pay SHORTFALL charges, the money is operating cash (it replaces the missing returns), not fund capital | 0 |
| Correction | `ADJUSTMENT` (admin only, reason required) | +/- |

**Fund opening balance (review fix).** The compound did not start empty: before go-live it already collected
deposits, earned returns, and spent on maintenance, and part of the money is invested. Summing only
`DEPOSIT_IN` rows created after go-live (or from the per-flat import) would understate the fund. So the
fund gets its **own opening entries**: `FundEntry kind = OPENING_BALANCE` dated at the cut-over, one with
`holding = CASH` and one with `holding = INVESTED` (amounts from the bank statement and the investment
certificates, entered by an ADMIN, evidence attached, once, audited, voidable only by SUPER_ADMIN while the
first period is open). Per-flat `deposit_paid_to_date` rows from the opening import (4.6) feed the **per-flat
deposit progress** and are **not** added again to the fund total: they carry
`FundEntry.paymentId` with `countsInFundTotal = false` (Boolean @default(true) on FundEntry), so the fund
total is `OPENING_BALANCE + DEPOSIT_IN(counted) + INVESTMENT_INCOME + ADJUSTMENT - MAINTENANCE_OUT`. A
reconciliation line on the fund page shows "sum of per-flat deposits paid" next to "fund opening + deposits
since" and flags a difference; the accountant explains it, because past returns and spend legitimately make
them differ.

The **fund capital** (per-flat contributions) is the sum of DEPOSIT_IN including the imported ones.
**Returns** are INVESTMENT_INCOME. The statement shows capital, returns to date, maintenance spent from the
fund, and the balance. A "returns vs maintenance spend"
line per period gives the shortfall figure that drives the next SHORTFALL run (3.6 explains the suggestion).

**FiscalPeriod**

| Field | Type | Notes |
|---|---|---|
| period | String @id | `YYYY-MM` |
| status | PeriodStatus | |
| closedAt, closedById, reopenedAt, reopenedById, reopenReason | | |

A missing row means OPEN **for reads and reports**, but a **posting never relies on a missing row** (review 2,
H9): every posting transaction first runs `INSERT INTO fiscal_periods (period, status) VALUES ($p, 'OPEN') ON
CONFLICT (period) DO NOTHING`, then `SELECT status FROM fiscal_periods WHERE period = $p FOR SHARE`, and
refuses with `periodClosed` when the status is CLOSED. **Close** takes the same row with `FOR UPDATE`, so a
close waits for in-flight postings and any posting that starts after the close sees CLOSED. The lock order and
the concurrency test are in 3.4 and 3.2.

**FinanceSetting** (key/value, audited)

| Key | Value | Notes |
|---|---|---|
| `expense.approvalThreshold` | Decimal | 0 means "approve everything", null means "never require" |
| `fiscal.yearStartMonth` | 1-12 | default 1 |
| `billing.defaultDueDay` | 1-28 | default 10 |

(Review 2, L4: the `receipt.prefix` key was dropped. Scopes are the fixed letters R / O / E / V / F, 3.4, and
a configurable prefix would break the `ReceiptCounter` scope and the guarantee that numbers can be quoted.
Q15 only decides whether opening payments use `O-`, not a configurable letter. The Settings screen therefore
has no "receipt prefix" field.)

Writes are ADMIN only and each change is an AuditLog row with old and new value.

**ReceiptCounter**

| Field | Type | Notes |
|---|---|---|
| scope, year | String, Int | `@@id([scope, year])`, scope in R / O / E / V / F |
| last | Int | incremented inside the posting transaction, see 3.4 |

**PublishedReport** (resident-facing snapshot, section 6)

| Field | Type | Notes |
|---|---|---|
| id, title, titleAr | | |
| kind | ReportKind | |
| periodFrom, periodTo | Date | |
| snapshot | Json | frozen numbers, never recalculated |
| note, noteAr | String? | accountant commentary |
| status | PublishStatus (DRAFT / PUBLISHED / WITHDRAWN) | DRAFT holds a preview snapshot; PUBLISHED freezes it. There is **no SUPERSEDED value**: "superseded" is **derived** (a row is superseded when another row with `supersedesId = this.id` exists and is `PUBLISHED`), so republishing never has to update the old row, which stays frozen. The resident list DTO exposes the derived boolean `superseded` (7.7) |
| approvalRef | String? | optional "approved by" note given on publish (free text such as "General assembly 2026-11-05, minute 4", 6.4, Q19) |
| notifiedAt | DateTime? | set by the post-commit notification job (6.4); null means the fan-out is still pending or must resume |
| version | Int | republish creates a new row, old row stays |
| supersedesId | FK self? | |
| publishedAt, publishedById | | |
| withdrawnAt, withdrawnById, withdrawReason | | withdraw hides from residents, row kept |

**ImportBatch** and **ImportRow** (opening balances, section 4.6):

| Table | Fields |
|---|---|
| ImportBatch | id, `fileHash` (sha256), `status ImportBatchStatus` (PREVIEW / COMMITTED / VOIDED / DISCARDED), counts, `asOf`, createdBy, committedBy, committedAt, voidedAt, voidedById, voidReason |
| ImportRow | id, batchId FK, line number, raw line, parsed values, `flatId?`, `errors Json`, `action` (CREATE / SKIP), `committed Boolean @default(false)` |

Guards: `@@unique([fileHash])` where batch status = COMMITTED (partial index); and **`ImportRow (flatId)
UNIQUE WHERE committed = true`** (partial index) so a flat can be imported only once whatever its values are.
This replaces the earlier `charges (flatId) WHERE kind = 'OPENING_BALANCE'` guard, which did not cover a flat
with zero arrears whose deposit or credit would otherwise be importable twice. Voiding a batch (4.6) sets
`committed = false` on its rows, which frees those flats for a corrected re-import.

### 2.5 Entity overview

```
Flat 1──* Charge *──1 BillingRun *──1 FeeSchedule
  │          │
  │          └─* PaymentAllocation *──1 Payment *──1 Flat
  │                                       │
  │                                       └──? FundEntry (DEPOSIT_IN)
  ├──* ServiceSale ──> Charge | Revenue
  ├──* FlatOwnership *──1 User          (who owned the flat, and when; decides what a resident sees)
  ├──* ResidentUnit (flatId, nullable FK; set through normaliseFlatKey()) *──1 User
  └──* Listing (flatId, nullable FK, informational in v1)

Expense *──1 FinanceCategory, *──? Vendor, ──? FundEntry (MAINTENANCE_OUT)
Revenue *──1 FinanceCategory          FiscalPeriod   FinanceSetting   ReceiptCounter
PublishedReport (snapshot JSON)       ImportBatch 1──* ImportRow
```

### 2.6 Delete behaviour summary

| Relation | Behaviour |
|---|---|
| Any FK to `User` (createdBy, voidedBy, approvedBy) | `Restrict` |
| `Charge.flatId`, `Payment.flatId` | `Restrict`; flats are deactivated, never deleted |
| `FlatOwnership.flatId` / `userId` | `Restrict`; the period is closed (never deleted) when the owner is removed, sells, or the account is soft-deleted (2.2) |
| `ResidentUnit.flatId`, `Listing.flatId` | `SetNull`; the text columns remain the fallback |
| `PaymentAllocation` to `Payment` / `Charge` | `Restrict` |
| `Charge.billingRunId` | `Restrict` (void the run instead) |
| `Expense.vendorId`, `categoryId` | `Restrict`; deactivate instead |
| No `Cascade` anywhere in the finance tables | Nothing disappears silently |
| Flat soft deactivation | blocked while the flat has non-zero balance |

Recycle bin (`src/modules/trash`) does **not** cover finance rows; void is the only undo.

---

## 3. Correctness rules

### 3.1 Immutability, void and reversal

- Posted rows are never updated except these columns: `status`, `void*`, `note`, `attachmentPath`,
  `reference` (typo fix, audited), and approval fields on expenses.
- **Void** requires a reason (min 5 chars). It sets `status = VOID`, `voidedAt/By/Reason`, writes the audit
  row (3.7) with before-and-after totals **in the same transaction**, and cascades in one transaction:
  - void Payment: its allocations and any `DEPOSIT_IN` fund entries are voided; the charges it settled become
    open again.
  - void Charge: only if it has no live allocations. Otherwise void the payment first, or the system offers
    "void charge and move payment to credit" in one step (allocation voided, payment stays, remainder becomes credit).
  - void BillingRun (**one rule, no partial voids**): refused with `finance.error.hasPaidCharges` if **any**
    of its charges has a live allocation; the response lists those flats, and the accountant voids the
    affected payments first (or moves them to credit). When none is paid, **all** its charges are voided
    together with the run. A run is therefore never half-voided.
  - void Expense: voids its `MAINTENANCE_OUT` fund entry.
- A corrected posting is a **new row** carrying a nullable self-FK `replacesId` (on Charge, Payment, Expense,
  Revenue) that points at the voided original. The UI "Edit" button on a posted row is really
  "Void and re-enter" with fields prefilled.
- Voided rows stay in lists (greyed, filterable) and in exports with a Status column.

### 3.2 Period close and lock

- A period is a calendar month. Closing is ADMIN. Reopening is SUPER_ADMIN only, with a reason, audited.
- In a CLOSED period nothing can be **posted or voided** if its accounting date falls inside:
  `Charge.accrualPeriod`, `Payment.receivedAt`, `PaymentAllocation.allocatedAt`, `Expense.expenseDate`,
  `Revenue.receivedAt`, `FundEntry.entryDate`. Error `finance.error.periodClosed`. Because allocations carry
  their own `allocatedAt`, applying credit today to an old charge is dated today (an open period) and never
  rewrites a closed month.
- A **void** is itself an accounting event: voiding a row dated in a closed period is refused; the correction
  is posted in the open period (next bullet). The void's own timestamp (`voidedAt`, and for a cheque its
  `bouncedAt`) is what the as-of rule in 2.4 and the dated "live as of D" predicates in 2.1.1 use (review 3, H1),
  so a closed month's reports computed "as of that month end" (balances, statements, R5 and R6 alike) do not
  change when a later void or bounce happens.
- Fixing a mistake from a closed period is done by posting a correcting entry **in the current open period**
  (ADJUSTMENT type for fund, or a charge/payment in the open month) with a note pointing at the original. This
  keeps closed numbers, and published reports, stable.
- Close preconditions: no PENDING_APPROVAL expenses dated in the period; warning (not blocker) if a
  billing run for the period is missing.
- Publishing a report for a period requires that period to be CLOSED.
- **Closing cannot race a posting (review 2, H9). Mechanism: a transaction plus a row lock on the
  `fiscal_periods` row, not a compare-and-set.** The first draft made period rows lazy ("missing row =
  OPEN"), so a posting had no row to lock: a payment transaction could read OPEN, an admin could close the
  month, and the payment would then commit into the closed period and a published report would disagree with
  the ledger. Fix, in one place (2.4 FiscalPeriod, 3.4 step 0):
  1. **Every posting transaction** (charge, payment, allocation, expense approval, revenue, fund entry, void,
     cheque state change, billing-run commit, import commit) starts with the idempotent upsert of the row for
     each period it touches, then `SELECT ... FROM fiscal_periods WHERE period = $p FOR SHARE`, and checks
     `status`. `FOR SHARE` lets any number of postings run in parallel but blocks the closer.
  2. **Close** is one transaction: `SELECT ... FOR UPDATE` on the row (waits for every in-flight posting to
     commit or roll back), re-checks the preconditions (pending expenses, pending cheques acknowledged),
     sets `CLOSED`, and writes `PERIOD_CLOSED`. A posting that began after the lock waits, then sees CLOSED and
     fails with `periodClosed`.
  3. A posting that touches **two periods** (a payment in March allocated to a charge accrued in January: the
     lock applies to the allocation date and the payment date, not to the old charge's accrual month, which
     is not re-dated) locks both rows **in ascending period order**.
  4. **Concurrency test (required):** two transactions in parallel, `closePeriod('2026-10')` against
     `recordPayment(receivedAt in 2026-10)`; the outcomes allowed are "payment committed, then close
     succeeds" or "close committed, then payment fails `periodClosed`"; the forbidden outcome "payment
     committed after the close" fails the test. Run with a barrier so both orders are exercised.

### 3.3 Payment allocation

Default: **oldest due first** across the flat's open charges, with these refinements.

| Rule | Detail |
|---|---|
| Auto allocation | Walk open charges ordered by `dueDate, createdAt`; apply until the payment is used up. |
| Explicit allocation | The accountant may tick specific charges and amounts (e.g. "this 3000 is for the deposit installment, not service charge"). Required to pay a deposit ahead of older service charges. |
| Deposit protection | Charges of kind MAINTENANCE_DEPOSIT are skipped by auto allocation unless the accountant ticks them or the payment form's "Pay for" selector is set to Deposit. Avoids deposit money silently covering service arrears and vice versa. |
| Partial | A charge can receive several allocations; `open = amount - sum(live allocations)`. |
| Overpayment | Unallocated remainder is kept as **credit** (3.5); never rejected, never auto-spent on charges that do not exist yet. |
| Concurrency | Allocation runs in one transaction that first locks the **flat row** (`SELECT ... FROM flats WHERE id = $1 FOR UPDATE` through `$queryRaw`), then reads its charges. One lock per flat serialises payments, credit applications and refund reservations for that flat, and the order is fixed (3.4). |
| Idempotency | `POST /finance/payments` requires an `Idempotency-Key` header whose value is stored in the **`Payment.requestKey` unique column**, not only in Redis. A retry after a dropped response finds the row and returns the original receipt; a Redis flush or outage cannot cause a double posting. (Redis may still cache the response for 24 h as a speed-up, never as the guard.) A different body under the same key returns `finance.error.idempotencyConflict`. The same pattern applies to billing runs, expenses, revenues and fund entries, and **every one of those tables now has the columns it needs** (review 2, M1): `requestKey String @unique` and `requestHash String` (sha256 of the canonical request body) on `Payment`, `BillingRun`, `Expense`, `Revenue` and `FundEntry` (2.4). Lookup order: (1) find by `requestKey`; if found, compare `requestHash`, return the original row when equal, `idempotencyConflict` when different. (2) If not found, run the posting transaction. (3) **Concurrent same-key race:** two requests can both miss the find; the second insert fails with Prisma `P2002` on `requestKey`. The service catches exactly that, **rolls back, re-reads by `requestKey`** and applies step (1). The loser therefore returns the winner's row (or `idempotencyConflict`), never a 500 and never a second posting. A test fires two identical requests in parallel and asserts one row and two identical responses. The shortfall suggestion (10, Phase 2) uses the same `BillingRun.requestKey`. |
| Allocation date | Every allocation gets `allocatedAt` (2.4): the payment's `receivedAt` when made with the payment, today when applied later. Aging, historical statements, the `DEPOSIT_IN` entry date and the period-lock check all use it. |

### 3.4 Receipt numbering (gap-free per year, concurrent-safe)

- Format `<scope>-<year>-<6 digits>`: `R-2026-000123` (payments), `O-` (opening-balance payments), `E-`
  (expenses), `V-` (revenues), `F-` (fund). Payments and expenses need numbers a person can quote; the others
  are for traceability.
- **Lock order (deadlock rule), always the same everywhere (revised, review 2, H9):**
  (0) the **`fiscal_periods` row(s)** `FOR SHARE` after the idempotent upsert (3.2), in ascending period order;
  (1) the **flat row** `FOR UPDATE` (skipped for postings that name no flat);
  (2) read/lock the charges;
  (3) the **receipt counter last**;
  (4) insert.
  Period close takes the period row `FOR UPDATE` first and then nothing else, so it cannot deadlock with a
  posting. The counter is the hottest lock, so it is held for the shortest time and never while waiting for
  another lock. A posting that touches two flats (a split payment is not supported) must lock them in `id` order.
- Allocation: inside the same DB transaction that inserts the row, run
  `INSERT INTO receipt_counters (scope, year, last) VALUES (...,1) ON CONFLICT (scope, year) DO UPDATE SET last = receipt_counters.last + 1 RETURNING last`.
  The row lock held until commit serialises concurrent posts, and a rolled-back transaction rolls the counter
  back, so numbers have **no gaps**. Cost: posting is serialised per scope. Acceptable at this volume
  (hundreds of payments a month, not thousands per second).
- **Bulk reservation (review 3, M4).** A posting that needs `n` numbers of one scope (the opening import needs
  one `O-` number per opening payment, up to about 1000) reserves the whole range with **one** statement,
  `INSERT INTO receipt_counters (scope, year, last) VALUES ($s, $y, $n) ON CONFLICT (scope, year) DO UPDATE SET
  last = receipt_counters.last + $n RETURNING last`, and numbers the rows `last − n + 1 … last` in memory. Same
  lock, same rollback-with-the-transaction guarantee, so the range is still gap-free; it replaces `n` round
  trips over the Supabase pooler. If the batch spans two counter years (rare: `as_of` is one date per file) it
  takes one reservation per year.
- The year in the number is the **calendar year of the accounting date** (`receivedAt` for payments,
  `expenseDate` for expenses), taken **in Cairo time** (2.1 point 6), not of the click time and not of the
  server's UTC clock, so a payment dated 31 Dec entered on 2 Jan still takes the old year, and a payment
  keyed at 00:30 Cairo time on 1 Jan (22:30 UTC on 31 Dec) takes the new one. If the owner sets a fiscal year that does not start in January (Q2), the number uses the **fiscal
  year label** instead (`FY2026-27` becomes `R-2627-000123`), computed by one function
  `fiscalYearOf(date, startMonth)`; the counter key is that label. Changing `fiscal.yearStartMonth` after the
  first posting is blocked (it would split a sequence), so Q2 must be answered before go-live. Voided numbers are never reused; the voided receipt stays visible with its
  number and the replacement gets the next one. That is how paper receipt books behave, and auditors expect it.
- Postgres `SEQUENCE` is rejected: it is not rolled back, so a failed transaction leaves a gap.

### 3.5 Rounding, credit and refunds

- All inputs are validated to at most 2 decimals; extra precision is rejected (`finance.error.amountPrecision`),
  not rounded, so an accountant never types one number and stores another.
- Computed amounts (quantity x unit price, `shareWeight` billing in v2, pro-rata) round **half up to 2 dp**
  once per line, never per intermediate step. Totals are sums of rounded lines. The report total always equals
  the sum of the rows displayed.
- Amount limits: `0.01 <= amount <= 9,999,999.99`; stricter per-type caps are configurable later.
- **Two credit figures (review 3, M1), both from the one shared "live as of D" definition of 2.1.1** (a
  bounced cheque is not live from its `bouncedAt` on):
  - **`credit`** = sum(live payments) − sum(live allocations) − sum(APPROVED refund expenses for the flat). No
    pending-refund term. This is what statements, `/me/finance`, R5 and the flat list show, and it satisfies
    the invariant `balance = sum(open charges) − credit` (2.1.1). An approved refund lowers it and raises the
    balance by the same amount (H7).
  - **`availableCredit`** = `credit` − sum(PENDING_APPROVAL refund expenses for the flat). APPROVED refunds
    are not subtracted again: `credit` already contains them (review 4, N-3). It is the **gate** for a new refund expense and for `apply-credit`: both
    fail with `finance.error.insufficientCredit` when the amount exceeds it, under the flat lock. It is shown
    on staff screens next to `credit` only when they differ ("Credit 1,200, of which 500 reserved for a
    pending refund").
  New charges do not consume credit
  automatically; the flat page shows "Credit 1,200: apply to open charges" which creates allocations
  (a `POST /finance/flats/:id/apply-credit`, capped at `availableCredit`). Auto-apply on billing is a toggle,
  default OFF, because surprises in a ledger are expensive.
- Paying credit out (a flat is owed money) is an admin-only expense in the seeded category "Resident
  refunds" with `Expense.refundFlatId` set. A refund **reserves** `availableCredit` from the moment it is
  created (status PENDING_APPROVAL counts, REJECTED and VOID do not), under the flat lock, so two pending
  refunds cannot both pay out the same credit (2.4). Maintenance deposits are never refunded.

### 3.6 Role matrix

`ADMIN` routes are satisfied by `SUPER_ADMIN` (existing `roleSatisfies`,
`apps/backend/src/common/auth/utils/roles.ts`). ACCOUNTANT is a new role and does **not** satisfy ADMIN;
finance routes list `[ACCOUNTANT, ADMIN]` explicitly.

| Action | ACCOUNTANT | ADMIN | SUPER_ADMIN | RESIDENT |
|---|---|---|---|---|
| View all flats, ledgers, arrears | yes | yes | yes | own flats only |
| Create charge, billing run (commit) | yes | yes | yes | no |
| Record payment / revenue / fund entry | yes | yes | yes | no |
| Create expense | yes | yes | yes | no |
| Approve or reject expense above threshold | no | yes | yes | no |
| Change approval threshold, categories, fee schedules | no | yes | yes | no |
| Void payment/charge/revenue | own entries, **same calendar day**, period still open | any, period still open | any, period still open | no |
| Void expense, fund entry, billing run | no | yes | yes | no |
| Fund ADJUSTMENT, fund OPENING_BALANCE | no | yes | yes (voiding the opening balance: SUPER_ADMIN only) | no |
| Change cheque state (cleared / bounced) | yes | yes | yes | no |
| Import opening balances | preview yes, commit yes | yes | yes | no |
| Close period | no | yes | yes | no |
| Reopen period | no | no | yes | no |
| Publish / withdraw summary | no (can draft) | yes | yes | no |
| Export CSV | yes | yes | yes | own statement only |
| Change roles, invite users, any non-finance admin area | no | yes | yes | no |
| View AuditLog | finance actions only | yes | yes | no |

"Void by accountant" is deliberately narrow and has **one** rule (the earlier text said both "same open
period" and "same day"): an accountant may void **only their own entry, on the same calendar day it was
created (a Cairo calendar day, 2.1 point 6, so an entry made at 23:30 Cairo time can still be voided until
midnight Cairo time, whatever the server's UTC clock says), while its period is open**. Anything older goes to an admin. Open question Q4 asks whether to loosen it.

**Four-eyes on money in:** none in v1. Documented trade-off: payments are already traceable by receipt number,
creator and attachment, and a second approver on every cash receipt would stall the desk. The monthly
reconciliation report (cash received per method per accountant) is the control.

### 3.7 Audit (revised after review)

**Why the existing writer cannot be used.** `AuditService.record()` (`apps/backend/src/modules/audit/audit.service.ts`)
(a) returns early unless the actor `isAdminRole`, so every ACCOUNTANT action would be **silently unaudited**,
and (b) runs after the change and swallows its own errors, so a failed audit write leaves a posted but
unaudited row. Both are right for the admin activity feed and wrong for money.

**Decision: a separate finance audit writer.** A new `FinanceAuditService.record(tx, actor, action, entity,
entityId, meta)`:

- takes the Prisma transaction client `tx` and writes `tx.auditLog.create(...)` **inside the same
  transaction** as the posting; if the audit insert fails, the whole posting rolls back (a money change with no
  audit row must not exist);
- records **every** role that reaches finance (ACCOUNTANT, ADMIN, SUPER_ADMIN), with no role filter;
- does not catch errors; the error propagates and the request fails with a 500 the client can retry
  (idempotency keys make the retry safe);
- reuses the existing `audit_logs` table and `AUDIT_ACTIONS` contract (additive actions only).
- The existing `AuditService` is not modified.
- **Finance rows stay out of the default admin feed (review 2, M8).** A few hundred `PAYMENT_RECORDED` rows a
  month would bury the governance and admin events that `GET /admin/activity` exists for
  (`audit.service.ts` `listActivity`, which today filters only by `actorId`). So `listActivity` gets one
  additive change: it excludes the finance action names (one shared constant `FINANCE_AUDIT_ACTIONS`) unless
  the query sets `scope=finance` or `scope=all`; the default stays "admin and governance events", which is
  what the web and mobile feeds already expect. The full finance trail is `GET /finance/audit` (7.5), which
  filters on that same constant. An existing client that renders unknown actions generically is unaffected.

Audit action names (additive, safe per the audit-actions contract; clients render unknown actions
generically): `PAYMENT_RECORDED`, `PAYMENT_VOIDED`, `CHEQUE_STATE_CHANGED`, `CHARGE_CREATED`, `CHARGE_VOIDED`,
`BILLING_RUN_COMMITTED`, `BILLING_RUN_VOIDED`, `EXPENSE_CREATED`, `EXPENSE_APPROVED`, `EXPENSE_REJECTED`,
`EXPENSE_VOIDED`, `REVENUE_RECORDED`, `REVENUE_VOIDED`, `FUND_ENTRY_RECORDED`, `FUND_ENTRY_VOIDED`,
`FUND_ADJUSTED`, `PERIOD_CLOSED`, `PERIOD_REOPENED`, `FINANCE_SETTING_CHANGED`, `OPENING_BALANCES_IMPORTED`,
`OPENING_BALANCES_VOIDED`, `REPORT_PUBLISHED`, `REPORT_WITHDRAWN`, `FINANCE_EXPORT`, `ATTACHMENT_VIEWED`,
`FLAT_OWNERSHIP_CHANGED`.

Two exceptions to the in-transaction rule, by design: `FINANCE_EXPORT` and `ATTACHMENT_VIEWED` are reads, so
they are written **before** the data or signed URL is returned and the request fails if the write fails
(no unaudited export or attachment view).

`meta` holds ids, flat label, amount, old/new values and the void reason; never national ids or phone numbers.
Exports are audited because they move PII-adjacent data (who owes what) off the system. Test: a unit test
asserts that an ACCOUNTANT payment creates exactly one audit row, and that a forced audit failure rolls the
payment back.

### 3.8 Cheques (added after review)

Cash, transfers and InstaPay are final when recorded. A **cheque is not**: it can bounce days later.

- A cheque payment is created with `chequeState = PENDING_CLEARANCE`. It is **posted** and gets a receipt
  number (the resident gave the cheque). It is a **live payment** (live as of D (2.1.1) until its `bouncedAt`), so it counts in the flat's balance as **provisional**: statements show it with a "pending
  clearance" tag, aging treats the covered charges as paid, and the cash position report (R3) lists pending
  cheques on a separate line, not in "cash received".
- `POST /finance/payments/:id/cheque-cleared` sets `CLEARED` and `clearedAt` (the cash date for R3).
- `POST /finance/payments/:id/cheque-bounced` sets `BOUNCED` and `bouncedAt`. **A bounced payment is not live
  as of any D on or after `bouncedAt`, and stays live for every earlier D (2.1.1; review 3, H1)**, so from the
  bounce date it drops out of the balance, credit, statement running balance, R3, R5 and R6, from one helper,
  while every figure dated before `bouncedAt` is unchanged. The service, in one transaction, also voids the
  payment's live allocations and `DEPOSIT_IN` fund entries **with `voidedAt = bouncedAt` in the open period**,
  so the charges become open again from the bounce date (the as-of rule of 2.4 then gives the same figure as
  the balance for every D). The payment row keeps its receipt number, its `receivedAt` line and the tag
  "Bounced"; the statement adds a **separate debit line "Cheque bounced, R-…" dated `bouncedAt`** (2.1.1).
  `status` stays `POSTED` because a bounce is a state, not a void-with-reason by the accountant. (Review 2, C1:
  the first draft left a bounced cheque inside the balance formula while aging showed the charges open.
  Review 3, H1: revision 3 then removed it from *every* date, which rewrote closed months.)
- **Dates are validated (review 2, M4).** `cheque-cleared` and `cheque-bounced` accept an optional `{ date }`,
  default **today in Cairo**. The date must not be in the future, and the service checks the period of that
  date like any other posting (3.2): a `date` that falls in a CLOSED period is refused with `periodClosed`
  (the client asked for it explicitly; the default always lands in the open period). The "bounce after the
  period was closed" paragraph below describes the default path.
- **A bounce after the period was closed** does not touch the closed month: the reversal effect (payment no
  longer live, allocations voided, fund entry reversed, the "Cheque bounced" debit line) is dated `bouncedAt`,
  which falls in the open period, and because liveness is evaluated as of each date (2.1.1) the closed month's
  balances, statement closing figure, brought-forward lines, R5 and R6 stay exactly as published. The audit
  row links both dates. This is the same "correct in the open period" rule as 3.2, and the required test
  "close October, bounce in November, October R5/R6 unchanged" (2.1.1) pins it.
- A cheque still `PENDING_CLEARANCE` blocks closing its period unless an admin acknowledges it on the close
  checklist (it appears as a warning, not a hard blocker).
- BOUNCED cheques are not live payments from `bouncedAt` on (2.1.1), so they are excluded from balance and
  credit (3.5) for every date on or after the bounce. No bank
  charge or penalty is added (no late fees, decision 6); the accountant may post a normal charge for any bank
  fee.

---

## 4. Bulk billing and opening balances

### 4.1 One mechanism, three uses

A **BillingRun** creates one `Charge` per selected flat. The same flow serves:

| Use | `kind` | Example |
|---|---|---|
| Recurring fee | SERVICE_CHARGE | "Service charge, November 2026", 450 EGP per flat |
| Shortfall collection | SHORTFALL | "Maintenance shortfall, Q3 2026", 120 EGP per flat |
| One-off levy / installment | CUSTOM | "Maintenance deposit installment 3 of 6", "Elevator repair levy" |

A deposit installment plan is a CUSTOM run with `ChargeKind = MAINTENANCE_DEPOSIT` per installment, so each
installment is its own charge with its own due date. Per-flat deposit totals differ (owner may have agreed
different totals); those come in as per-flat overrides or from the opening-balance import.

### 4.2 Flow: draft, preview, commit

1. **Draft** `POST /finance/billing-runs` with kind, fee schedule (optional), period, amount, due date,
   description (AR + EN), scope (all active flats, or phases / buildings), exclusions, per-flat overrides.
   Creates a `BillingRun` in `PREVIEW`. Nothing is billed yet; no charges exist.
2. **Preview** `GET /finance/billing-runs/:id/preview` returns, computed on the fly:
   - flat count, total amount, and a paged table of `flat, amount, source (default | override | excluded), warnings`.
   - warnings: flat already has a charge for this schedule and period (skipped), flat inactive, amount is 0,
     flat has no registered owner (still billed, flagged "no account").
3. **Commit** `POST /finance/billing-runs/:id/commit` re-computes the preview server-side (never trusts a
   cached list), then in **one transaction** inserts all charges with `createMany` (about 700 rows, one
   statement) and flips the run to COMMITTED. Requires the run's `accrualPeriod` (2.4: the first month of a
   quarterly or annual run) to be OPEN, checked under the period `FOR SHARE` lock (3.2). The interactive
   transaction sets `{ timeout, maxWait }` explicitly (see "Large transactions" in 4.6; review 3, M4); the audit
   row is one insert.
4. **Void** `POST /finance/billing-runs/:id/void` with a reason (see 3.1).

### 4.3 Idempotency

| Guard | Mechanism |
|---|---|
| Same period billed twice | Partial unique index on `billing_runs (periodKey) WHERE status = 'COMMITTED' AND periodKey IS NOT NULL` (2.4). `periodKey` is `SC:<feeScheduleId>:<period>` for service charges and `SF:<period>` for shortfall runs, so the guard also covers SHORTFALL, where `feeScheduleId` is NULL and a `(feeScheduleId, period)` index would never fire. |
| Retry after a network drop | `commit` is a state transition `PREVIEW -> COMMITTED`: a second call returns the committed run unchanged. |
| Half-written batch | Single transaction; all or nothing. |
| Same flat twice in a run | `@@unique([billingRunId, flatId])` on `Charge`. |
| Double click on draft | **Every** run (not only CUSTOM) carries the client-generated unique `requestKey` (2.4); re-posting the same draft returns the existing run. |
| CUSTOM runs | `periodKey` is NULL, so only `requestKey` guards them. That is intended: a second levy with a different description is a legitimate new run. |

### 4.4 Exclusions and overrides

- **Exclusions:** list of flat ids (vacant, undelivered, exempt). Stored in `params` with a reason per flat.
- **Overrides:** `flatId -> amount` (e.g. a larger flat, a negotiated deposit). An override of **0 is
  equivalent to an exclusion**: **no `Charge` row is created** (`Charge.amount` has `CHECK > 0`, so a
  zero-value charge cannot exist) and the flat appears in `params` as "excluded by override 0" with its
  reason. Negative overrides are rejected. Exclusions and overrides are copied into `params` at commit, so the
  run is reproducible later.
- `Flat.shareWeight` is reserved for "amount x weight" billing; v1 keeps it at 1 and the UI hides it.

### 4.5 Shortfall suggestion

Decision 5 says shortfall is billed when fund returns do not cover maintenance. The system **suggests,
never auto-bills**: on the fund page it shows `maintenance spent from fund (period) - investment income
(period)`; if positive it offers "Create shortfall run" prefilled with `shortfall / active flat count`,
rounded **up** to the next whole EGP so the compound never under-collects. The accountant edits and commits
through the normal run flow. A different split (area weight) is an open question Q9.

### 4.6 Opening balances import

Goal: load what each flat owes (or has paid) as of the go-live date so the ledger starts true.

**Template** (CSV or XLSX, one row per flat, Arabic or English headers accepted, template downloadable):

| Column | Meaning |
|---|---|
| `flat` | `A1-3-2` (label) or three columns building / floor / flat |
| `service_charge_arrears` | Unpaid service charges before go-live |
| `deposit_total_agreed` | Total deposit commitment of the flat |
| `deposit_paid_to_date` | Already paid towards it (feeds the flat's deposit progress; the fund total comes from the fund opening balance, below) |
| `other_arrears` | Anything else owed |
| `credit` | Prepaid amount the flat holds (rare) |
| `as_of` | Cut-off date, one per file |
| `note` | Optional |

**Flow**

1. `POST /finance/import/opening-balances/preview` (multipart, 2 MB cap): parse, never write. Returns a
   batch id and per-row result: `OK | WARNING | ERROR` with error codes per cell, plus totals. Errors:
   unknown flat, duplicate flat in file, negative or over-precision amount, unparsable number, flat already
   imported, `as_of` in a closed period, `deposit_paid > deposit_total`.
2. The accountant fixes the sheet and re-uploads (new batch) or **excludes** rows in the preview UI. A batch
   with any ERROR row cannot be committed; WARNING rows need a tick.
3. `POST /finance/import/opening-balances/:batchId/commit` creates, per flat, in one transaction:
   - one `Charge kind OPENING_BALANCE` for arrears (`service_charge_arrears + other_arrears`, only when > 0;
     dueDate = `as_of`, so overdue ageing starts there);
   - one `Charge kind MAINTENANCE_DEPOSIT` for `deposit_total_agreed` (only when > 0); for
     `deposit_paid_to_date` (when > 0), one `Payment` (`isOpening = true`, method `CASH`, reference
     `OPENING`) allocated to that charge (`allocatedAt = as_of`), plus a `DEPOSIT_IN` fund entry with
     `countsInFundTotal = false` (it explains the flat's deposit progress without double-counting the fund,
     see the fund opening balance below);
   - a `credit` value (when > 0) becomes an `isOpening` Payment with no allocation;
   - zero values create no rows, but the flat is still recorded as imported (point 4);
   - opening `Payment` rows take numbers from a separate `O-` counter scope (`O-2026-000001`), so they never
     consume or fragment the gap-free `R-` receipt sequence (owner may override, Q15). The whole range is
     reserved with **one** counter statement (3.4 "Bulk reservation"), not one increment per payment.
   - **Large transactions (review 3, M4).** Up to 1000 flats in one transaction (charges, payments,
     allocations, fund entries, import-row flags, audit row) over the Supabase pooler from Render exceeds
     Prisma's default interactive-transaction `timeout: 5000`; a timeout rolls back everything (safe) but the
     commit could then never succeed. So: (a) `db.$transaction(fn, { timeout: 60_000, maxWait: 10_000 })`
     explicitly (values in `finance.config`, the same options on billing-run commit and batch void); (b) ids
     are generated in memory (`cuid()`) so rows can reference each other before insert, and each table is
     written with **one `createMany` per table** (charges, payments, allocations, fund entries; chunks of 500
     rows), plus one `updateMany` for `ImportRow.committed`; (c) the `O-` range is reserved once (above); (d) a
     **load test with a 1000-row file** against a Supabase-like Postgres through a pooler (local `pgbouncer` in
     transaction mode) must commit within half the configured timeout, and is part of the Phase 1 exit.
4. **One time per flat (revised):** the guard is a **unique partial index on `import_rows (flatId) WHERE
   committed = true`** (2.4), set in the commit transaction for **every** flat in the batch, including flats
   whose values are all zero. The earlier `charges ... WHERE kind = 'OPENING_BALANCE'` guard missed flats
   with zero arrears, whose deposit or credit could then be imported twice. A second commit that includes an
   already-imported flat fails the whole batch with `finance.error.flatAlreadyImported` (listing the flats).
5. **Idempotent:** the batch `fileHash` is unique among committed batches; committing the same batch twice
   returns the committed state; re-uploading the identical file is rejected with `finance.error.importAlreadyCommitted`.
6. **Undo (new endpoint and status):** `POST /finance/import/opening-balances/:batchId/void` (ADMIN, reason
   required) moves a COMMITTED batch to **`VOIDED`**. In one transaction it voids every charge, payment,
   allocation and fund entry the batch created, sets `ImportRow.committed = false` (freeing those flats for a
   corrected re-import), and writes `OPENING_BALANCES_VOIDED`. Refused with `finance.error.importHasActivity`
   if any imported flat already has a **non-opening** posting (a real payment or charge after go-live), because
   voiding would silently change live balances; the admin then fixes those flats by correcting entries.
   Voiding is also blocked once the `as_of` period is CLOSED (3.2).

**Fund opening balance (separate step, ADMIN).** The per-flat sheet does not describe the fund. The fund's own
starting position (bank cash plus investments, 2.4 `FundEntry OPENING_BALANCE`) is entered once through
`POST /finance/fund/opening-balance` `{ cash, invested, asOf, evidenceAttachmentPath }`. Who legally holds this
money is a policy question (Q17). **Phase placement (review 2, H1):** this endpoint, the `fund_entries` table, the
`countsInFundTotal` and `holding` columns and `OPENING_BALANCE` in `FundEntryKind` all ship in the **Phase 1**
migration `..._finance_foundations` (2.3.1), because the Phase 1 opening import already writes per-flat
`DEPOSIT_IN` rows with `countsInFundTotal = false`. Only the Phase 2 `MAINTENANCE_OUT` link (`expenseId`) and
expense-driven entries wait for Phase 2.

Why no `isOpening` leakage into cash reports: income reports must not count last year's money as this year's
cash. Opening rows carry `isOpening = true` on Payment and are excluded from cash-position reports; the
allocations **this import creates** (dated `as_of`) are excluded from income (2.4 "Rule that avoids double
counting"). An opening `credit` row is part of "prepayments held" from `as_of`; a later `apply-credit` of it
against a non-deposit charge is income on that allocation's date, but never cash (review 4, L-4). Opening rows
are included in per-flat balance, arrears and fund capital.

Library: neither `csv-parse` nor `exceljs`/`xlsx` is installed in `apps/backend/package.json` today, so this
adds dependencies. CSV with `csv-parse` (MIT); XLSX with `exceljs` (MIT) or SheetJS CE, both free. Implement CSV
first and accept XLSX through the same normaliser. Max 1000 rows, 2 MB.

---

## 5. Receipts and attachments (private storage)

### 5.1 Problem

`eastpark-uploads` is **public** and `FileService.upload` returns `getPublicUrl()`
(`apps/backend/src/common/file/services/files.service.ts`); `assertStoragePublicUrls` and
`NEXT_PUBLIC_STORAGE_ORIGIN` also assume public URLs. Anyone with the link can open an object. Invoices and
transfer slips contain names, account numbers and amounts, so they must never be there.

### 5.2 Proposal: second private bucket, signed URLs on demand

| Item | Decision |
|---|---|
| Bucket | `eastpark-finance` in the same Supabase project, **private** (public toggle off). Free tier, same 1 GB pool; the pool is shared with public uploads (monitor, see 5.4). |
| Stored value | The object **path** only (`receipts/2026/E-2026-000045/<uuid>.pdf`), never a URL. Columns `attachmentPath` on Payment / Expense / Revenue. |
| Read access | `GET /finance/attachments/signed-url?path=` (roles ACCOUNTANT, ADMIN) returns `{ url, expiresAt }` from `supabase.storage.from(bucket).createSignedUrl(path, 60)`. 60 seconds is long enough to open or download and short enough that a leaked link dies at once. |
| Write access | Backend uploads with the service-role key (already in config as `supabase.serviceKey`). Clients never hold storage credentials. |
| Authorisation | The signed-url endpoint verifies the path belongs to a row the caller may see; unknown path is 404, not 403. Every issue is audited (`ATTACHMENT_VIEWED`). |
| Residents | Never get **storage** links or attachment images in v1. If receipt/statement PDFs for residents are wanted (Q6), the backend renders them on the fly from DB data (no stored file, no private-bucket object) and hands them over through a **backend download ticket**: `POST /me/finance/downloads` `{ kind, id }` returns `{ url, expiresAt }` where the URL is `/v1/me/finance/downloads/<ticket>`; the ticket is a random 32-byte value in Redis bound to the user id, valid 60 s, **single use** (`GETDEL`), and the endpoint re-checks ownership (`FlatOwnership`) before streaming the PDF. This is not a Supabase signed URL, so the "residents get no storage links" rule above and the Phase 3 "open the PDF in the system browser" flow (section 10) are consistent. |
| Allowed files | JPEG, PNG, WebP (<= 5 MB) and PDF (<= 10 MB), magic-byte sniffed with the existing `file-signature.ts`. Max 3 attachments per row in v2; v1 is one. |
| Naming | Path built server-side from the document number plus a random uuid; client filename is discarded (same rule as today). |

### 5.3 Backend changes needed

1. **Config:** add `supabase.financeBucket` (`SUPABASE_FINANCE_BUCKET`, default `eastpark-finance`); boot
   check mirrors the existing bucket check.
2. **`FileService`:** add `uploadPrivate(buffer, kind, ownerId)` returning `{ path }` (no `getPublicUrl`), and
   `createSignedUrl(path, ttl)`. Keep the public path untouched so no existing behaviour changes. Implement as
   a second small class `PrivateFileService` to avoid growing `FileService`.
3. **`ENUM_FILE_STORE`** (`apps/backend/src/common/file/enums/files.enum.ts`): add `FINANCE_RECEIPTS`,
   `FINANCE_EXPENSES`, `FINANCE_REVENUES`. These are used only by the private service.
4. **Upload route:** `POST /v1/finance/attachments` (multipart, roles ACCOUNTANT/ADMIN). It does **not**
   go through `/uploads` and is not added to `IMAGE_UPLOAD_PURPOSES`, which would hand out public URLs by
   mistake. Returns `{ path }`; the create/update call stores it. A pending upload that is never attached
   is swept by a daily cron (objects under `staging/` older than 24 h).
5. **`storage-url.ts`:** unchanged. Add a unit test asserting a finance path is *not* accepted by
   `isStoragePublicUrl`, so nobody pastes one into an avatar field.
6. **Web BFF:** a `/api/finance/attachments` multipart passthrough mirroring `/api/uploads/image`
   (preserve the browser boundary, same 4 MB limit; larger PDFs are asked to be compressed). The signed URL is
   fetched server-side and the browser follows a **302** to it, so the URL is never stored in client state.
7. **Mobile:** camera or gallery picker (`expo-image-picker` is already used for avatars; verify before
   committing) sends to the same endpoint. PDF picking needs `expo-document-picker`; if not installed it is a
   native-module change, so mobile v1 is **photo-only** and PDF upload stays web-only until an EAS build.
8. **RLS and bucket policy:** no storage policies are created, so with RLS on and no policy the anon key cannot
   read anything; only the service role (backend) can. State this in the migration notes and in the owner
   runbook (owner creates the bucket by hand, as with `eastpark-uploads`).

### 5.4 Cost and limits

Free tier: 1 GB storage, 2 GB egress/month. A phone photo at about 300 to 600 KB means roughly 2000 to 3000
receipts per GB.

**Correction (review):** there is **no existing resize helper to reuse**. The mobile avatar, candidate and
feedback pickers only pass `quality: 0.7` or `0.8` to `ImagePicker.launchImageLibraryAsync`
(`profile/edit.tsx`, `feedback/new.tsx`), and `expo-image-manipulator` is **not installed**; adding it is a new
native module and needs an **EAS build**, not an OTA update. So v1 finance mobile uploads use only what ships
today: `expo-image-picker` with `quality: 0.6` and `allowsEditing: false` (camera and library), which keeps a
phone photo around 400 to 800 KB, under the backend's 5 MB image limit and the web BFF's 4 MB limit. A
client-side resize to 1600 px is deferred until an EAS build is anyway needed for another reason; the backend
may also downscale server-side (`sharp` is not installed either, so this is optional and deferred).
Add a monthly storage figure to the admin overview so the owner sees when to purge or archive. Archive/export
of old years to a local zip is the free escape hatch.

### 5.5 What stays public

Published resident summaries contain **numbers only** (no attachments). Their snapshot lives in the database
(`PublishedReport.snapshot`). A PDF copy, if added later, goes through the existing announcements PDF flow
only after an admin reviews it, and is never the source of truth.

---

## 6. Reports, exports, publishing

### 6.1 Report catalogue

All reports take `from`, `to` (dates) or `period`. All amounts exclude rows that are not live **at the date that
applies** (the report date for stock figures, each event's own date for flow reports, below) and PENDING_APPROVAL
expenses, and **every payment and allocation total (R1 to R6, R8, the
brought-forward line, the collection rate) goes through the one dated "live as of D" helper of 2.1.1**
(review 2, C1; review 3, H1). **Stock** figures (R5's opening and closing balance, R6, the brought-forward line,
"prepayments held" at a period end, the collection rate's open amounts) use D = the report's `to` date (or the
as-of date for R5/R6). A cheque bounced after D, or a row voided after D, therefore still counts in a stock
figure for D, so a closed month's stock figure is reproducible. **Flow** reports (R1, R2, R3, R4, R7, R8) do
**not** use one D for the whole range; they follow the next paragraph. No report spells `status = 'POSTED'` or `chequeState` for payments by hand; a lint-style test
greps the report builders for both. "Cash" reports use `receivedAt / expenseDate` (and `bouncedAt` for the
reversal of a bounced cheque); "accrual" reports use `accrualPeriod`; **income** uses `allocatedAt` (2.4 "Rule
that avoids double counting"; review 3, H2). Opening-balance payments (`isOpening = true`) are excluded from cash
figures, and the allocations the opening import creates (dated `as_of`) are excluded from income; a later
`apply-credit` of opening credit against a non-deposit charge is income on its `allocatedAt`, not cash (review 4,
L-4). Required tests: (1) one flat with a bounced cheque: R5
(statement closing balance), R6 (open amount) and the `/me/finance` balance are the same number; (2) "close
October, bounce in November: October's R5/R6 unchanged" (2.1.1); (3) **a 1,000 payment allocated to a
MAINTENANCE_DEPOSIT charge moves R4 by +1,000 and R1/R2 income by 0** (H2); (4) a 1,000 payment with no open
charge moves R1 income by 0 and "prepayments held" by +1,000, and a later `apply-credit` moves income on the
allocation date; (5) **R1(Oct–Nov) = R1(Oct) + R1(Nov), column by column and in total, both before and after a
November bounce of an October cheque allocated in October**, and the October column of the Oct–Nov report equals
the published October R1 (review 4, N-1); the same additivity test runs for R2, R4 and R8.

**Reversals in flow reports (review 4, N-1).** A flow report over a range sums events into period buckets. With
one D (the range's `to` date) an October allocation of a cheque that bounced in November would vanish from the
**October column** of an "Oct–Nov" R1 (it is not live as of 30 Nov), so that column would no longer match the
published October report, while the November column would show no negative income either (the allocation's
`allocatedAt` is in October). So every flow report books a reversal **in the month it happens**:
- a row that is voided or bounced at V (an allocation voided with its payment, a bounced cheque's allocations, a
  voided charge, a voided `FundEntry`, a voided expense or revenue) counts **+amount in its original bucket**
  (`allocatedAt` for income, `entryDate` for R4, `receivedAt`/`expenseDate` for R3 and R7, the charge's
  `accrualPeriod` for R8 billed) and **−amount in V's bucket** (`bouncedAt`, or the Cairo date of `voidedAt`), when
  both fall inside the range; a reversal dated after the range's `to` is ignored, and an original dated before
  `from` shows only its reversal;
- equivalent rule: each month's column is computed as of **its own month-end**, and the range total is the sum
  of the columns;
- a closed month's original bucket never changes; the reversal always lands in an open period (a void dated in a
  closed period is refused, 3.2; a bounce is dated in the open period, 3.8);
- the report builders share one helper for this (`flowBuckets(rows, from, to)` beside `livePaymentWhere`), so no
  builder re-spells the rule; the lint-style test above covers it.
Per report: **R1/R2** income gets a negative line ("Reversed: cheque bounced / payment voided") in the reversal
month, expenses likewise for a voided expense; **R3** already shows a bounced cheque as a negative line at
`bouncedAt`, and a voided payment or expense gets the same treatment; **R4** shows a voided `DEPOSIT_IN` (or other
fund entry) as a reversing movement dated V; **R7** reverses a voided expense in V's month; **R8** keeps "billed"
and "collected" on their original dates and reverses a voided charge or a voided/bounced allocation in V's month.

| # | Report | Content | Basis | Audience |
|---|---|---|---|---|
| R1 | **Income vs expenses** | Per month in range: income (= live allocations to **non-deposit** charges by `allocatedAt`, except the allocations the opening import creates, plus `Revenue`; H2, L-4), expenses (operating only; fund-paid expenses are in R4), net; totals; previous-period comparison. A separate, non-income line shows **"prepayments held"** (unallocated live credit at period end, a liability). A bounced or voided allocation is a negative income line in the month of the bounce/void, never a change to its original month (N-1) | income: allocation date; expenses: cash; reversals: event date | staff, published |
| R2 | **By category** | Revenue and expense totals per `FinanceCategory`, share of total; income on the same allocation basis as R1, deposit allocations excluded; reversals booked in their own month as in R1 (N-1) | as R1 | staff, published |
| R3 | **Cash position** | Opening cash, receipts by method (cash / transfer / InstaPay / cheque), disbursements, closing; per-accountant receipts for reconciliation. **Two cash lines (H2):** operating cash and maintenance-fund cash (fund cash = `FundEntry` with `holding = CASH`; a receipt allocated to a deposit charge is fund cash, the rest of a receipt, including unallocated credit, is operating cash). If the compound keeps both in one bank account (Q17), the report says so explicitly ("one bank account holds both; fund share X") instead of hiding the split. Bounced cheques appear as a negative line at `bouncedAt` | cash | staff only |
| R4 | **Maintenance fund statement** | Opening balance, deposits in (the **only** place deposit allocations appear; H2), investment income, maintenance out, adjustments, closing; running movement list. A `DEPOSIT_IN` (or any fund entry) voided at V, including through a bounced cheque, stays in its `entryDate` month and gets a reversing movement dated V (N-1) | cash | staff, published |
| R5 | **Per-flat statement** | Opening balance, charges, payments, "Cheque bounced" debit lines at `bouncedAt` (H1), refunds, credit, closing, line by line with receipt numbers; every figure as of its line date | accrual+cash | staff, owner of the flat |
| R6 | **Arrears and aging** | Per flat: open amount in buckets 0-30, 31-60, 61-90, 90+ days past `dueDate`; totals per building/phase; collection rate for the period | as of date | staff; residents see only aggregate rate if published |
| R7 | **Vendor spend** | Per vendor: count, total, by category, last payment; contract end dates approaching | cash | staff |
| R8 | **Billing coverage** | Per billing run: billed, collected, outstanding, % paid. Over a range, "collected" counts each allocation on `allocatedAt` and a bounced/voided one as −amount on its V; "outstanding" is a stock figure as of `to` (N-1) | accrual | staff |
| R9 | **Pending approvals** | Expenses awaiting an admin | live | admin |

Aging buckets are computed from `dueDate` to the as-of date (default today). No late fee is computed
(decision 6); the report shows "days overdue" only.

### 6.2 Implementation approach

- Plain SQL aggregates through Prisma `groupBy` / `$queryRaw` with indexes from section 2. No materialised
  views or BI tools. At about 700 flats and a few thousand rows a year, every report returns in well under a
  second. If R6 ever slows, add a `flat_balance_cache` table refreshed on posting (not in v1).
- Reports are **pure functions of the ledger**: `GET` returns JSON; the same builder feeds the CSV export and
  the published snapshot, so numbers cannot differ between screen, file and resident view.
- Cache: short Redis TTL (60 s) keyed by report + params; invalidated on any finance write by a version counter
  key. Optional; skip if it complicates v1.

### 6.3 Exports

| Format | Decision |
|---|---|
| **CSV** | Yes, every report and every list (payments, charges, expenses, flats). UTF-8 **with BOM** so Excel opens Arabic correctly; semicolon-safe quoting; dates `YYYY-MM-DD`; amounts as plain decimals with `.`; status column included. |
| **XLSX** | Not v1. CSV with BOM opens in Excel. |
| **PDF** | Only the **per-flat statement and receipt**, because residents and accountants hand these out. **Primary path (revised): HTML plus print CSS.** The web app renders a print-optimised page (`/finance/flats/[id]/print`, `/home/finance/receipt/[id]`) with `@media print`, Cairo font, RTL, and the user saves it as PDF through the browser (free, correct Arabic shaping, no server dependency, works on the Render free tier). A server-side generator is an optional later add-on, not v1: `pdfmake`'s Arabic shaping and bidi handling are weak (joined letters, mixed digits and RTL punctuation), so it would need a proven spike with real Arabic receipts before anyone relies on it. If the owner later wants a mobile "share PDF" button, the backend serves the same HTML as a print view and the phone's browser prints it (no new native module). Report PDFs are not v1. |
| Size guard | Export streams in chunks, capped at 50,000 rows, throttled to 5 per minute per user, and audited (`FINANCE_EXPORT`). |

### 6.4 Published summaries (resident-facing)

**What a summary contains** (one `PublishedReport`, decided by the accountant when drafting, content shaped
for residents):

- Period (month, quarter or year) and a short note in Arabic and English.
- Income, expenses and net, by category (R1 + R2, income on the allocation basis, deposits excluded, H2); no
  vendor names, no individual flat data.
- Maintenance fund: opening, deposits, investment returns, maintenance spent, closing (R4).
- Collection rate: share of billed charges paid, as one percentage (R6/R8), **never a list of who owes**.
- Optional: top 5 expense categories.

**Resident-facing privacy of statements.** A resident statement line carries only: date, type, description,
amount, running balance, receipt number and status. It **never** includes `payerName`, `note`, `createdBy`,
`reference`, bank details, attachment info or the accountant's name. This matters most when the previous
owner's period lines are involved: the new owner sees one "Balance brought forward" line, not the seller's
individual payments (2.2, section 9).

**Snapshot rule.** Publishing computes the numbers **once** and stores them in `PublishedReport.snapshot`
(JSON, with `generatedAt`, the period list used and a `ledgerRevision` hash of the included row ids and
amounts). Residents always read the snapshot, never live data. Therefore:

- A later void or correction in an open period does not alter a published summary.
- The period must be CLOSED to publish (3.2), so numbers are stable by construction.
- If the numbers were wrong, an admin **republishes**: a new row (`version + 1`, `supersedesId`), and the
  previous one is marked superseded and shown as "Replaced by a corrected version" with a diff note
  ("Expenses changed from 41,200 to 43,900"). Never edited in place.
- An admin can **withdraw** a summary (hidden from residents, kept for audit) with a reason.

**Who publishes:** the accountant drafts and previews ("publish preview" shows exactly the resident view);
only ADMIN/SUPER_ADMIN presses Publish. Reason: it is the compound's public statement. In many compounds the
financial statement must first be approved by the owners' union or its general assembly; the system supports
this with an optional **"approved by" note** on publish (`approvalRef`, free text such as "General assembly
2026-11-05, minute 4"). Whether it is mandatory is Q19; the default is optional.

**Notifying residents.** Reuse the notification tables and the Expo push client, but **not** the current
`send()` loop (review correction: `NotificationsService.send` handles exactly one user per call, with one
`notification.create`, one `user.findUnique` and one push request, and there is no batching; calling it for
about 700 residents sequentially would take minutes and time out on the Render free tier).

1. **Enum:** add `FINANCE_UPDATE` to `NotificationType` in its own enum-only migration (2.3). Clients render
   unknown types generically (same contract as audit actions).
2. **New `NotificationsService.sendMany(userIds, type, title, titleAr, body, bodyAr, data)`** (or a small
   `NotificationsBroadcastService`):
   - one `notification.createMany` for all recipients (a single insert, in chunks of 500 rows);
   - one `user.findMany` selecting `id, pushToken, deletedAt` and `notificationPrefs where type` for all
     recipients, filtering soft-deleted accounts, invalid Expo tokens and explicitly disabled preferences
     exactly like `send()` does;
   - `expo.chunkPushNotifications(messages)` (Expo's own 100-message chunks) and chunks sent with limited
     concurrency (for example 3 in parallel), logging receipt errors with masked tokens as `send()` does;
   - returns counts `{ recipients, pushed, skipped }` for the audit row.
3. **Never in the request path.** Publishing commits the `PublishedReport` row (status `PUBLISHED`,
   `notifiedAt = null`) and returns immediately. A post-commit job sends the notifications; a
   `@Cron('*/2 * * * *')` sweeper (the project already uses `@nestjs/schedule`) picks up published reports with
   `notifiedAt IS NULL`, sets `notifiedAt` after a successful run, and is idempotent through
   `Notification.data.reportId` (skip a user who already has a notification for that report). A crash or a
   Render restart therefore resumes instead of losing or duplicating the fan-out.
4. **Payload that the mobile router can resolve (review correction).** The mobile router
   (`apps/mobile/src/services/notifications/routing.ts`) matches the **enum type name** and a **per-type id
   key**. A `{ type: 'FINANCE_REPORT', id }` payload would be ignored. Contract:
   `type = 'FINANCE_UPDATE'` and `data = { reportId: '<PublishedReport id>' }`. Mobile changes (JS only, OTA):
   add `"FINANCE_UPDATE"` to the `NotificationType` union and `NOTIFICATION_TYPES` in `routing.ts`, add
   `FINANCE_UPDATE: "reportId"` to `ID_KEY_BY_TYPE` and
   `FINANCE_UPDATE: id => "/(tabs)/profile/finance/reports/" + id` to `ROUTE_BY_TYPE` (exact path in 8.3); and add it to the
   separate `NOTIFICATION_TYPES` list in `apps/mobile/src/lib/notification-preferences.ts` so residents can
   switch it off (that list currently also lacks `LISTING_UPDATE`; fix both in the same change and keep
   `notification-preferences.test.ts` green). The web notification centre gets the same mapping.
   Title: "Financial summary published" / "تم نشر الملخص المالي".
5. Per-flat nudges ("you have an overdue balance") are **not** automatic in v1. A staff-triggered
   "Send statement reminder" for one flat is Phase 3 optional and rate limited (1 per flat per 7 days); it goes
   to the flat's **current owners** (`FlatOwnership` open rows) through `sendMany`.
6. Residents can turn the type off in existing notification preferences. The preference table is per type;
   an absent row means enabled, so **no migration seed** is needed or allowed (2.3).
7. Test: `sendMany` with 700 fake users completes with a bounded number of DB statements (assert query count)
   and one chunked push call per 100 tokens.

---

## 7. API contract outline

Base `/v1`, all authenticated (Bearer), errors are i18n codes in the existing style (`finance.error.*`,
files `src/languages/en/finance.json`; the backend has **only an `en` language folder today** (no `ar`), so
codes are English message keys and the **Arabic text lives in the clients' translation files** as it does for
every other module; do not create an `ar` backend folder for this feature), pagination is the shared `cursor` + `limit` (default 20, max 100)
returning `{ items, nextCursor? }`. Money is a JSON number with at most 2 decimals. Dates are `YYYY-MM-DD`
unless a timestamp. Controllers are split like `listings`: `finance.*` for staff, `me/finance` for residents.
Role shorthand: **A** = ACCOUNTANT + ADMIN (+SUPER_ADMIN), **AD** = ADMIN (+SUPER_ADMIN), **SA** = SUPER_ADMIN only, **R** = RESIDENT.

### 7.1 Flats and ledgers

| Method + path | Roles | Request | Response |
|---|---|---|---|
| `GET /finance/flats` | A | `q` (label), `building`, `phase`, `hasBalance`, `overdueDays`, `asOf?` (default today), `cursor`, `limit` | page of `{ id, label, building, ownerName?, hasAccount, balance, overdueAmount, oldestDueDays, credit, availableCredit }` (2.1.1, M1) |
| `GET /finance/flats/:id` | A | | flat + totals (`balance`, `credit`, `availableCredit`) + owner contact (accountant sees name/phone for collection) |
| `GET /finance/flats/:id/ownership` | A | | `FlatOwnership` history (owner name, from, to, closedReason) for the flat |
| `GET /finance/flats/:id/statement` | A | `from`, `to`, `cursor` | opening (as of `from`), lines `[{date, type, description, debit, credit, runningBalance, receiptNo?, status}]` including "Cheque bounced" debit lines at `bouncedAt` (H1), closing (as of `to`) |
| `POST /finance/flats/:id/apply-credit` | A | `{ chargeIds? }` | allocations created (dated today); capped at `availableCredit`, `insufficientCredit` (M1) |
| `PATCH /admin/resident-units/:id` | SA | `{ building, floor, flatNumber }` | unit. SUPER_ADMIN only, like unit add/remove (review 4, L-3). Corrects the unit key, sets `flatId`, and runs the "link and open period" step when `flatId` was NULL (2.2, M2; the period opens only for a non-deleted user, L-2). Audited. `unknownFlat`, `alreadyOwned` |
| `PATCH /finance/flats/:id` | AD | `{ isActive }` | flat (blocked if balance != 0) |

### 7.2 Charges, payments, billing

| Method + path | Roles | Request | Response / errors |
|---|---|---|---|
| `POST /finance/charges` | A | `{ flatId, kind, amount, descriptionAr/En, dueDate, accrualPeriod }` | charge. `periodClosed`, `amountPrecision` |
| `POST /finance/charges/:id/void` | A (rules 3.6) | `{ reason }` | charge. `hasAllocations`, `periodClosed`, `reasonRequired` |
| `POST /finance/payments` | A | header `Idempotency-Key` (required, stored in `Payment.requestKey`, 3.3); `{ flatId, amount, method, reference?, receivedAt, payerName?, note?, attachmentPath?, allocations?: [{chargeId, amount}] , payFor?: 'AUTO'\|'DEPOSIT' }` | payment + `receiptNo` + allocations + remaining credit. `periodClosed`, `allocationExceedsPayment`, `allocationExceedsCharge`, `idempotencyConflict`, `duplicateReference` (409 with `force: true` override; a soft warning, not a unique index, and never raised against `isOpening` rows, L2). Cheques are created `PENDING_CLEARANCE` (3.8) |
| `POST /finance/payments/:id/cheque-cleared`, `/cheque-bounced` | A | `{ date? }` (default today in Cairo; not in the future; its period must be OPEN) | payment. Bounce makes the payment non-live **as of `date` and later** (earlier figures unchanged, 2.1.1 H1), adds the "Cheque bounced" statement line at `date`, and voids allocations and fund entries with `voidedAt = date` (3.8). `notACheque`, `alreadyFinal`, `periodClosed` |
| `POST /finance/payments/:id/void` | A (rules 3.6) | `{ reason }` | payment |
| `GET /finance/payments` | A | filters `flatId, method, from, to, createdById, status, q (receiptNo/reference)` | page |
| `GET /finance/payments/:id` | A | | payment + allocations + attachment flag |
| `GET/POST/PATCH /finance/fee-schedules` | read A, write AD | `{ name, nameAr, kind, amount, frequency, categoryId }` | schedule |
| `POST /finance/billing-runs` | A | see 4.2 | run in `PREVIEW` |
| `GET /finance/billing-runs/:id/preview` | A | `cursor` | totals + rows + warnings |
| `POST /finance/billing-runs/:id/commit` | A | | run. `alreadyBilled`, `periodClosed`, `nothingToBill` |
| `POST /finance/billing-runs/:id/void` | AD | `{ reason }` | run. `hasPaidCharges` (lists them) |
| `GET /finance/billing-runs`, `/:id` | A | | page / detail with coverage (billed, collected) |

### 7.3 Expenses, revenues, vendors, services

| Method + path | Roles | Notes |
|---|---|---|
| `POST /finance/expenses` | A | `{ categoryId, vendorId?, amount, paidFrom, description, expenseDate, invoiceRef?, attachmentPath? }` -> status `APPROVED` or `PENDING_APPROVAL` (response says which and the threshold). A refund (`refundFlatId`, admin only) is checked against the flat's `availableCredit` (3.5), `insufficientCredit` |
| `GET /finance/expenses` | A | filters `status, categoryId, vendorId, from, to, q`, pagination |
| `POST /finance/expenses/:id/approve` | AD | `{ note? }`; creates fund entry when `paidFrom = MAINTENANCE_FUND`. `notPending`, `periodClosed`. An admin may approve an expense they created themselves (small team; audited) |
| `POST /finance/expenses/:id/reject` | AD | `{ reason }` |
| `POST /finance/expenses/:id/void` | AD | `{ reason }` |
| `GET/POST/PATCH /finance/vendors` | read A, write A | no delete; `{ isActive:false }` to retire |
| `GET/POST/PATCH /finance/categories` | read A, write AD | |
| `POST /finance/revenues`, `GET`, `POST :id/void` | A | as payments without allocations |
| `POST /finance/service-sales`, `GET`, `POST :id/void` | A | `{ flatId?, categoryId, description, quantity, unitPrice, billTo }` |
| `GET/POST/PATCH /finance/service-items` | read A, write A | optional catalogue |

### 7.4 Fund

| Method + path | Roles | Notes |
|---|---|---|
| `GET /finance/fund` | A | `{ opening, capital, returns, spent, adjustments, balance, invested, asOf, suggestedShortfall, depositsReconciliation }` (`depositsReconciliation` = sum of per-flat deposits paid vs fund opening + deposits since, 2.4) |
| `GET /finance/fund/entries` | A | filters `kind, from, to`, pagination, running balance column |
| `POST /finance/fund/opening-balance` | AD | `{ cash, invested, asOf, evidenceAttachmentPath }` once; `finance.error.fundOpeningExists` afterwards |
| `POST /finance/fund/investment-income` | A | `{ amount, entryDate, investmentRef, description }` |
| `POST /finance/fund/adjustments` | AD | `{ amount, direction, entryDate, description }` |
| `POST /finance/fund/entries/:id/void` | AD | `{ reason }` (DEPOSIT_IN rows are voided via their payment) |

### 7.5 Periods, settings, import

| Method + path | Roles | Notes |
|---|---|---|
| `GET /finance/periods` | A | status per month |
| `POST /finance/periods/:period/close` | AD | `pendingExpenses` error lists blockers |
| `POST /finance/periods/:period/reopen` | SUPER_ADMIN | `{ reason }` |
| `GET /finance/audit` | A | finance AuditLog actions only (entity, actor, time, meta), filters `entity, entityId, from, to`, pagination. This is the one place the full finance trail lives; `GET /admin/activity` (SUPER_ADMIN, `audit.admin.controller.ts:18`) hides finance actions by default and shows them with `scope=finance` or `scope=all` (3.7) |
| `GET /finance/settings` | A | |
| `PUT /finance/settings/:key` | AD | `{ value }`, audited old/new |
| `POST /finance/import/opening-balances/preview` | A | multipart -> `{ batchId, rows[], totals, canCommit }` |
| `POST /finance/import/opening-balances/:batchId/commit` | A | `importAlreadyCommitted`, `hasErrors`, `flatAlreadyImported` (lists flats) |
| `POST /finance/import/opening-balances/:batchId/void` | AD | `{ reason }`; batch -> VOIDED, frees its flats. `importHasActivity`, `periodClosed` |
| `GET /finance/import/opening-balances/template` | A | CSV download |

### 7.6 Reports, publishing, attachments

| Method + path | Roles | Notes |
|---|---|---|
| `GET /finance/reports/:name` | A | `name` in `income-expense, by-category, cash-position, fund, arrears, vendor-spend, billing-coverage, pending`; `?format=csv` streams a file |
| `GET /finance/reports/flat/:id/statement.csv` and `.pdf` | A | PDF Phase 3 |
| `POST /finance/published-reports` | A | draft `{ kind, periodFrom, periodTo, note, noteAr }` -> `status DRAFT` with preview snapshot |
| `POST /finance/published-reports/:id/publish` | AD | `{ approvalRef? }`; freezes snapshot, returns at once, notification fan-out runs afterwards through `sendMany` (6.4); `periodNotClosed` |
| `POST /finance/published-reports/:id/withdraw` | AD | `{ reason }` |
| `POST /finance/attachments` | A | multipart -> `{ path }` (private bucket) |
| `GET /finance/attachments/signed-url` | A | `?path=` -> `{ url, expiresAt }` |

### 7.7 Resident endpoints

| Method + path | Roles | Response |
|---|---|---|
| `GET /me/finance/flats` | any signed-in role with an ownership row | flats the caller **currently or formerly** owns through `FlatOwnership`: `[{ label, current, balance?, credit?, overdueAmount?, nextDueDate? }]`; balance fields only for current ownership; `credit` is the invariant figure (2.1.1), `availableCredit` is staff-only |
| `GET /me/finance/flats/:flatId/statement` | same | statement limited to the caller's ownership periods plus one "Balance brought forward" line (2.2) and the resident-safe line fields (6.4); **404** unless the caller has an ownership period on the flat |
| `POST /me/finance/downloads` | same | `{ kind: 'STATEMENT'\|'RECEIPT', id }` returns a single-use 60 s ticket URL (5.2) |
| `GET /me/finance/published-reports` | R | page of `{ id, title, kind, periodFrom, periodTo, publishedAt, superseded }` |
| `GET /me/finance/published-reports/:id` | R | `{ ..., snapshot }` withdrawn items 404 |

**Role independence (review).** The `/me/finance/*` controllers must not use `@AllowedRoles([RESIDENT])`.
A person is one `User` with one `Role` (single-role model), so a flat owner who is promoted to ACCOUNTANT would
otherwise lose the resident view of their **own** flat. They use `@AllowedRoles` for every authenticated role
(RESIDENT, MERCHANT, ACCOUNTANT, ADMIN, SUPER_ADMIN) and authorise by `FlatOwnership`, never by role. Whether
to also allow an owner to hold both roles is Q18.

Rate limits: global default plus `@Throttle` on writes that fan out (publish: 2/min), exports (5/min), import
preview (10/min), signed URLs (30/min), download tickets (10/min), payment create (60/min per user, with the idempotency key).

---

## 8. Screens, role routing and guards

### 8.1 Getting the ACCOUNTANT role into the apps (revised after review)

Today roles are `RESIDENT | MERCHANT | ADMIN | SUPER_ADMIN` (plus `GUEST`) and a user has **exactly one** role.
Adding a fifth role ripples further than the first draft listed. A route allow-list such as
`[RESIDENT, MERCHANT, ADMIN]` rejects an ACCOUNTANT with 403, so a new role is broken by default everywhere it
is not named.

**Backend, places that must change together**

| Place | File | Change |
|---|---|---|
| Enum | `prisma/schema.prisma` + own enum-only migration (2.3) | Add `ACCOUNTANT`. |
| Role helpers | `src/common/auth/utils/roles.ts` | `roleSatisfies` unchanged (ACCOUNTANT satisfies only ACCOUNTANT). Add `isFinanceRole()` = ACCOUNTANT, ADMIN, SUPER_ADMIN. Finance routes use `@AllowedRoles([Role.ACCOUNTANT, Role.ADMIN])`. |
| Invite upgrade/downgrade | `common/auth/services/auth.service.ts` `ROLE_RANK` | `Record<Role, number>` will not compile without the new key. Decide the rank: **ACCOUNTANT = 1, same as MERCHANT** is wrong (an invitation could "upgrade" a merchant to accountant or block the reverse). Use a non-comparable rule: an invitation for ACCOUNTANT applies only when the existing role is RESIDENT; any other existing role keeps its role and the invite is rejected with `invitation.error.roleConflict`. Same guard for MERCHANT/ADMIN invites to an existing accountant. |
| Invitations + role change | `invitations/dtos/request/invitation.create.dto.ts`, `user/dtos/request/user.admin.request.ts` (`ASSIGNABLE_ROLES`) | Add `ACCOUNTANT`. Inviting an accountant is ADMIN or SUPER_ADMIN; changing an existing user's role stays SUPER_ADMIN only. |
| Notification routes | `notifications/notifications.controller.ts` (5 routes `[RESIDENT, MERCHANT, ADMIN]`) | Add ACCOUNTANT, otherwise the bell, preferences and push-token routes return 403 for accountants. |
| Uploads | `uploads/upload-purpose.ts` `ANY_USER` | Add ACCOUNTANT to `ANY_USER` (avatar, feedback). Finance attachments use their own private route (5.3), not this list. |
| Self-service and community | `user/controllers/user.public.controller.ts` (`[RESIDENT, MERCHANT]` on self-delete), `feedback/feedback.controller.ts` (3 routes), `announcements/announcements.controller.ts` (comments route), `orders/orders.controller.ts` (2 routes) | Audit each. **Feedback:** add ACCOUNTANT (they are also community members). **Comments: leave ACCOUNTANT out in v1** (review 4, L-5): web denies `/announcements` to ACCOUNTANT and mobile locks Community, so a grant would be unused; add it together with the client access if the owner later opens Community to accountants. **Orders:** leave out (accountants do not order as accountants). **Public self-delete `DELETE /user`** (`user.public.controller.ts:62-63`, `@AllowedRoles([Role.RESIDENT, Role.MERCHANT])`): **leave ACCOUNTANT out, the same as ADMIN and SUPER_ADMIN today** (review 2, L5: an ADMIN cannot self-delete either, the admin removal route `user.admin.controller.ts:89` is SUPER_ADMIN-only). Reason: an accountant is a staff account whose grant and removal belong to SUPER_ADMIN (section 9, Role change), a self-delete would skip the open-work check below and the role-removal audit, and the account is not lost forever because it is a soft delete (`user.service.ts:176-219`) that SUPER_ADMIN can restore. An accountant who needs out asks SUPER_ADMIN. (The first draft said to add them; that is reversed.) |
| Delete safety (every path) | `user/services/user.service.ts` `deleteUser` (`:176-219`) | `deleteUser` is a soft delete (a plain `db.user.update` setting `deletedAt`, no transaction), so it never deletes finance rows and the Restrict FKs are not exercised. Two additions, both inside one `$transaction` that replaces the bare `update`: (1) **close the user's open `FlatOwnership` periods** with `toDate = today (Cairo)` and `closedReason = ACCOUNT_DELETED` (2.2, H6: otherwise a deleted owner stays the flat's current owner and a re-sold flat would show two); (2) the delete is blocked with `user.error.hasOpenFinanceWork` (409) while the user owns a PENDING_APPROVAL expense. The existing `sessions.bump` calls stay outside the transaction on both sides of it, exactly as today. **Restore** (`trash.service.ts:294` `restoreUser`, today a bare `db.user.update`) becomes a `$transaction` that clears `deletedAt` and opens a new `FlatOwnership` period (`fromDate` = restore date) for every `ResidentUnit` the user still holds with a `flatId` (2.2 path 6, review 3 H4; revision 3's "an admin re-adds it" was impossible because `addToUser` refuses a flat held by any unit, `resident-units.service.ts:91-92`). A sale of a flat whose seller account is deleted needs path 4 (remove the unit) before the buyer's accept-invitation (`auth.service.ts:405` returns 409 otherwise). |
| Regression net | new test | Table-driven over every controller's `@AllowedRoles` metadata: print which routes admit RESIDENT but not ACCOUNTANT, and fail on an unreviewed difference (a reviewed allow-list of intended differences lives in the test). |

**Web**

| Place | File | Change |
|---|---|---|
| Types | `apps/web/src/lib/auth/roles.ts` (`ROLES`, `ASSIGNABLE_ROLES`), `src/lib/api/contracts.ts` (`Role`) | Add `ACCOUNTANT`, `isFinanceRole()`. |
| Lockdown | `apps/web/src/config/access-policy.ts`, `apps/web/src/proxy.ts` (matcher) | See the web lockdown point below: `/finance` blocked for residents, ACCOUNTANT on its own allow-list, **not** in `UNRESTRICTED_ROLES`. |
| Post-login | `apps/web/src/lib/auth/return-path.ts:67` (`postLoginPath`) | ACCOUNTANT lands on `/finance`. |
| Guards | `getFinanceSession()` (new, mirrors `getAdminSession`) | Accepts `isFinanceRole`. Admin guards keep `isAdminRole`. |

**Mobile**

| Place | File | Change |
|---|---|---|
| Role union | `src/lib/roles.ts` (`UserRole`), `src/store/slices/auth-slice.ts` (`role` union, line 19), `services/api/admin.ts` (`InvitationRole`) | Add `ACCOUNTANT`; TypeScript then forces `ROLE_HOME_ROUTE` in `services/auth/session.ts`. Add `isFinanceRole()`. |
| Role label | `roleLabelKey` in `src/lib/roles.ts` | Its fallback returns `profile.role_resident` for any unknown role, so an accountant would be labelled "Resident". Add `ACCOUNTANT -> auth.role_accountant` (AR + EN strings). |
| Profile | `(tabs)/profile/index.tsx` `ManagementSection` (shows entries per `role === "MERCHANT"`, `"RESIDENT"`, `isAdminRole`) | Add an accountant branch ("Open Finance"); decide whether accountants also see the resident rows (Q18). |
| Notification prefs | `src/lib/notification-preferences.ts` `NOTIFICATION_TYPES` | Add `FINANCE_UPDATE` (and the missing `LISTING_UPDATE`), see 6.4. |
| Tab confinement (review 3, M5) | `src/app/(tabs)/_layout.tsx`, `src/lib/hooks/use-guest-gate.ts`, `src/lib/listings-access.ts` | Web confines ACCOUNTANT with an allow-list; mobile had only a landing route, so an accountant still saw the `(tabs)` Community tab (polls and elections are `[RESIDENT]`, orders `orders.controller.ts:45,57` exclude ACCOUNTANT) and got 403 error toasts. Fix, reusing the existing pattern: the tab layout's `guestLocked(feature)` listener (which today calls `openComingSoon` only for guests) becomes `lockedFor(feature)` and also fires for `isFinanceRole(role) && !isAdminRole(role)` (i.e. ACCOUNTANT), so the **Community** tab opens the Coming soon sheet; `useGuestGate` gains the same role check (`isLocked = !isAuthenticated \|\| role === 'ACCOUNTANT'`), so the header cart and the shop add-to-cart/cart bar that lead to checkout open the sheet too (`app-header.tsx` and the shop screen already call `useGuestGate`). **Orders** is already `href: null` in the tab bar. **Home and Profile do not go through `useGuestGate` (review 4, N-4; checked read-only on `feature/flat-listings`):** in `components/home/resident-home.tsx` the `QUICK_ACTIONS` tiles with `authRequired: true` (orders, feedback) call `useAuthGuard().requireAuthNavigation` (`:108`, `:235-236`), which only checks sign-in; the others (shops, community, governance with `authRequired: false`, reports) call `router.push` directly (`:237`); the "What's new" "See all" (`:169`) and its announcement cards (`:265`) push `/(tabs)/community...` directly; the grid already filters on an optional `visible?: (role) => boolean` (`:211`, `:228`, used today by the listings tile with `canBrowseListings`). In `(tabs)/profile/index.tsx` `AccountSection` the "My orders" row is a plain `router.push("/(tabs)/orders")` (`:352`). So extending `useGuestGate` changes none of them. **Fix:** in `QUICK_ACTIONS` set `visible: role => role !== 'ACCOUNTANT'` on the **orders, governance, community and reports** tiles; hide the "What's new" **"See all" ("View all")** for ACCOUNTANT with the same predicate (and its announcement cards, which push into the same locked Community stack, where posting a comment would 403 now that ACCOUNTANT gets no comments grant, L-5); in `AccountSection` render the **"My orders"** row only when `role !== 'ACCOUNTANT'` (the same `role === ...` conditional style as the "My flats" and "Saved shops" rows). The shops tile, the listings tile (already hidden by `canBrowseListings`) and the feedback tile and Profile "My feedback" row stay (the backend grants feedback to ACCOUNTANT, row above). Jest cases: `resident-home` renders without the orders, governance, community and reports tiles and without "See all" for ACCOUNTANT and with them for RESIDENT; Profile renders without "My orders" for ACCOUNTANT and with it for RESIDENT (tests outside `src/app/`, per the bundling rule). **Flats** (listings) stays hidden for ACCOUNTANT because `canBrowseListings` admits only RESIDENT and admins. Directory and Profile stay open; the bell and notification preferences stay open (the backend notification routes admit ACCOUNTANT, 8.1). `use-guest-gate.test.ts` gains ACCOUNTANT cases; Phase 1 mobile scope (10). |

**Single-role trap (review).** Because a user has one role, a flat owner promoted to ACCOUNTANT stops being a
RESIDENT: their own-flat statement, resident home and flat features would disappear. Decision: **`/me/finance/*`
authorises by `FlatOwnership`, not by role** (7.7), and the web/mobile resident finance screens are shown to any
signed-in user who has an ownership row, whatever their role. Residents-only features that stay RESIDENT-only
(listings, feedback as resident) are outside this plan. Q18 asks whether to move to a multi-role model; the
recommended default is **no** (out of scope; accountants are normally staff, not owners).

**Careful points**
- **Web lockdown (rewritten after review 2, H8; checked against `apps/web/src/config/access-policy.ts` and
  `apps/web/src/proxy.ts`).** Three facts from the code: (a) `BLOCKED_PAGE_PREFIXES` (`access-policy.ts:32-43`)
  and `BLOCKED_API_PREFIXES` (`:50-59`) are **deny lists** and contain neither `/finance` nor `/api/finance`;
  (b) the proxy `matcher` (`proxy.ts:33-46`) lists page prefixes one by one plus `/api/:path*` and does not list
  `/finance/:path*`, so today the proxy does not even run for a `/finance` page (the `/api/...` BFF paths are
  already covered by `/api/:path*`), and a signed-in resident could open the staff page shells (only the layout
  guard and the backend 403 would stop the data); the proxy body (`:16-30`) also only acts on paths that are in
  a deny list, so it cannot enforce an allow-list as written; (c) `UNRESTRICTED_ROLES` (`:24`) is ADMIN,
  SUPER_ADMIN, MERCHANT, and anything else is confined. The first draft's answer ("add ACCOUNTANT to `UNRESTRICTED_ROLES`") would open
  `/orders`, `/cart`, `/checkout` and the `/merchant` and `/admin` shells to accountants (their backend routes
  exclude ACCOUNTANT, so they would be broken 403 pages), and it never closed the resident hole. Decision:
  1. **Block staff finance for residents.** Add `/finance` to `BLOCKED_PAGE_PREFIXES`, `/api/finance` to
     `BLOCKED_API_PREFIXES`, and `/finance/:path*` to the proxy `matcher`. A resident (restricted role) is then
     redirected to `/home` (pages) or gets 403 JSON (BFF). The resident finance prefixes `/home/finance/*` and
     `/api/me/finance/*` do **not** match (`matches()` requires an exact match or `prefix + "/"`), so they stay
     open; a test pins both directions.
  2. **ACCOUNTANT is NOT added to `UNRESTRICTED_ROLES`.** It gets its own explicit allow-list, a new
     `FINANCE_ROLE_OPEN_PREFIXES`: pages `/finance`, `/home`, `/profile`, **`/notifications`**; BFF
     `/api/finance`, `/api/me/finance`, `/api/auth`, `/api/profile`, `/api/uploads` (avatar),
     **`/api/notifications`**. (Review 3, L3: 8.1 adds ACCOUNTANT to the five backend notification routes so the
     bell, preferences and push token work; the web allow-list now matches, otherwise the web bell would be a
     dead link for accountants.) Everything else is denied for that role, including `/directory`, `/orders`,
     `/cart`, `/checkout`, `/merchant`, `/admin`, `/announcements`. (The accountant is a staff user; the
     community areas are still "Coming soon" for residents too.) The proxy applies the allow-list to every path its matcher covers, so
     `/directory/:path*` is added to the matcher; public marketing pages stay outside the proxy as today.
  3. **Shape of the change.** Export `isFinanceRole(role)` and one function
     `isPathAllowedForRole(role, pathname, kind: 'page' | 'api')`: unrestricted roles true; finance roles true
     only inside `FINANCE_ROLE_OPEN_PREFIXES`; other restricted roles true unless the path is in the deny lists
     (today's behaviour). `proxy.ts` is restructured to read the role first and then call it (today it returns
     early for any path outside the deny lists, `proxy.ts:21`, which would let an accountant open any page the
     matcher happens to cover), and `isOpenToRestricted(href, role)` (used by `GatedLink` in `ComingSoon.tsx:180`,
     `useComingSoon().restricted` comes from `isRestrictedRole(user?.role)` at `:42`) also calls it. **Never add `/finance` to `OPEN_PAGE_PREFIXES`** (`:66`): that list is
     what a *restricted* resident may open.
  4. **MERCHANT, ADMIN, SUPER_ADMIN** stay unrestricted at the proxy (owner decision REV-45); the staff-only
     rule for `/finance` for them is enforced by the layout guard `getFinanceSession()` (accepts
     `isFinanceRole` only, so a MERCHANT is redirected) and by the backend `@AllowedRoles`, exactly as `/admin`
     works today.
  5. **Post-login landing.** `postLoginPath` (`apps/web/src/lib/auth/return-path.ts:67`) falls back to
     `isAdminRole(role) ? '/admin' : DEFAULT_RETURN_PATH`; add `isFinanceRole(role) ? '/finance'`, otherwise an
     accountant lands on the resident home.
  6. **Tests, in `access-policy.test.ts`:** a resident is blocked on `/finance`, `/finance/flats/x`,
     `/api/finance/payments` and not blocked on `/home/finance`, `/home/finance/reports/1`,
     `/api/me/finance/flats`; ACCOUNTANT is allowed on the finance, home, profile and notifications prefixes
     (`/notifications`, `/api/notifications/preferences`) and blocked on
     `/orders`, `/cart`, `/checkout`, `/merchant`, `/admin`, `/directory`, `/api/orders`, `/api/admin/polls`;
     ADMIN, SUPER_ADMIN and MERCHANT behave as before; `isRestrictedRole('ACCOUNTANT')` is true.
- **Resident finance pages live under `/home/finance/*`** (statement: `/home/finance`, receipts:
  `/home/finance/receipt/[id]`, published summaries: `/home/finance/reports` and `/home/finance/reports/[id]`).
  `/home` is already in `OPEN_PAGE_PREFIXES`, so no policy change is needed for the pages. The earlier
  `/home/statement`, `/finance/my` and `/reports/finance` names are dropped. In particular `/reports` and
  `/api/reports` are in the blocked lists (they serve the PDF report library), so a `/reports/finance` page
  would have been blocked for residents.
- **Resident BFF routes:** `/api/me/finance/*` is a **new, separate prefix** from the blocked `/api/reports`
  and `/api/admin`; it must be added to the *open* API list explicitly (`BLOCKED_API_PREFIXES` is a deny
  list, so a new prefix is open by default, and a test pins this).
- **Mobile route collisions.** `route-collisions.test.ts` fails on any new URL collision. See 8.3 for the
  concrete screen paths (the first draft's `(finance)/index` would have collided with `(tabs)/index` on `/`,
  the exact launch bug fixed in `1479c9e`).
- Accountants are **not** admins: they must not reach `/admin/*` (user management, trash, activity log).
  Web `getAdminSession` and mobile `(admin)/_layout.tsx` keep `isAdminRole`, so nothing new leaks.
- Backend regression test: ACCOUNTANT gets 403 on every existing `ADMIN` route (table-driven over the route
  metadata), and ADMIN/SUPER_ADMIN get 200 on finance routes.

### 8.2 Web (desk-first)

New route area `apps/web/src/app/finance/` with its own layout and guard `getFinanceSession()` (mirrors
`getAdminSession`, accepts `isFinanceRole`), left navigation, breadcrumbs, 1440 px tables, Arabic RTL first.
BFF routes under `apps/web/src/app/api/finance/**` forward cookies and the `Idempotency-Key`.

| Route | Purpose | Key features |
|---|---|---|
| `/finance` | Dashboard | This month income / expense / net, fund balance, collection rate, pending approvals (admin), arrears top 10, recent postings, period status banner |
| `/finance/flats` | Flat registry | Search by label, filters (phase, building, "owes", overdue 30/60/90), balance column, CSV export |
| `/finance/flats/[id]` | Flat ledger | Statement table, record payment drawer, add charge, apply credit, owner contact, deposit progress bar, print statement |
| `/finance/payments` | Payments | Filters (date, method, accountant, status), receipt number search, void with reason dialog, attachment viewer |
| `/finance/payments/new` | Record payment | Flat search-as-you-type, amount, method, reference, date, "pay for" auto or tick charges, live allocation preview, attach slip, duplicate-reference warning |
| `/finance/billing` | Billing runs | List with coverage; wizard: pick schedule and period, scope, exclusions/overrides grid, **preview table**, commit confirm dialog showing total |
| `/finance/expenses` | Expenses | Filters (status, category, vendor), create drawer with threshold hint ("needs admin approval above 5,000"), attachment |
| `/finance/approvals` | Approval inbox (admin) | Pending expenses with invoice image, approve / reject with note, bulk approve |
| `/finance/revenues` | Revenues + service sales | Quick entry for parking/gate card/gym, bill to flat or paid now |
| `/finance/vendors` | Vendors | CRUD, spend to date, contract end warnings |
| `/finance/fund` | Maintenance fund | Capital, returns, spent, balance; movements table; add investment income; shortfall suggestion button; adjustment (admin) |
| `/finance/import` | Opening balances | Template download, drop zone, **preview grid** (row status, per-cell errors, row exclude toggles), commit with summary |
| `/finance/reports` | Reports | Report picker, period selector, charts (simple bar and stacked bar, no chart library beyond what web already ships; verify, else CSS bars), CSV export, Publish draft |
| `/finance/published` | Published summaries | Drafts, preview as resident, publish / withdraw / republish (admin) |
| `/finance/periods` | Period close | Month list, checklist, close / reopen |
| `/finance/settings` | Settings (admin) | Approval threshold, categories, fee schedules, fiscal year start |

Resident web (revised after review, all under `/home/finance/*`, see 8.1 for why):

| Route | Purpose |
|---|---|
| `/home/finance` | My statement: own flats (selector when the owner has several), balance, credit, due date, statement lines, print view |
| `/home/finance/receipt/[paymentId]` | Printable receipt for one of my payments (6.3 / Q6) |
| `/home/finance/reports` | Published summaries list |
| `/home/finance/reports/[id]` | Published summary detail with the frozen numbers |

They sit under `/home`, which is already in `OPEN_PAGE_PREFIXES`, so the resident lockdown needs no change for the
pages; the BFF prefix `/api/me/finance/*` is separate from the blocked `/api/reports` and `/api/admin` (8.1). The
push notification and the home sections link here. The staff area `/finance/*` is never opened to residents.

UX rules: tables paginate by cursor, keep filters in the URL, every destructive action is a confirm dialog with
a required reason, amounts are formatted with Western digits (project rule) and a thousands separator, void rows
are struck through, and a yellow "Period closed" lock icon replaces edit buttons.

### 8.3 Mobile (accountant on the go, resident, admin)

Mobile is for **quick actions and lookup**, not heavy reconciliation. Expo Router groups, all JS-only (photos come
from `expo-image-picker`, already installed; no document picker, 5.3).

**Route collision rule (review finding, critical; C1 of review 1 and C2 of review 2).** The mechanism, read from
`apps/mobile/src/lib/route-collisions.test.ts`: every `(group)` folder is stripped from the URL, a file named
`index` adds no segment, and files starting with `_` or `+` are ignored. Two screens with the same resulting URL
fail the test unless the URL is in `KNOWN_COLLISIONS` (today only `/orders` and `/orders/[orderId]`, the merchant
pair), and a second test asserts that `/` is served only by `(tabs)/index.tsx` (that is the launch bug fixed in
`1479c9e`). The first draft's `(finance)/index` would have collided on `/`, and its revision 2 fix (`(finance)/flats`
and `(finance)/fund` as plain URLs) **still collided**: the listings feature already owns `(tabs)/flats/index.tsx`,
`(tabs)/flats/[id].tsx` and `(tabs)/flats/_layout.tsx`, which resolve to `/flats` and `/flats/[id]` (verified in the
route tree on 2026-10-31; they are uncommitted work on branch `feature/flat-listings`). Decision:

1. **Listings own `/flats` and `/flats/[id]`.** Finance never uses those URLs.
2. **Every staff finance screen lives under a literal `finance` folder inside the group**, so its URL starts with
   `/finance/`: files are `app/(finance)/finance/<screen>`. The group `(finance)` supplies only the layout guard.
   Nothing outside this plan can produce a `/finance/...` URL (the only other `finance` folder is the resident one at
   `(tabs)/profile/finance`, whose URL is `/profile/finance/...`).
3. **There is no `index` file anywhere in the finance tree**, so no finance screen can ever claim `/`. The landing
   screen is `(finance)/finance/today`, URL `/finance/today`. (`/finance` itself falls to `+not-found`; nothing links
   to it.)
4. **The test is extended, not relaxed.** `KNOWN_COLLISIONS` stays exactly as it is. A third case asserts that every
   file under `(finance)/` resolves to a URL starting with `/finance/`, and the existing `/` assertion stays. The
   test runs in the mobile gate, so a future `(finance)/flats` fails immediately.

Planned URLs, new and neighbouring (existing rows verified against the current tree; a new row is added to the test
fixture as a snapshot):

| URL | File | Owner of the URL |
|---|---|---|
| `/` | `(tabs)/index.tsx` | Home (existing) |
| `/flats`, `/flats/[id]` | `(tabs)/flats/index.tsx`, `[id].tsx` | **Listings** (existing, uncommitted) |
| `/profile/flats` | `(tabs)/profile/flats.tsx` | My flats (existing) |
| `/profile/listings`, `/profile/listings/new`, `/profile/listings/edit`, `/profile/listings/[id]` | `(tabs)/profile/listings/*` | Listings (existing) |
| `/listings` | `(admin)/listings/index.tsx` | Listings moderation (existing) |
| `/overview`, `/residents`, `/invitations` | `(admin)/*` | Admin (existing) |
| `/dashboard` | `(merchant)/dashboard.tsx` | Merchant (existing) |
| `/finance/today` | `(finance)/finance/today.tsx` | Finance landing (new) |
| `/finance/flats` | `(finance)/finance/flats/index.tsx` | Finance flat search (new) |
| `/finance/flats/[id]` | `(finance)/finance/flats/[id].tsx` | Finance flat ledger (new) |
| `/finance/payment/new` | `(finance)/finance/payment/new.tsx` | Record payment (new) |
| `/finance/expense/new` | `(finance)/finance/expense/new.tsx` | Record expense (new) |
| `/finance/approvals` | `(finance)/finance/approvals.tsx` | Approval inbox, admin only (new) |
| `/finance/fund` | `(finance)/finance/fund.tsx` | Fund tiles (new) |
| `/finance/arrears` | `(finance)/finance/arrears.tsx` | Aging list (new) |
| `/profile/finance` | `(tabs)/profile/finance/index.tsx` | Resident statement (new) |
| `/profile/finance/reports/[id]` | `(tabs)/profile/finance/reports/[id].tsx` | Resident published summary (new; the push deep link, M2) |

| Route group | Role | Screens |
|---|---|---|
| `(finance)/_layout.tsx` | ACCOUNTANT, ADMIN, SUPER_ADMIN | guard like `(admin)/_layout.tsx` (`isAuthenticated`, then `isFinanceRole(role)`, else `Redirect href="/(tabs)"`) |
| `(finance)/finance/today` | finance | Today: balance tiles (collected today, fund, pending approvals), big buttons "Record payment", "Record expense" |
| `(finance)/finance/flats` + `flats/[id]` | finance | Flat search (label with keyboard-friendly building / floor / flat pickers reusing the register-unit options), balance, last 10 lines, overdue badge, call owner button |
| `(finance)/finance/payment/new` | finance | Flat picker, amount, method, reference, photo of slip (camera), submit with idempotency key (sent as the payment `requestKey`, 3.3); success screen shows the receipt number (no share sheet: `expo-sharing` is not installed, 5.3) |
| `(finance)/finance/expense/new` | finance | Category, vendor picker, amount, photo of invoice, status chip shows "Awaiting admin approval" when over threshold or paid from the fund |
| `(finance)/finance/approvals` | ADMIN, SUPER_ADMIN | Pending list, detail with image, approve / reject (a screen-level role check on top of the group guard; the backend is the authority) |
| `(finance)/finance/fund` | finance | Fund tiles and recent movements (read) |
| `(finance)/finance/arrears` | finance | Aging list, filter by building, tap to flat |

Resident (inside the existing `(tabs)/profile` area, no new tab; screens at `(tabs)/profile/finance/index`, URL
`/profile/finance`, and `(tabs)/profile/finance/reports/[id]`, URL `/profile/finance/reports/<id>`, so the URLs are
unique and sit under one `finance` folder, M2): **My statement** (flat selector when the owner has several flats,
balance, credit, due date, lines) and **Financial summaries** (published list, detail with simple bar visuals).
**ACCOUNTANT confinement on mobile (review 3, M5):** the accountant keeps the `(tabs)` shell (Home, Directory,
Profile) but the Community tab, the header cart and the shop cart entries open the Coming soon sheet, the Home
orders, governance, community and reports tiles and "View all" are hidden through `QUICK_ACTIONS` `visible`, the
Profile "My orders" row is hidden (review 4, N-4: Home and Profile do not use `useGuestGate`), and the Flats tab is
hidden (8.1 Mobile, "Tab confinement"); the finance screens above are reached from the landing
`/finance/today` and the Profile "Open Finance" row.

Entry rows on Profile, shown to **any signed-in user who owns a flat, whatever their role** (8.1 single-role trap),
and a badge when a new summary is unread. **One deep-link path everywhere** (6.4 point 4, the router mapping below,
the test): push `{ type: 'FINANCE_UPDATE', data: { reportId } }` opens `/(tabs)/profile/finance/reports/${id}`. It is
wired in the notification router (6.4): add the type to the `NotificationType` union, `NOTIFICATION_TYPES`,
`ID_KEY_BY_TYPE` (`reportId`) and `ROUTE_BY_TYPE` in `services/notifications/routing.ts` (the existing entries there,
for example `LISTING_UPDATE`, which returns `/(tabs)/profile/listings/<id>`, use the same `/(tabs)/profile/...` shape), and
to the separate list in `lib/notification-preferences.ts`. A new `routing.test.ts` case asserts that
`FINANCE_UPDATE` with a `reportId` resolves to that exact path and that a missing `reportId` returns null. The old
names `(tabs)/profile/finance-reports/[id]` and any "finance-reports" wording are dropped. Guest landing is unchanged.

Post-login routing: add `ACCOUNTANT: "/finance/today"` to `ROLE_HOME_ROUTE` in
`apps/mobile/src/services/auth/session.ts:31` (the record is typed on `AuthUser["role"]`, so TypeScript forces the
update once the role is added; today the values are `/(tabs)` for RESIDENT, ADMIN and SUPER_ADMIN and
`/(merchant)/dashboard` for MERCHANT). Use the unique URL, not `"/(finance)"`: a group-only path resolves to the
group's index, which does not exist. Admins keep Home; the admin overview gets a "Finance" row linking to
`/finance/today`. Offline: finance screens are online-only; payment/expense forms show an inline error on failure and
keep the form state (the idempotency key makes retry safe). Cached data is never shown for money screens, except the
resident's last fetched statement marked "as of <time>".

---

## 9. Security and privacy

| Topic | Rule |
|---|---|
| **Resident isolation** | Resident endpoints never trust a client `flatId` on its own: the service resolves the caller's `FlatOwnership` rows (joined to `Flat` through the validated `flatId` FK, not a free-text join, 2.2) and returns 404 (not 403) for any flat the caller has no ownership period on. Visibility is limited to the caller's ownership periods. Tested with two residents, plus a former owner and a new owner of the same flat, plus a user whose role is ACCOUNTANT but who also owns a flat. |
| **Resident line fields** | Resident statements and receipts carry only date, type, description, amount, running balance, receipt number and status. They drop `payerName`, `note`, `reference`, `createdBy`, bank details and attachment info (6.4), enforced by a dedicated response DTO and a test that serialises a fully populated ledger line and asserts the forbidden keys are absent. |
| **ACCOUNTANT scope** | Finance routes only. 403 on `/admin/*`, user management, trash, invitations to ADMIN, listings moderation. Accountant sees owner name and phone for collection (needed for the job) but not email, national id, passport, password data. A dedicated DTO enforces the field list. |
| **Role change** | Only SUPER_ADMIN grants or removes ACCOUNTANT. The user service rejects an accountant editing any role. Removing the role takes effect immediately through the existing session-version check (stale tokens 401). |
| **PII minimisation** | Statements show flat label and amounts, not national id. Published reports have no per-flat data. Exports are audited and contain flat label, owner name and amounts only. |
| **Logging** | Never log amounts with names; logs carry ids. Redact `reference`, bank details and attachment paths in error logs (extend `redact`). |
| **Attachments** | Private bucket, 60 s signed URLs, authorisation check per path, audited. |
| **Rate limits** | See 7.7; plus the existing per-IP throttling. Finance writes are keyed per user. |
| **Finance audit** | Every finance write is audited by `FinanceAuditService` for **every finance role**, inside the same transaction as the change (3.7). The existing `AuditService.record()` ignores non-admins and swallows errors, so it is not used for finance. |
| **Input safety** | Decimal parsing from strings, never floats; CSV/XLSX import is size capped, parsed in memory, formulas are not evaluated; export cells beginning with `= + - @` are prefixed with `'` (CSV injection). |
| **Concurrency** | The fixed lock order of 3.4 on every posting transaction: fiscal period row `FOR SHARE` (close takes it `FOR UPDATE`, 3.2), then the flat row `FOR UPDATE`, then the open charges `FOR UPDATE`, then the receipt counter (upsert-increment). Idempotency keys (`requestKey` unique plus `requestHash`, 3.3) on every create, with a P2002 re-read. (Review 2, L2: the row used to say only "row locks on charges".) |
| **Backups** | The finance tables are included in the existing Supabase `pg_dump` runbook; take a manual dump before the first opening-balance commit. |
| **RLS** | Every new table `ENABLE ROW LEVEL SECURITY` and no policies (backend uses the service connection), per the repo rule. |
| **Privacy policy** | `apps/web/src/content/privacy-policy.ts` (bilingual, linked from the apps) needs a new section: financial data (flat balances, payments, receipt images) is collected, who sees it (management, accountants, the flat's resident), retention (7 years proposed, Q8), and that published summaries are aggregate. Update before the first resident sees a statement and re-check the Play Data Safety form (financial info category). |
| **Deletion** | Account deletion never deletes finance rows (they belong to the flat) but closes the user's ownership periods (see "Account deletion vs ownership" below). The statement keeps flat label only; the account link vanishes. Documented in the policy. |
| **Residents leaving** | A flat's balance remains with the flat (decision 5). The sale no longer erases history: `FlatOwnership` keeps `(flatId, userId, fromDate, toDate)` (2.2). The **seller** keeps read-only access to lines inside their own ownership period; the **new owner** sees only the lines posted inside their own period plus one "Balance brought forward" line, and never the previous owner's individual payments, which are staff-only (owner decision on Q3, review 2 H5). This matches 2.2 and Q3. Whether a clearance certificate is required before transfer is Q16. |
| **Account deletion vs ownership** | Deleting a user never deletes `FlatOwnership`, ledger or payment rows (the delete is a soft delete, `user.service.ts:176-219`; FKs Restrict, 2.6). It **does close the user's open ownership periods** (`toDate` = today in Cairo, `closedReason = ACCOUNT_DELETED`) inside one transaction, so the flat has no phantom current owner and the next owner's period starts cleanly (2.2, 8.1 Delete safety). The user link is anonymised on display ("former owner"). A former owner who deleted their account simply loses access. **Restoring the account** opens a new period from the restore date for every flat whose `ResidentUnit` the user still holds (proof they still own it; a sale meanwhile would have removed the row), so the invariant "open period ⇔ unit exists and user not deleted" holds again (2.2 path 6, review 3 H4). The deletion-to-restore gap is outside every period. A sale while the seller's account is deleted needs path 4 (remove the unit) before the buyer's accept-invitation. |

---

## 10. Phased delivery

Each phase is shippable on its own and ends with: backend gates green (typecheck, lint, tests), web `check`,
mobile type-check and jest, a prod DB backup before the migration, and an owner walkthrough. Sizes assume one
developer working with the orchestration style already used on this repo (implementer plus Opus reviewer per
phase). They are rough, in working days of focused effort.

### Phase 1: Foundations (about 18 to 25 days, re-estimated after review)

Goal: the accountant can load opening balances, bill flats, take payments, and residents see their statement.

Why the estimate grew from the first draft's 10 to 14 days to 18 to 25 (review 3, L4: revision 3 still quoted
the old figures here): the reviews found work the first draft hid. The Flat link needs a
pre-migration diagnostic and normalisation plus `FlatOwnership` written by every ownership path (four existing
writers, the account-delete close, the restore reopen and the M2 unit-key link step, 2.2);
the role ripple touches about a dozen backend, web and mobile files (8.1); the finance audit writer, the
gap-free receipt counter with lock ordering, `Payment.requestKey` idempotency, allocation with dates and void
cascades, cheque states, the import guards and VOIDED batch, the fund opening balance, the resident privacy DTOs and
the table-driven role regression test are each real tasks with concurrency tests. Plan 18 days if nothing
surprising appears in the prod data diagnostic, 25 if several `resident_units` rows need hand fixing.

| Area | Content |
|---|---|
| Migration order | **Two migrations in Phase 1, from the single list in 2.3.1** (names and counts are defined there and must not be restated differently here): (1) `..._accountant_role` (enum only, precedent `20261004000000_super_admin_role`; nothing in the same transaction, seed or default may reference the new value), then (2) `..._finance_foundations`. Phase 2 adds `..._finance_ledgers`; Phase 3 adds `..._finance_update_notification_type` (enum only) and `..._finance_reports`. Five in total. Seeds that need the role run as application code after the migrations, never inside them. All are generated offline with `prisma migrate diff` and hand-reviewed so the partial unique indexes survive (2.2). |
| Migration `..._finance_foundations` | `Flat` (+ seed of 690 flats, asserted), `FlatOwnership` (+ backfill with `fromDate = 1900-01-01` for cut-over owners, abort on `resident_units` collisions), `ResidentUnit.flatId` (nullable FK + normalisation, `RAISE EXCEPTION` assertions) and `Listing.flatId` (nullable FK + normalisation, known-key `RAISE NOTICE` only, never a uniqueness assertion, H3), the `finance_live_payments` view (`security_invoker`, `REVOKE` from `anon`/`authenticated` in a `pg_roles`-guarded `DO $$` block, M3, N-2), `FinanceCategory` (seeded), `FeeSchedule`, `BillingRun`, `Charge`, `Payment` (with `requestKey` unique and `isOpening`), `PaymentAllocation` (with `allocatedAt`, `voidedAt`), `ReceiptCounter`, `FiscalPeriod`, `FinanceSetting`, `ImportBatch/ImportRow` (unique committed flat), **`FundEntry` with `countsInFundTotal`, `holding` and `FundEntryKind.OPENING_BALANCE`** (the fund opening balance is a Phase 1 feature, H1; `expense_id` is added in Phase 2); partial unique indexes; RLS on all |
| Pre-flight (before the migration) | Read-only `apps/backend/prisma/scripts/check-flat-keys.sql` (modelled on `check-email-case.sql`; covers `resident_units`, `resident_leads` and `listings` against the 690 keys, 2.2; `collision_groups` for `resident_units` only, listings and leads report unknown keys and informational active collisions, H3); the migration itself aborts with `RAISE EXCEPTION` on a wrong flat count or any `resident_units` collision (unknown keys only raise a `NOTICE`), so a failed preflight is fixed first (unit-key `PATCH` from a preparatory release, or owner-run SQL, M2), not worked around; prod backup; owner reviews the output. Warn the implementer: `prisma migrate dev` would propose dropping `listings_active_unit_key` and `resident_leads_active_unit_key` (`schema.prisma:189`, `:259`), so no migration is produced by it (2.2) |
| Backend | Role plumbing (8.1 table: guard, `ROLE_RANK`, invitation, role change, notification routes, uploads, `deleteUser` ownership close in a `$transaction` (the open-expense check arrives with Phase 2 expenses; ACCOUNTANT stays out of public self-delete), `restoreUser` reopen in a `$transaction` (H4)), unit-key `PATCH /admin/resident-units/:id` with the "link and open period" step (M2; the key-edit part may ship ahead in a preparatory release), `FinanceAuditService` (3.7), flats + ledger + ownership, the dated "live as of D" helper and view (2.1.1, H1/M3), `credit` and `availableCredit` (M1), charges, payments (allocation with dates, void, `requestKey` idempotency, receipt numbers with flat-then-counter lock order and bulk range reservation, cheque states with the dated bounce line), billing runs (preview/commit/void, explicit transaction timeout), opening-balance import (CSV first, unique committed flat, `createMany` per table, explicit `{ timeout, maxWait }`, VOIDED batch + endpoint, M4) and fund opening balance, period close basics, resident `me/finance` (by ownership, any role) with privacy DTOs, audit actions, i18n `finance.json` (**en only**, the backend has no `ar` folder, Arabic lives in the clients), unit tests for allocation, void cascade, receipt concurrency, resident isolation, audit-in-transaction rollback, role regression table, the ownership invariant and restore (H4), "close October, bounce in November" (H1), the invariant with a pending refund (M1), the view privileges (M3; `security_invoker` always, anon/authenticated assertions only when those roles exist, N-2) and the 1000-row import load test (M4) |
| Private storage | `eastpark-finance` bucket + `PrivateFileService` + signed URLs (needed for payment slips); owner creates the bucket |
| Web | Role + access-policy changes (8.1: `/finance` and `/api/finance` added to the deny lists and `/finance/:path*` to the proxy matcher so residents are blocked; ACCOUNTANT gets its own `FINANCE_ROLE_OPEN_PREFIXES` allow-list (finance, home, profile, notifications, L3) and is **not** added to `UNRESTRICTED_ROLES`; `/finance` never added to `OPEN_PAGE_PREFIXES`; `postLoginPath` sends ACCOUNTANT to `/finance`), `/finance` shell, dashboard (minimal), flats, flat ledger, payments (list + new), billing wizard, import preview, settings (fee schedules, categories), resident `/home/finance` (statement, receipt) |
| Mobile | Role plumbing + routing (`ROLE_HOME_ROUTE` ACCOUNTANT to `/finance/today`, `roleLabelKey`, auth-slice union, Profile branch), **ACCOUNTANT tab confinement** (M5, 8.1 Mobile: Community tab and cart/checkout entries open the Coming soon sheet through the extended `guestLocked`/`useGuestGate` role check; Home `QUICK_ACTIONS` orders, governance, community and reports tiles and "View all" get `visible: role => role !== 'ACCOUNTANT'` and the Profile "My orders" row is hidden for ACCOUNTANT (review 4, N-4); Orders stays `href: null`, Flats stays hidden via `canBrowseListings`; `use-guest-gate.test.ts` ACCOUNTANT cases plus jest cases for the Home tiles and the Profile row), `(finance)` group with every screen under the literal `finance` folder (`(finance)/finance/today` is the landing, **no `index` file**, listings keep `/flats`, 8.3): flat lookup `(finance)/finance/flats`, record payment `(finance)/finance/payment/new` (with photo), resident "My statement" at `(tabs)/profile/finance`; `route-collisions.test.ts` stays green and gains the "everything under `(finance)/` resolves under `/finance/`" case |
| Mobile delivery | Everything is JS. **OTA is enough** if `expo-image-picker` is already in the installed build (it is, `~17.0.11`). The `ACCOUNTANT` role must also ship to the store build's type union, but that is JS only. **No EAS build needed.** Verify that `runtimeVersion` (`appVersion`) matches the installed build before publishing the update. **OTA reaches only builds that contain `expo-updates`** (EAS v11 and later, `a4db141`/`ce9304a`): an older install never receives the update, and an accountant signing in on it falls through the `ROLE_HOME_ROUTE` lookup to Home (the record has no ACCOUNTANT key in that bundle), which is harmless but means that user must install the current build or use the web desk (L6). |
| Owner tasks | Confirm flat count (690), fee amounts, due day; create the private bucket; provide the opening-balance sheet |
| Exit | Opening balances committed in prod, first billing run committed, first receipts issued, resident statement visible to a test resident (and a former-owner case), two-accountant concurrency test passed, 1000-row import load test passed (M4), accountant actions visible in the finance audit feed, an accountant on mobile sees no 403 toast (M5) |

### Phase 2: Expenses, revenues and the maintenance fund (about 12 to 16 days, re-estimated)

| Area | Content |
|---|---|
| Migration `..._finance_ledgers` | The 2.3.1 list, row 3: `Vendor`, `Expense`, `Revenue`, `ServiceItem`, `ServiceSale`; `ALTER TABLE fund_entries ADD COLUMN expense_id` + FK and `ALTER TABLE charges ADD COLUMN service_sale_id` + FK (nullable); `requestKey`/`requestHash` on these tables; RLS; `CREATE OR REPLACE VIEW finance_live_payments` with the refund terms, `security_invoker`, guarded `REVOKE` again (M3, N-2). `FundEntry` and `Payment.isOpening` are **not** here: they ship in Phase 1 (H1), so there is no table rewrite and no second `FundEntry` creation |
| Backend | Expenses with threshold and approval (**payouts from the maintenance fund always need approval**, split warning for same vendor and day, credit reservation while a refund expense is pending, 3.6 / 3.5), vendors, revenues, service sales (charge or paid-now), fund (deposit-in automation, investment income, maintenance-out, adjustments, balance, shortfall suggestion with its own `requestKey`), shortfall run kind, expense attachments, extra audit actions, tests for approval threshold edges, split dodging, fund balance arithmetic, double-refund race, void cascades |
| Web | Expenses, approvals inbox, revenues and services, vendors, fund page, shortfall run in the billing wizard, dashboard tiles for fund and pending, threshold setting |
| Mobile | `(finance)/finance/expense/new` (`/finance/expense/new`), `(finance)/finance/approvals` (admin), `(finance)/finance/fund` (read), `(finance)/finance/arrears`; all four URLs sit under `/finance/` and cannot collide with listings' `/flats` (8.3); `route-collisions.test.ts` stays green |
| Mobile delivery | JS only: OTA. If the owner wants PDF invoice upload from the phone, `expo-document-picker` is a native module and needs an **EAS build**; default is photo-only so no build. |
| Exit | A month of real postings, approval flow tested with an admin account, fund statement agrees with a hand calculation by the accountant |

### Phase 3: Reports, publishing, exports (about 12 to 14 days, re-estimated)

| Area | Content |
|---|---|
| Migrations (2.3.1 rows 4 and 5) | `..._finance_update_notification_type` (enum only, applied first) then `..._finance_reports`: `PublishedReport` (snapshot, `approvalRef`, `notifiedAt`), optional `flat_balance_cache` only if R6 is slow; RLS. **No notification-preference rows**: an absent preference row means enabled (6.4), so there is nothing to seed |
| Backend | Report builders R1-R9 (income on the allocation basis, deposits only in R4, "prepayments held", R3 operating vs fund cash, all through the dated live helper; flow reports book reversals in the month they happen through `flowBuckets`, with the R1/R2/R4/R8 additivity test "R(Oct–Nov) = R(Oct) + R(Nov) before and after a bounce", 6.1, N-1; H1/H2 tests), CSV export (BOM, injection-safe, streamed), published summaries (draft, preview, publish with snapshot, withdraw, republish), notifications through new `NotificationsService.sendMany` (one `createMany`, one user read, push in chunks of 100) run **after** the publish response plus a cron sweeper for `notifiedAt IS NULL` (the existing `send` handles one user per call, so about 700 sequential calls would time out on Render free, 6.4), per-flat PDF statement via **HTML plus print CSS as the primary path** (pdfmake only as an optional spike, its Arabic shaping is weak, 6.3), period close checklist, tests that snapshots do not change after later corrections |
| Web | `/finance/reports` with simple charts, exports, published list and publish flow, period close page, printable flat statement, resident `/home/finance/reports` (list and detail) |
| Mobile | Resident "Financial summaries" list and detail at `(tabs)/profile/finance/index` and `(tabs)/profile/finance/reports/[id]`, push deep link (`FINANCE_UPDATE`, key `reportId`, path `/(tabs)/profile/finance/reports/<id>`, added to both `routing.ts` and `notification-preferences.ts` lists, with a `routing.test.ts` case, 8.3), finance Today tiles for reports link |
| Mobile delivery | JS only: **OTA**. Deep link handling for `FINANCE_UPDATE` is JS in the notification router. Only if a PDF share/save flow is added with a new native module (`expo-sharing`, `expo-file-system` are not installed according to `package.json`) does it need an **EAS build**; default is to open the HTML print view or the single-use backend download ticket (5.2) through the system browser, which needs no new native module (no Supabase signed URL is ever given to a resident). |
| Docs | Privacy policy update shipped with this phase at the latest (sooner if residents see statements in Phase 1: do it in Phase 1) |
| Exit | First published summary with a push to a test group, snapshot immutability test green, owner signs off the wording |

### Cross-cutting, every phase

- Update `apps/backend/CLAUDE.md`, root `CLAUDE.md` status and this plan's checkboxes at the end.
- Keep mobile `eas.json`/`app.config.ts` untouched unless a native module is added; bump `version` only then.
- Ask before every EAS build (existing rule). Run `npx expo export --platform android` before any build request
  (existing gotcha) and keep test files out of `src/app/`.
- Privacy policy: **Phase 1** adds the finance section because residents see statements from the first release.
- **Total: about 45 to 55 working days across three releases** (Phase 1: 18 to 25, Phase 2: 12 to 16, Phase 3:
  12 to 14, plus about 3 days for cross-cutting docs, privacy policy and owner walkthroughs). The first draft said
  26 to 35; the reviewer's re-estimate is adopted because Phase 1 hid the Flat/ownership link, the role ripple,
  the audit writer and the import/receipt/idempotency guards. If the owner wants a smaller first release, cut
  scope by phase, not by skipping the guards (see Q21).

---

## 11. Open questions for the owner

Only items not already decided. Each has a recommended default; if the owner says nothing, the default is used.

| # | Question | Recommended default |
|---|---|---|
| Q1 | **Flat count.** The compound config yields 690 flats (phases 1 and 4: 330, phases 2 and 3: 360 including ground floor). Is that right, and are any flats combined, commercial or not delivered? | Seed all 690 as active; the accountant deactivates exceptions. |
| Q2 | **Fiscal year start.** | January (calendar year). Receipt numbers restart each January. |
| Q3 | **History for a new owner.** When a flat is sold, may the new owner see charges and payments from before they owned it? | **No (owner decision, review 2 H5).** The new owner sees only the lines posted inside their own ownership period, plus one "Balance brought forward" line that carries the inherited balance as a single number. The previous owner's individual payments and charges are staff-only. This is what 2.2, 6.4 and 9 implement; the earlier default ("Yes, full history") contradicted them and would have leaked the seller's payment history if the owner stayed silent. Staff can still explain a disputed brought-forward figure from the full ledger. |
| Q4 | **Who can void.** | Accountant: own entries, **same calendar day**, period still open (one rule, 3.6). Admin: any entry in an open period. SUPER_ADMIN reopens closed periods. |
| Q5 | **Approval threshold value** and whether the threshold applies per expense or per vendor per month. | Per expense, starting at 5,000 EGP; admin changes it in Settings. |
| Q6 | **Receipt PDF for residents.** Should a resident be able to download or share a receipt for each payment? | Yes, a generated PDF of the payment (no attachment images), Phase 3. Until then a printable web view. |
| Q7 | **Payment methods** to offer. | Cash, bank transfer, InstaPay, cheque. Reference required for transfer and InstaPay. |
| Q8 | **Retention** of financial records and attachments. | Keep 7 years, then archive; state it in the privacy policy. |
| Q9 | **Shortfall split.** Equal per flat, or weighted by flat area? | Equal per flat (v1 `shareWeight = 1`); area-based needs flat sizes the compound may not have yet. |
| Q10 | **Accounts.** Who are the first accountants, do they use personal or shared accounts? | One personal account each (audit trail needs names); no shared logins. |
| Q11 | **Due date rule** for the service charge. | Due on the 10th of the first month of the billing period; overdue days count from then. Applies to whatever frequency Q20 settles. |
| Q12 | **Currency display** and numerals. | EGP, Western digits in both languages (project rule), thousands separator `,`. |
| Q13 | **Resident reminders.** May staff send a push reminder about an overdue balance? | Staff-triggered only, one per flat per 7 days, polite wording reviewed by the owner. Never automatic. |
| Q14 | **Deposit refund edge case.** Deposits are non-refundable; is there any exception (compound handover, dispute)? | None in v1; an admin `ADJUSTMENT` with a reason covers a one-off exception. |
| Q15 | **Opening receipts.** Should opening-balance payments take normal receipt numbers or a separate `O-` series? | Separate `O-` series (they are not real receipts), excluded from the gap-free `R` sequence. |
| Q16 | **Clearance before transfer (براءة ذمة).** When a flat is sold, must the seller settle all arrears and obtain a clearance certificate from management before the transfer is recorded? In Egypt arrears are usually settled at transfer. | Yes as a **warning, not a hard block**: removing or transferring an owner whose flat balance is not zero shows the balance and requires an admin reason; the balance stays with the flat either way (decision 5). The same warning shows when an admin **approves a SELL listing** for a flat with a non-zero balance (works because `Listing.flatId` links the two, 2.2; a listing whose key did not match a flat has `flatId` null and shows no warning, never a wrong one). A hard block can be turned on in Settings later. |
| Q17 | **Who legally holds the maintenance-deposit fund** (the developer, or the occupants' union under Law 119/2008)? This decides whose name is on the bank account, who may approve fund payouts and who must receive published statements. | Keep the system neutral: the fund is a ledger with its own opening balance (cash plus investments) and every payout needs admin approval. The owner confirms the holder before the first published summary; wording on resident screens says "maintenance fund" without naming a holder until then. |
| Q18 | **One person, two roles.** A flat owner who becomes ACCOUNTANT stops being RESIDENT (one role per user). Should we move to multiple roles? | No (out of scope). `me/finance` works for any role through `FlatOwnership`, so an accountant who owns a flat still sees their own statement. Accountants are normally staff, not owners. |
| Q19 | **Approval of published summaries.** Must a financial summary be approved by the union or general assembly before publication? | Optional `approvalRef` note on publish (not mandatory in v1); the owner can switch it to mandatory in Settings once the union process is defined. |
| Q20 | **Service-charge frequency.** Monthly, quarterly or annual? Egyptian compounds often bill quarterly or annually. | Monthly schedule shipped, but `FeeSchedule.frequency` supports MONTHLY, QUARTERLY and ANNUAL from day one (period key `YYYY-MM`, `YYYY-Qn`, `YYYY`) so changing later needs no migration. |
| Q21 | **Release scope.** Phase 1 is now 18 to 25 days and the whole plan 45 to 55. Ship a smaller first release? | Keep Phase 1 as written but split it into 1a (flats, ownership, role plumbing, payments, receipts, audit) and 1b (billing runs, opening-balance import, resident statement) if the owner wants a first demo sooner. Never ship without the audit writer, idempotency or period-lock guards. |

---

## Appendix A. Assumptions and verified facts

| Fact | Source |
|---|---|
| 12 buildings A1 B1 C1, A2 B2 C2, D1 E1 F1, C3 E2 F2; ground floor only in phases 2 and 3; floors 1 to 11; flats 1 to 5 | `apps/web/src/config/compound.ts` (`PHASES`, `BUILDINGS`, `FLOOR_RANGE`, `FLAT_RANGE`) |
| Backend does not validate buildings (free string) | Same file, comment on `isValidFloorForBuilding` |
| Roles today: GUEST, RESIDENT, MERCHANT, ADMIN, SUPER_ADMIN; SUPER_ADMIN satisfies ADMIN only | `apps/backend/prisma/schema.prisma`, `src/common/auth/utils/roles.ts` |
| Flat label `building-floor-flatNumber` | `src/common/helper/utils/unit-label.ts` |
| `ResidentUnit` unique on building+floor+flatNumber, user FK Restrict | `schema.prisma` |
| Uploads return public URLs from the public bucket | `src/common/file/services/files.service.ts`, `src/common/file/storage-url.ts` |
| Money helpers exist (`toDecimal`, `toMoneyNumber`) | `src/common/helper/money.ts` |
| Web resident lockdown treats non-ADMIN/SUPER_ADMIN/MERCHANT roles as restricted | `apps/web/src/config/access-policy.ts` |
| Mobile post-login routing keyed by role | `apps/mobile/src/services/auth/session.ts` |
| `expo-image-picker` installed; `expo-document-picker`, `expo-sharing`, `expo-file-system` not in `package.json` | `apps/mobile/package.json` |
| Notifications: persisted in-app record plus Expo push, per-type preferences | `src/modules/notifications/notifications.service.ts` |
| `AuditService.record()` returns early for non-admin actors and swallows its own errors, so finance needs its own in-transaction writer | `src/modules/audit/audit.service.ts` |
| `NotificationsService.send` handles one user per call (no batching), so fan-out needs `sendMany` | `src/modules/notifications/notifications.service.ts` |
| `ResidentUnit` rows are hard-deleted on sale; text columns are free-form | `src/modules/units/resident-units.service.ts` (`deleteMany`), `residents/dtos/request/resident-lead.create.dto.ts` |
| Invite rank map is `Record<Role, number>` and must gain a key | `src/common/auth/services/auth.service.ts` (`ROLE_RANK`) |
| Mobile notification routing matches enum names and per-type id keys; preferences have a separate type list | `apps/mobile/src/services/notifications/routing.ts`, `src/lib/notification-preferences.ts` |
| Mobile route-collision test allows only `/orders` and `/orders/[orderId]` | `apps/mobile/src/lib/route-collisions.test.ts` |
| `/reports` and `/api/reports` are blocked for residents; `/home` is open | `apps/web/src/config/access-policy.ts` |
| Backend language folder is `en` only | `apps/backend/src/languages/` |
| Listings already own the mobile URLs `/flats` and `/flats/[id]` (uncommitted, branch `feature/flat-listings`); finance screens therefore live under `/finance/...` | `apps/mobile/src/app/(tabs)/flats/{_layout,index,[id]}.tsx` |
| Collision rule: `(group)` folders are stripped, `index` adds no segment, files starting `_` or `+` are ignored; only `/orders` and `/orders/[orderId]` may collide; `/` must be served only by `(tabs)/index.tsx` | `apps/mobile/src/lib/route-collisions.test.ts` (`collectUrls`, `KNOWN_COLLISIONS`) |
| `ROLE_HOME_ROUTE` is typed `Record<AuthUser["role"], string>` and today maps RESIDENT, ADMIN, SUPER_ADMIN to `/(tabs)` and MERCHANT to `/(merchant)/dashboard` | `apps/mobile/src/services/auth/session.ts:31` |
| Two partial unique indexes exist only in migrations and Prisma proposes dropping them (`migrate dev` is unsafe): `listings_active_unit_key` and `resident_leads_active_unit_key` | warning comments at `apps/backend/prisma/schema.prisma:189` and `:259`; migration `20261031000000_flat_listings` |
| `UserService.deleteUser` is a **soft delete** (a plain `db.user.update` setting `deletedAt`, `deletedById`, `pushToken: null`, no transaction; session `bump` before and after) and refuses to delete a merchant who owns a live shop; it is reached by the public `DELETE /user` (`[RESIDENT, MERCHANT]`) and the SUPER_ADMIN-only `DELETE /admin/user/:id` | `apps/backend/src/modules/user/services/user.service.ts:176-219`, `controllers/user.public.controller.ts:62-63`, `controllers/user.admin.controller.ts:89-90` |
| Web access policy is two **deny lists** (`BLOCKED_PAGE_PREFIXES`, `BLOCKED_API_PREFIXES`; neither contains `/finance`) plus one **open list** for restricted roles (`OPEN_PAGE_PREFIXES` = `/home`, `/profile`, `/directory`); `UNRESTRICTED_ROLES` = ADMIN, SUPER_ADMIN, MERCHANT; `matches()` needs an exact match or `prefix + "/"` | `apps/web/src/config/access-policy.ts:24,32-59,66` |
| The proxy `matcher` lists page prefixes individually plus `/api/:path*`; a new page prefix such as `/finance/:path*` must be added by hand, and the proxy body returns early for any path outside the deny lists | `apps/web/src/proxy.ts:16-46` |
| `postLoginPath` falls back to `/admin` for admins and the resident home for everyone else | `apps/web/src/lib/auth/return-path.ts:66-70` |
| `GatedLink` and `useComingSoon` decide "restricted" from `isRestrictedRole` and gate with `isOpenToRestricted(href)` | `apps/web/src/lib/access/ComingSoon.tsx:42,180` |
| `expo-image-manipulator` is not installed; avatars use only `quality` 0.7 to 0.8 | `apps/mobile/package.json`, `profile/edit.tsx`, `feedback/new.tsx` |
| A `Report` model and `/reports` module already exist (finance uses `PublishedReport`, `/finance/*`, `/me/finance/*`) | `schema.prisma`, `src/modules/reports/` |

Items to re-verify at implementation time: whether `xlsx`/`exceljs` and `csv-parse` fit the Render free memory
limit (512 MB) for a 1000-row file (they do in principle), the `pdfmake` Arabic shaping result, and that the
Supabase free storage quota still covers a second bucket.

