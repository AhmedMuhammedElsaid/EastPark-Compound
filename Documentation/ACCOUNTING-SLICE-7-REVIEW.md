# Accounting slice 7 review â€” payments and private attachments

- Commit: `52cf951` (diff `9b77982..52cf951`), branch `feature/accounting`
- Date: 2026-11-02
- Scope: `finance-payments.service.ts`, `kernel/allocation.ts`, `kernel/fund-deposits.ts`,
  `finance-attachments.service.ts`, `private-file.service.ts`, `storage-url.ts`, logging/redaction, controller roles,
  `test/db/finance-payments.db-spec.ts`.

Checked and fine: lock order (period â†’ flat â†’ charges â†’ R counter â†’ F counter) in create/void/bounce/apply-credit;
receipt counter is a rolled-back upsert (gap-free); auto allocation skips deposits, explicit allocation caps per
charge and per payment; void cascade (allocations + DEPOSIT_IN entries, same `voidedAt`); bounce voids as of
`cairoDayStart(bouncedAt)` and locks only the bounce month (close October, bounce November works); charge void still
refuses live allocations, so `voidedAt: null` sums stay correct; apply-credit dated today and capped by
`min(unallocated, availableCredit)`; balance = open âˆ’ credit holds via the shared predicates; all routes
`[ACCOUNTANT, ADMIN]`; signed URL only for a path stored on a payment row, audited before issue, 60 s TTL, private
bucket checked (`getBucket().public`), boot check refuses empty/equal bucket; no email/national id/passport, payer
name or reference in audit meta; URL redaction only rewrites finance query strings (other logs unchanged).

## Findings

### M1 â€” Same-key race returns a business 409 instead of the original receipt
`finance-payments.service.ts:262-292` (+ `kernel/idempotency.ts` `runIdempotent`). The loser of a same-key race
only reaches the `requestKey` insert (P2002 â†’ re-read) if every check before it still passes. It waits on the flat
lock, then sees the winner's committed rows (READ COMMITTED) and fails earlier with `duplicateReference` (any
payment with a `reference`, i.e. every cheque/transfer/InstaPay), `allocationExceedsCharge` (explicit allocation
of the full open amount) or `attachmentInUse`. Scenario: double-tap "Record cheque" with one Idempotency-Key â†’
first request R-2026-000123, second gets 409 `duplicateReference`; a client retry after a dropped response is fine
(find hits first), but the parallel case violates plan 3.3 "loser returns the winner's row". The db-spec race test
uses CASH without reference and auto allocation, so it never exercises this.
Fix: inside the transaction, right after `lockFlat`, re-read `payment.findUnique({ where: { requestKey } })` and
throw a sentinel that `runIdempotent` turns into `replay(winner)`; or in `runIdempotent` catch any error, re-`find()`
and replay if a row exists. Add db-spec cases with `reference` and with explicit allocations.

### M2 â€” A promoted staging path can be attached again, leaving a dangling slip
`finance-payments.service.ts:262-270` and `promoteAttachment` (`:939-960`). The "in use" guard counts rows whose
`attachmentPath` equals the staging path. After the first payment is promoted its row says
`receipts/<year>/<receiptNo>/x.jpg` and the staging object is deleted, so the count is 0 again. Scenario: the
accountant uploads one slip, records payment A (promoted), then records payment B (another flat, or a replacement)
re-sending the same `staging/<me>/â€¦` path within 20 h â†’ B is accepted, its promotion's `copy` fails (source gone),
B keeps a staging path to a non-existent object forever (the sweep never lists it) and its signed URL 404s at
storage. Same result for two concurrent payments on different flats (different flat locks, no unique column).
Fix (no migration): before accepting, check the staging object still exists (`list`/`info` in the private bucket),
or derive the guard from the file name: refuse when any payment's `attachmentPath` ends with the same
`<ms>-<uuid>.<ext>` file name (`endsWith` query); for the concurrent case take a transaction advisory lock on the
path hash (`pg_advisory_xact_lock(hashtext(path))`) before the count.

### M3 â€” Back-dated cheque bounce locks only the bounce month
`finance-payments.service.ts:637-724` (`changeChequeState`). The bounce changes every figure from `bouncedAt` to
today and voids the cheque's live allocations, but only `periodOf(date)` is locked. Plan 3.2 forbids voiding a row
whose `allocatedAt` is in a closed month and requires closed months to stay unchanged. Scenarios: (a) cheque
received 25 Oct, October left open (pending cheque on the checklist), November closed and published; bounce dated
30 Oct â†’ November's as-of balances/R5/R6 change. (b) `apply-credit` on 5 Nov drew on the cheque; bounce dated 30 Oct
voids the 5 Nov allocation with `voidedAt` before its `allocatedAt` (a reversal dated before the event it reverses;
flow reports per N-1 count it in the wrong bucket) and, if November is closed, voids a closed-month allocation.
Fix: lock (FOR SHARE, ascending) every period from `periodOf(date)` to `cairoPeriod(now)` plus each live
allocation's `periodOf(allocatedAt)`, refusing `periodClosed` if any is closed; also refuse a bounce date earlier
than the latest live allocation's `allocatedAt` (`dateBeforeAllocation`). Same period range for `cheque-cleared`
if R3 is computed by `clearedAt`.

### L1 â€” apply-credit has no idempotency (acceptable, cheap guard advised)
`finance-payments.service.ts:776-925`. Plan 7.2 does not require a key and a retry cannot create or destroy money:
apply-credit lowers open and credit by the same amount, so balance = open âˆ’ credit holds. The harm is intent: a
retry after a dropped response with `amount: 500` applies another 500 to the next oldest charges (or settles a
deposit with `payFor: DEPOSIT`). Acceptable for Phase 1A. Migration-free guard: have the client send the
`availableCredit` it displayed (`expectedCredit`) and refuse with `finance.error.creditChanged` when
`before.availableCredit` differs; a replay then fails instead of allocating twice.

