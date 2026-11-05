# Accounting slice 6 review (finance kernel)

- Commits: `37cf341` (web privacy policy), `cd3a31f` (backend finance kernel). Diff `edd16a2..cd3a31f`.
- Date: 2026-11-02. Reviewer: independent (read-only, no code changed).

Checked and found sound: lock order (period FOR SHARE → flat FOR UPDATE → charges FOR UPDATE by id → counter)
in create and void; the period lock really blocks a close under READ COMMITTED (FOR SHARE vs FOR UPDATE, and a
posting that starts during a close re-reads the updated row and sees CLOSED); the receipt counter is one
upsert-increment inside the posting transaction (gap-free under rollback and concurrency, bulk range correct);
no float maths on money (Decimal throughout, `toMoneyNumber` only at the edge); the finance audit row is
written on the tx client, one per posting, never swallowed; void rules match 3.1/3.6 (own entry + same Cairo
day for ACCOUNTANT, any for ADMIN/SUPER_ADMIN, period checked for the charge's accrual month and today's month
for every role); `cairoDayStart` is right across both Egyptian DST switches; every `/finance` route is
exactly `[ACCOUNTANT, ADMIN]`, no `/admin` route admits ACCOUNTANT; `/finance/audit` cannot be widened to
non-finance actions (`@IsIn(FINANCE_AUDIT_ACTIONS)`), the only other audit reader is `/admin/activity`
(admin-only, finance hidden by default); no finance DTO or mapper carries email, national id or passport;
all `finance.error.*` keys exist in `en/finance.json`.

Judgement: `POST /finance/charges` without idempotency is **acceptable** for Phase 1. The plan scopes
idempotency to payments, billing runs, expenses, revenues and fund entries; a duplicated manual charge has no
receipt number, is visible on the flat, and the poster can void it the same day. Revisit if the mobile desk
adds automatic retries on charge creation.

## Findings

### M1. Live allocations ignore whether their charge is live, so the invariant breaks
- **Where:** `apps/backend/src/modules/finance/kernel/live-predicates.ts:59` (`liveAllocationWhere`),
  used by `kernel/ledger.ts` (`summariseFlats`: `credit = paid − allocatedByFlat`, but `openAmount` only
  subtracts allocations of charges that are live as of D).
- **Problem:** a charge is live only from its `accrualPeriod` month (`liveChargeWhere`), yet an allocation
  to it counts in `credit` as soon as `allocatedAt <= D`. `POST /finance/charges` accepts any future
  `accrualPeriod`, and plan 3.3 explicitly supports paying a deposit instalment ahead ("Explicit allocation").