### L2 â€” Late period lock in payment void can deadlock with a period close
`finance-payments.service.ts:542-547`. The "missing" periods are locked FOR SHARE after the flat row is held. If a
close is already queued FOR UPDATE on that period behind another posting that waits for this flat, Postgres queues
the void's FOR SHARE behind the close â†’ cycle, `40P01` (500 to the user, nothing committed). Needs apply-credit in a
new month between the pre-read and the lock, so rare. Fix: on `missing.length > 0` throw a retryable internal
error and re-run the whole transaction with the enlarged period set (period locks first, as plan 3.4 requires).

### L3 â€” Private-bucket check is cached for the process lifetime
`private-file.service.ts:236-256`. `verified = true` is never reset, so a bucket switched to public after the first
check keeps receiving slips until restart. Signed URLs still work, but objects would also be publicly readable,
contrary to privacy policy section 7. Fix: re-check every N minutes (e.g. 10) or on each upload (one cheap call).

### L4 â€” Sweep/promotion order can delete the promoted copy in one edge
`finance-payments.service.ts:950-955`. If `copy` succeeds but `updateMany` matches 0 rows (another promotion won),
the code removes `to`, the same object the winner's row now names when both used the identical destination and
the copy API overwrote it. Supabase `copy` does not upsert by default, so today the second copy fails first; keep it
that way explicitly (comment/test) or remove `to` only when it differs from the row's current path.

### L5 â€” Tests do not pin the risky paths
`test/db/finance-payments.db-spec.ts` covers same-key race (CASH, no reference), two accountants, void cascade and
close-then-bounce. Missing: same-key race with reference/explicit allocation (M1), receipt numbers consecutive
after a rolled-back posting, back-dated bounce across months (M3), attachment reuse after promotion (M2; the
storage fake always returns `true`). Unit specs use the in-memory ledger mock and cannot catch lock or race bugs.

## Verdict

No High findings. Money math, void/bounce cascades, period locks for normal dates, roles, private storage and
redaction are sound. Fix M1 (idempotent race replay), M2 (attachment reuse) and M3 (bounce period range) before
merge; the Lows can follow.

## Resolution (2026-11-02, implementer)

| ID | Status | What changed |
|---|---|---|
| M1 | Fixed | Generic kernel guard `assertRequestKeyFree(find)` + sentinel `RequestKeyTaken` (`kernel/idempotency.ts`); `runIdempotent` treats it like P2002 (re-read → replay, or `idempotencyConflict` for another body). Payment create calls it right after `lockFlat`, before every business check. Unit: parallel same key with a cheque reference + full explicit allocation → one row, equal responses; same key other body → `idempotencyConflict`. db-spec: same race on real Postgres |
| M2 | Fixed | Before posting, `PrivateFileService.exists(path)` must confirm the staged object (else 400 `attachmentMissing`). In the tx, after the flat lock, `lockAttachment` takes `pg_advisory_xact_lock(hashtext('finance-attachment:<file>'))` and refuses (409 `attachmentInUse`) any payment whose `attachmentPath` ends with `/<file>` (catches promoted rows). Unit: missing object; re-attach after promotion; advisory lock logged. db-spec: two concurrent payments, one path → one wins |
| M3 | Fixed | Cheque cleared/bounced lock FOR SHARE every month from `periodOf(date)` to the current Cairo month (`periodRange`), plus each live allocation's month when it is in/after `date`'s month (inside that range); any closed → `periodClosed`. A bounce dated before a live allocation's `allocatedAt` → 409 `dateBeforeAllocation`. **Deviation from the review text:** allocations dated in an EARLIER month than the bounce are not period-locked, because plan 3.8 requires "close October, bounce in November" to succeed (the reversal is dated `bouncedAt` in the open month and the closed month stays unchanged; `dateBeforeAllocation` guarantees no reversal predates its allocation). Unit + db-spec (later month closed → `periodClosed`; apply-credit after the date → `dateBeforeAllocation`) |
| L1 | Fixed | `expectedCredit` (decimal string, required) on apply-credit; differs from the server's `availableCredit` → 409 `creditChanged`, malformed → 400 `invalidAmount`. A replayed request is refused. Tests |
| L2 | Fixed | `withPeriodRetry` + `assertPeriodsLocked`/`PeriodSetGrew` (`kernel/locks.ts`): payment void (and the cheque paths) re-run the whole transaction with the enlarged period set, period locks first; 3 attempts, then retryable 409 `concurrentChange`. Tests (grown set re-run; endless growth gives up, nothing written) |
| L3 | Fixed | Private-bucket check trusted for `BUCKET_RECHECK_MS` (10 min), then re-validated. Test |
| L4 | Fixed | A promotion that loses the row update deletes its copy only when the row does not name it (re-read). Comment + test |
| L5 | Fixed | db-specs added: M1 race, M2 attachment race, M3 across months, receipt numbers consecutive after a rolled-back payment (audit FK failure). They compile and skip without `TEST_DATABASE_URL` (gate G1) |

New en keys: `attachmentMissing`, `dateBeforeAllocation`, `creditChanged`, `concurrentChange`.
Gates (apps/backend): `prisma validate` valid; `tsc -p tsconfig.json` 0; `tsc -p tsconfig.test.json` 21 (baseline);
`eslint src test --quiet` 0; `jest --config test/jest.json` 55 suites, 1062 passed; db-specs compile, skipped.
Slice 8 clients must send `expectedCredit` on apply-credit.