- **Failing scenario:** deposit instalment charge 1,000 with `accrualPeriod = 2026-12`; on 2026-11-05 a
  1,000 payment is allocated to it. As of today (November): charged 0, paid 1,000 → `balance = −1,000`;
  `credit = 1,000 − 1,000 = 0`; `openAmount = 0`. `balance (−1,000) ≠ open − credit (0)`. The flat list shows
  a −1,000 balance with zero credit; R5 (balance) and R6 (allocation aging) disagree, which is exactly what
  §2.1.1 exists to prevent. Same class of break later when an allocation outlives its payment's liveness
  (a cheque `bouncedAt` dated before the allocation void's `voidedAt`).
- **Fix:** make a live allocation require a live charge and a live payment as of D
  (`charge: liveChargeWhere(D), payment: livePaymentWhere(D)` inside `liveAllocationWhere`), or forbid
  allocations to a charge whose accrual month has not started and refuse future-accrual charges. Add an
  invariant fixture with a future-accrual allocated charge to `finance-kernel.spec`.

### M2. A billing-run charge can be voided on its own (half-voided run, ADMIN rule bypassed)
- **Where:** `apps/backend/src/modules/finance/finance-charges.service.ts:146` (void path; no `billingRunId` check).
- **Problem:** plan 3.1 says a run is voided as a whole, never partially, and 3.6 makes "void billing run"
  ADMIN-only; plan line 935 says `Charge.billingRunId` is Restrict, "void the run instead". The charge void
  route never looks at `billingRunId`, and this is the pattern slice 8 will inherit.
- **Failing scenario:** the accountant who committed the November run voids 300 of its charges one by one
  through `POST /finance/charges/:id/void` the same day (allowed: own entry, same Cairo day). The run stays
  POSTED with half its charges VOID, which neither the ADMIN-only run void nor `hasPaidCharges` controls.
- **Fix:** select `billingRunId` and refuse with 409 (e.g. `finance.error.voidRunInstead`) when it is set,
  or at least restrict it to admins; add a unit test.

### L1. JSON-number amounts can still be silently rounded
- **Where:** `kernel/finance-money.ts:18`.
- **Problem/scenario:** body `{"amount": 100.000000000000001}` is parsed by `JSON.parse` to `100` before
  the service sees it, so it is accepted as 100.00 instead of `amountPrecision`; the comment "the stored
  number is the typed one" is not true for >15 significant digits. Harmless for human typing, but it is the
  pattern every money route copies.
- **Fix:** document strings as the canonical form and have the web/mobile clients send strings; optionally
  reject numbers with more than 15 significant digits.

### L2. Unknown cursor on `GET /finance/flats` silently restarts at page 1
- **Where:** `finance-flats.service.ts:74` (`findIndex(...) + 1` gives 0 for a missing id).
- **Scenario:** a cursor flat that no longer matches the filter (e.g. `q` changed, or the cursor came from a
  filtered list) returns the first page again; an infinite-scroll client loops/duplicates rows.
- **Fix:** 400 `finance.error.invalidCursor` when the cursor is not found.

### L3. Charges can be posted into any month, creating OPEN period rows anywhere
- **Where:** `finance-charges.service.ts:49` (`lockPeriods(tx, [accrualPeriod])` upserts the row).
- **Scenario:** `accrualPeriod: "2019-03"` (before go-live, opening balances should cover it) or `"2099-12"`
  is accepted; the pre-go-live month gets an OPEN row and a charge that changes the brought-forward figure
  the opening import is meant to own.
- **Fix:** bound `accrualPeriod`/`dueDate` to `[month of finance.goLiveAt, current month + N]`.

### L4. A voided charge can be "replaced" many times
- **Where:** `finance-charges.service.ts:54`.
- **Scenario:** two corrections both carry `replacesId = X`; nothing locks X or checks `replacedBy`, so the
  void-and-re-enter chain forks and the flat is double-charged with both looking like "the" correction.
- **Fix:** lock X (it is a charge: `lockCharges`) and refuse when a live charge already replaces it.

### L5. Idempotency hash is body-only and type-sensitive
- **Where:** `kernel/idempotency.ts:45`.
- **Scenario:** a retry that re-serialises `450` as `"450"` (or `450.0`) gets `idempotencyConflict` for the
  same posting; and a key reused by another user replays the first user's receipt to them.
- **Fix:** hash the parsed, normalised values (amount as 2-dp string, dates as `YYYY-MM-DD`) plus the actor id,
  or scope the lookup to `createdById`.

### L6. Test gaps
- The "forced audit failure rolls the posting back" tests (`finance-charges.service.spec.ts:199`, `:403`)
  run on a fake transaction, so they prove only that the fake discards writes. Add a db-spec that forces the
  audit insert to fail (e.g. actor id with no user row → FK error) and asserts no charge row and an unchanged
  counter. The period-lock and counter db-specs are good: a missing `FOR SHARE` or a SEQUENCE-style counter
  would fail them. Missing: two postings racing to create the same new period row, and a void racing a create
  on the same flat (lock-order/deadlock smoke).

### L7. Privacy policy wording vs code
- **Where:** `apps/web/src/content/privacy-policy.ts:75`, `:138`, `:148` (and AR `:258`, `:321`, `:331`).
- AR/EN meaning matches item for item; listings disclosure matches `BROWSE_ROLES` (RESIDENT, ADMIN,
  SUPER_ADMIN) and admin review. Private slip storage, 60-second links and `ATTACHMENT_VIEWED` audit are
  described as fact but arrive in slice 7; acceptable only because no slip can be uploaded yet. Slice 7 must
  implement exactly 60 s and audit every open, or this text must change before it ships.
- "A finance entry is never edited" overstates plan 3.1, which allows audited edits of `note`, `reference`
  and `attachmentPath`; say "amounts, dates and flats are never edited".
- "They then show you as a former owner": `GET /finance/flats/:id/ownership` hides a deleted owner's name
  (`ownerName: null`); say "as a deleted former owner" or similar.
- Related: `audit.actions.ts:133` gives `"Sara (sara@x.com)"` as the label example; later finance writers
  copying it would put emails in `/finance/audit` meta visible to accountants. Add "no email in finance meta"
  next to `FinanceAuditService` and a test that finance meta keys are whitelisted.

## Verdict

No High findings. The kernel's concurrency core (period lock, counter, audit atomicity, lock order) is correct
and well tested at DB level. Fix M1 (predicate/invariant) before slice 7 builds allocations on it, and M2
before billing runs (slice 8). Lows can ride along.

## Resolution (2026-11-02, implementer)

| ID | Status | What changed |
|---|---|---|
| M1 | Fixed | `liveAllocationWhere(D)` now also requires `charge: liveChargeWhere(D)` and `payment: livePaymentWhere(D)`; `summariseFlats` combines it with the flat filter through `AND`. New `test/modules/finance-ledger-invariant.spec.ts` evaluates the real Prisma `where` objects over an in-memory ledger and checks `balance = open − credit` and `credit >= 0` on 70 consecutive dates for: the review's future-accrual deposit (accrual 2026-12, paid and allocated 2026-11-05), a cheque bounced on 10 Nov whose allocation void is stamped 12 Nov, and a voided charge with a voided payment |
| M2 | Fixed | Charge void refuses `billingRunId` with 409 `finance.error.voidRunInstead` for every role (ACCOUNTANT, ADMIN, SUPER_ADMIN tested) |
| L1 | Fixed (doc) | `finance-money.ts` documents decimal strings as the canonical amount form; no behaviour change |
| L2 | Fixed | Unknown cursor on `GET /finance/flats` is 400 `finance.error.invalidCursor` (test) |
| L3 | Fixed | `accrualPeriod` (and the dueDate-derived default) must lie in [Cairo month of `finance.goLiveAt`, current Cairo month + 12], else 400 `finance.error.periodOutOfRange`, checked before the transaction; without go-live only the upper bound applies (tests). `shiftPeriod`/`periodIndex` moved to `cairo-date.ts` |
| L4 | Fixed | With `replacesId`, the original is locked with `lockCharges` after the flat (lock-order step 2) and a POSTED charge already replacing it is 409 `finance.error.alreadyReplaced`; a voided correction does not block (tests) |
| L5 | Fixed | `requestHashOf(actorId, request)` hashes the actor plus the normalised request (Decimal as 2-dp string, Date as `YYYY-MM-DD`, keys sorted): `450` and `"450.00"` match, another user's reuse of a key is `idempotencyConflict` (tests) |
| L6 | Fixed | `test/db/finance-kernel.db-spec.ts` adds: a real audit insert failing on its FK (missing user) rolls back the charge and the new period row; the same rolls back a reserved receipt number; four postings racing to create one new period row all commit with one row; a void and a create racing on the same flat finish in 5 rounds. Existing period specs now use months inside the L3 bounds. They compile and skip without `TEST_DATABASE_URL` (to run at gate G1) |
| L7 | Fixed | Backend: `FinanceAuditService` comment forbids email, national id, passport and phone in finance meta; unit tests assert the create and void meta contain no `@` and no such keys. Policy wording: fixed in web by the orchestrator |

Gates (apps/backend): `prisma validate` valid; `tsc -p tsconfig.json` 0; `tsc -p tsconfig.test.json` 21 (baseline,
no new errors); `eslint src test --quiet` 0; `jest --config test/jest.json` 53 suites, 953 passed.
