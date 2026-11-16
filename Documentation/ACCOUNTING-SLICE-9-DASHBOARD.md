# Accounting slice 9 — Finance dashboard (web + mobile)

Status: APPROVED 2026-11-15. Revised after the external review (section 9); the five open questions were decided
under the owner's delegation (section 8); the owner accepted all section 6 deviations. Branch: `feature/accounting`
(after slice 8).
Design approved by the owner on 2026-11-15:

- Web: `Documentation/mockups/finance-dashboard/sample-4.html` ("Ledger + Map")
- Mobile: `Documentation/mockups/finance-dashboard/sample-5-mobile.html` (4 frames)

The mockups use fake data. This plan says where every number comes from.

## 1. Why this slice exists

The slice 8 dashboard (`apps/web/src/components/finance/FinanceDashboard.tsx`, mobile
`(finance)/finance/today.tsx`) is a launcher: quick links plus the last payments. The backend has no
aggregate endpoint, so there is nothing to chart. Phase 3 of `ACCOUNTING-PLAN.md` (reports R1–R9) is
still far off. This slice brings forward a **read-only subset** of R3, R4, R6 and R8 as a single
dashboard endpoint. The formulas are the plan's, not new ones.

## 2. Hard rules

1. Every figure uses the shared predicates in `kernel/live-predicates.ts` and the
   `finance_live_payments` view. No re-spelled "live" logic (plan 2.1.1). The aggregates are raw SQL, so
   9.1 adds the SQL form of each predicate **in `kernel/`** (`live-predicates.sql.ts`: `liveChargeSql(D)`,
   `livePaymentSql(D)`, `liveAllocationSql(D)`, plus a new `liveFundEntryWhere` / `liveFundEntrySql`, since
   no fund predicate exists yet). A parity test runs each SQL fragment and its Prisma twin over the same
   seeded ledger at several D (before, on and after each void and bounce) and asserts the same row ids. The
   dashboard service never writes a `voidedAt` / `bouncedAt` comparison itself.
2. Flow figures (billed, collected, receipts by method, deposit flows) follow N-1 through one helper,
   `kernel/flow-buckets.ts` (the plan's `flowBuckets`, so Phase 3 reuses it). Stock figures (outstanding,
   aging, owing flats, credit, fund balance, unapplied) are computed once, as of D. Section 3.1 defines both.
3. Money stays `Decimal` end to end and is sent as **strings** (`"12500.00"`). This is on purpose and differs
   from the existing finance DTOs, which emit `number` through `toMoneyNumber`. Do not copy that pattern.
   Web and mobile each get one explicit adapter (`parseMoney` / `formatMoney`) for this DTO; chart geometry
   may convert to `number` only inside the adapter, never in a component.
4. Access is `ACCOUNTANT` and `ADMIN` only (`@AllowedRoles`, same as `finance-desk.controller.ts`).
   SUPER_ADMIN passes through ADMIN (`roles.guard.ts`, verified). Nothing here is published to residents.
5. Read-only. No writes, no migrations, no audit rows, no idempotency keys. All queries of one request run
   in **one read-only `REPEATABLE READ` transaction**, so every figure comes from the same snapshot.
6. **Design fidelity (owner decision 2026-11-15, option 1).** The built web `/finance` must match
   `sample-4.html` and the built mobile finance home must match `sample-5-mobile.html`: same sections in
   the same order, same charts, colours, copy (AR + EN), states and interactions. The mockups are part of
   this spec; every UI task brief names the mockup section it implements. Any deviation not listed in
   section 6 is a review finding to fix, unless the owner approves it. Data comes from the endpoint, never
   from the mockups' fake numbers.

## 3. Backend — `GET /v1/finance/dashboard`

Query: `asOf` (optional `YYYY-MM-DD` Cairo day; default today in Cairo; a future date is a 400),
`months` (6 or 12, default 12). Lives in a new `finance-dashboard.controller.ts` and
`finance-dashboard.service.ts` in `apps/backend/src/modules/finance/`. Aggregates run as SQL `GROUP BY`
queries, never as per-flat loops in JS.

### 3.1 Definitions

- **D** = `asOf`. **M** = `periodOf(D)`. **D′** = D minus one calendar month, clamped to that month's last
  day (31 Mar → 28/29 Feb).
- **Window**: the `months` months ending at M. Bucket end `e(m)` = last day of month m, except the last
  bucket, whose end is D. Nothing dated after D counts anywhere: no original, no reversal.
- **Operating charge**: a charge whose kind is not `OPENING_BALANCE` and not `MAINTENANCE_DEPOSIT`.
  `OPENING_BALANCE` is past debt (plan 4.6); `MAINTENANCE_DEPOSIT` is fund capital (R4, risk 2).
- **Flow (N-1)**: for a row set with live predicate L, `flow(m) = S(e(m)) − S(e(m−1))`, where `S(d)` is Σ
  amount of rows live as of d. This is the plan's "each column as of its own month end" form. It gives
  exactly one reversal per row, at its **earliest** invalidation (the first of: its own `voidedAt`, its
  payment's `voidedAt` or `bouncedAt`, its charge's `voidedAt`), even when several happen. An original
  dated before the window whose reversal falls inside it shows only the reversal. An allocation to a charge
  whose accrual month starts later counts in that accrual month, as `liveAllocationWhere` dictates.
  `flowBuckets` computes this from event rows (+amount at the start date, −amount at the earliest
  invalidation) and a test asserts it equals the `S(e(m))` differences.
- **Fiscal period**: a missing `FiscalPeriod` row means `OPEN` (schema comment, plan 3.2).
- **Days past due** of an open charge: `max(0, daysBetween(dueDate, D))`, the same function as
  `ledger.ts`. A charge not yet due has 0.
- **Owing flat**: balance > 0 as of D (`summariseFlats` semantics, the flats list `hasBalance=true` test).
  **Net-credit flat**: balance < 0. The population is **every flat, active or not**, as the flats list does
  today: an inactive flat that still owes is a debtor. `totalFlats` counts the same population.
- **Percentages** are computed on the server from Decimals and sent as strings with one decimal place,
  rounded half up (`"87.4"`). A rate whose denominator is 0 is `null`.
- **Deltas** (the "vs last month" chips): relative change `(x − x′) ÷ x′` as a one-decimal percentage
  string, where x′ is the same figure as of D′. The divisor is `|x′|`, so the sign stays right on a negative
  baseline (a debt that shrinks from −100 to −50 reads +50 %). `null` when x′ is 0 or null; the UI shows "—".
  The rate's delta is in percentage points.
- **Reproducibility**: for a D in a CLOSED period, every **money and count-of-money** figure is the same on
  every later read. Owner names, `totalFlats` and other registry fields are current state and may change.

### 3.2 Response fields

| Response field | Definition | Plan source |
| --- | --- | --- |
| `asOf`, `period` | D; `{ period: M, status }` (missing row = `OPEN`) | slice 6 |
| `cohort` | the ring and hero: `charges` = Σ live operating charges as of D with `accrualPeriod` = M; `allocated` = Σ live allocations as of D to those charges; `open` = `charges − allocated` (≥ 0 by construction); `rate` = `allocated ÷ charges` (`null` when 0, Q1). The same measures as of D′ in `previous.cohort` | R6 / R8 |
| `billed[]` per month | flow of live operating charges by `accrualPeriod` (3.1) | R8 |
| `collected[]` per month | flow of live allocations to every charge except `MAINTENANCE_DEPOSIT`, by `allocatedAt` (3.1). Allocations to `OPENING_BALANCE` charges count (L-4, Q4); there is no filter on `isOpening` | R8 |
| `receiptsByMethod` (month M) | per `FinancePaymentMethod`, payments with `isOpening = false`: `gross` (received in M, as of their receipt), `reversed` (bounced or voided in M, ≤ 0), `net` = gross + reversed. Cash basis: deposit receipts included, as R3 does | R3 |
| `outstanding` | Σ `openAmount` over all flats as of D. Equals Σ balance + Σ credit (`ledger.ts`: `balance = openAmount − credit`), not Σ balance | R6 |
| `credit` | `netCreditFlats` (count of balance < 0) and `netCreditTotal` (Σ −balance over them), plus `creditTotal` = Σ `credit` (unallocated payments, every flat) | R6, "prepayments held" |
| `aging` | Σ open amount by days past due: `current` (0–30, includes not yet due), `d31_60`, `d61_90`, `over90` (≥ 91). Σ buckets = `outstanding` | R6 |
| `owingFlats` | count of owing flats (3.1), plus `totalFlats` | R6 |
| `fundBalance` | Σ live `FundEntry` as of D by `entryDate` with `countsInFundTotal = true`, IN − OUT; a voided entry stops counting at the Cairo date of its `voidedAt` | R4 |
| `deposits` | for month M, flows by N-1: `billed` = live `MAINTENANCE_DEPOSIT` charges by `accrualPeriod`; `collected` = live `DEPOSIT_IN` fund entries with `countsInFundTotal = true` by `entryDate` (the import's per-flat rows have `false`, so they never count). Fund tile tooltip (risk 2) | R4 |
| `unapplied` | live payments as of D with unallocated amount > 0 (amount − Σ live allocations as of D): count, total, and the 5 oldest by `receivedAt` then id: `paymentId`, `flatId`, flat label, method, unallocated amount, age in days. No payer name. Never `availableCredit` (plan 2.1.1) | plan formula `credit` |
| `pendingCheques` | live cheques as of D not cleared by D (`clearedAt` null or > D): count + total | slice 7 |
| `checks` | inputs of the period checklist (section 4.1): `previewBillingRuns` (BillingRun `PREVIEW` with `accrualPeriod` = M), `previewImportBatches` (ImportBatch `PREVIEW` with `asOf` in M), `operatingChargesInMonth` (count of live operating charges with `accrualPeriod` = M) | Q3 |
| `byBuilding[]` | per `Flat.building`: `totalFlats`, `owingFlats`, `outstanding`, and `floors[]` (`outstanding` per `Flat.floor`) | R6 |
| `topOwing[]` | the 10 owing flats with the highest balance, ordered balance DESC, id ASC (the first page of the drilldown, section 3.3): flat id + label, current owner name (null if none, "former owner" when the account is deleted), balance, days past due of the oldest open charge. No phone, email or other contact field (Q5) | R6 |
| `series` | per month in the window, the stock values at `e(m)`: `outstanding`, `owingFlats`, `fundBalance` (last point = D) | R4 / R6 |
| `previous` | `cohort`, `collected`, `outstanding`, `owingFlats`, `fundBalance` as of D′; `collected` is the month-to-date flow of D′'s month up to D′ (Q1). Deltas are derived from it (3.1) | — |
| `timeline` | not in this response: section 3.4 | — |

The attention cards and the period checklist are **derived on the client** from these fields, with the
rules in section 4.1. No separate endpoint.

### 3.3 Drilldowns — flats list changes

`GET /v1/finance/flats` already has `building`, `hasBalance`, `overdueDays` and `asOf`. 9.1 adds
`sort=balance`:

- with `sort=balance`, summarise **all** candidates (≈ 690 flats, `summariseFlats` is three indexed reads),
  apply the figure filters, order by balance DESC then id ASC, and only then locate the cursor and slice.
  The cursor stays the flat id. Today's code locates the cursor in layout order before filtering, which is
  wrong once the order changes;
- the default sort stays layout order, unchanged;
- clients pass page 1's returned `asOf` on every later page, so a list read at midnight does not mix days.

Both clients wire the route parameters through: web `FinanceFlats.tsx` initialises `building`, `hasBalance`,
`overdueDays`, `sort` and `asOf` from the URL (today it reads only `hasBalance` and `overdueDays`); mobile
`(finance)/finance/flats/index.tsx` reads them from `useLocalSearchParams` (today it ignores them). The
"debt over 90 days" card links to `overdueDays=91` (the filter is `oldestDueDays ≥ N`). The web select
offers 30/60/90; add 91 as a hidden accepted value or label it "over 90" (section 6).

### 3.4 Timeline

The timeline reuses `GET /v1/finance/audit` with `from` = first day of M and `to` = D (both inclusive,
`FinanceAuditQueryDto`). No new endpoint. One label map in each client covers all 27
`FINANCE_AUDIT_ACTIONS`; an unmapped action shows a generic "Finance activity" label, never a raw code. The
mockup's labels map as: `PAYMENT_RECORDED` → "Payment recorded", `FUND_ENTRY_RECORDED` → "Fund deposit".
The mockup's "Unapplied payment" and "Late fee" have no audit action of their own: listed in section 6.

### Performance

About 690 flats × 12 months is small. Build each figure as a single SQL query. The month-end stock values
for `series` come from one query over a `generate_series` of month ends, not 12 round trips. Queries in one
Prisma transaction run one after another on one connection, so measure that path. 9.1 benchmarks against a
seeded ledger of 690 flats × 24 months (charges, allocations, a few bounces and voids), reads `EXPLAIN
ANALYZE` for each query, and adds an index only where a plan shows a sequential scan that matters. No cache
in v1. Log the duration. Consider a 60 s Redis cache only if p95 goes above 500 ms on Render.

### Tests (backend)

- A unit test for every response field against a seeded ledger, money compared as Decimal strings.
- **Consistency invariants** (db-spec, same harness as slices 5–7): `outstanding` = Σ per-flat `openAmount`
  = Σ balance + Σ credit; Σ `aging` = `outstanding`; Σ `byBuilding.outstanding` = `outstanding`; Σ floors =
  building outstanding; `cohort.open` = `cohort.charges − cohort.allocated`.
- **Predicate parity**: each SQL fragment returns the same ids as its Prisma predicate (rule 1).
- **N-1 additivity**: computing a range equals the sum of its months, before and after a November bounce
  of an October cheque. The October `collected` value is unchanged and November gets −amount. Same for a
  voided payment, a voided allocation, a voided charge and a voided `DEPOSIT_IN`.
- **Double reversal**: an allocation whose cheque bounces and whose charge is then voided reverses once, at
  the earlier date. An original before the window with a reversal inside it shows only the reversal.
- **Aging**: a charge not yet due lands in `current`; a charge exactly 90 days past due lands in `d61_90`,
  91 in `over90`.
- **Credit**: a flat with open charges and more credit is not owing, is counted in `netCreditFlats`, and
  its open amount is still in `outstanding`.
- **Opening rows** (seeded by hand; the importer is Phase 1b): an `OPENING_BALANCE` charge moves
  `outstanding`, `aging` and `topOwing` and not `billed` or `cohort`; an `isOpening` payment is out of
  `receiptsByMethod`; a later allocation of that opening credit to a service charge **counts** in `collected`
  on its `allocatedAt` (L-4); an allocation to the `OPENING_BALANCE` charge counts in `collected`.
- `cohort.rate` is `null` for a month with no operating charges; deltas are `null` on a zero baseline.
- **Pagination**: `sort=balance` returns every owing flat exactly once across pages, in balance DESC, id
  ASC order, with filters applied before the cursor; ties on balance page stably.
- **Closed period**: for D in a CLOSED period, the money figures are identical before and after (a) an
  unrelated posting in the open period, (b) a bounce dated in the open period of a cheque received in the
  closed one (only months after D change), (c) clearing a pending cheque in the open period.
- **Snapshot**: a posting committed while the dashboard request runs is either fully in or fully out
  (the invariants above hold on the response).
- Role test: RESIDENT, MERCHANT and guest get 403/401. ACCOUNTANT, ADMIN and SUPER_ADMIN get 200.

## 4. Web — `/finance` (sample 4)

Replace the body of `FinanceDashboard.tsx`. Keep "Record payment" and "Find a flat" in the header.
Sections, in order:

1. Header: eyebrow, title, gold hairline, period pill, the two actions.
2. Hero: collection ring (`cohort`), story sentence, chips (fund, billed = `cohort.charges`, collected delta).
3. Four KPI tiles with sparklines: collected (`collected[]`), outstanding, owing flats, fund.
4. Attention cards (rules in 4.1). Each card links to an existing page.
5. Compound map plus a building panel. v1 lays buildings out in a grid ordered by code; positions come
   from one layout file so the real site plan can replace it later (Q2).
6. Billed vs collected chart, last 12 months (sample 4 has no 6M / 12M switch; see section 6 item 14).
7. Aging stacked bar + rows | payment-method donut.
8. Timeline (audit log, 3.4) | unapplied payments & credits.
9. Top 10 owing flats table. Rows link to `/finance/flats/[id]`.
10. Period checklist: computed checks only, advisory (Q3, 4.1).

Charts are hand-written SVG React components in `apps/web/src/components/finance/charts/`:
`Sparkline`, `Ring`, `BarsBilledCollected`, `StackedBar`, `Donut`, `HBars`, `CompoundMap`. No chart
dependency. Colours come from the existing theme tokens, never hex values in components. Text, ARIA
labels and tooltips are bilingual. A table equivalent sits behind every chart for screen readers.
Skeleton shimmer while loading. Data is fetched through the existing `finance.server.ts` / BFF pattern.

**Signed values.** `billed[]` and `collected[]` can be negative in a month of heavy reversals: bars grow
down from a zero baseline. The donut draws `gross` per method only (never negative); below it one line
shows the month's reversals ("Reversed: −X") and the net total. When every gross is 0 the donut shows the
empty state. The ring clamps its arc to 0–100 % and prints the true rate.

### 4.1 Attention cards and checks

| Item | Shows when | Destination |
| --- | --- | --- |
| Unapplied payments | `unapplied.count > 0` | `/finance/payments` (each listed row → its flat, where "Apply" uses the slice 7 apply-credit) |
| Debt over 90 days | `aging.over90 > 0` | `/finance/flats?hasBalance=true&overdueDays=91&sort=balance&asOf=D` |
| Building furthest behind | the building with the highest `outstanding ÷ totalFlats` (ties: code) and `outstanding > 0` | `/finance/flats?building=<code>&hasBalance=true&sort=balance&asOf=D` |
| Pending cheques / period status | `pendingCheques.count > 0`, else the period status | `/finance/payments` (cheques), period page |
| Check: period not OPEN | `period.status ≠ OPEN` (strong, first) | period page |
| Check: PREVIEW billing runs / import batches | `checks.previewBillingRuns + previewImportBatches > 0` (strong) | billing runs / import pages when they exist, else none |
| Check: no service charges this month | `checks.operatingChargesInMonth = 0` (plain) | `/finance/flats` |
| Check: unapplied payments | `unapplied.count > 0` (plain) | `/finance/payments` |
| Check: pending cheques | `pendingCheques.count > 0` (plain) | `/finance/payments` |

Each check shows `ok` or `warn`, never `fail`. Billing runs and the importer are not built yet on
`feature/accounting`: the counts are 0 until they ship, and "no service charges this month" reads charges,
not billing runs, so quarterly or manual billing does not need a run.

### 4.2 Interactions and states

- Building selection: click or Enter/Space on a map building selects it, updates the panel, keeps the
  scroll position and returns focus to the building (as the mockup does). The map opens with the building
  that owes the most selected; there is no "All buildings" control (sample 4 has none).
- Mobile 6M / 12M switch (sample 5): refetches with `months`; the selection and scroll stay.
- Period pill: shows the status ("Period: Open"). On web it is plain text (there is no web period page yet;
  the period attention card and the checklist link to the audit trail). On mobile it opens Period close.
- Empty states: no charges yet ("—" in the ring, empty charts with one line of copy); no owing flats
  (aging and top 10 show "No overdue flats"). Error: one inline banner with Retry, the header actions stay
  usable. Loading: skeletons in the section shapes.

## 5. Mobile — finance home (sample 5)

Rework `apps/mobile/src/app/(finance)/finance/today.tsx` into the dashboard. Keep the existing
`(finance)/_layout.tsx` navigation. The resident tab bar in the mockup is illustrative only: the
ACCOUNTANT role keeps its own nav (section 6).

- Frame 1: app header (period pill, bell), ring hero, horizontal snap carousel of the 4 KPI cards with
  dots, attention list with chevrons (4.1), gold FAB → `finance/payment/new`.
- Frame 2: compound map, 6M / 12M chart, aging, methods donut, top owing as list rows →
  `finance/flats/[id]`.
- Frame 3: tapping a building opens a `@gorhom/bottom-sheet` with per-floor bars (`byBuilding.floors`) and
  the owing flats (first page of `GET /v1/finance/flats?building=<code>&hasBalance=true&sort=balance&asOf=D`),
  and a "View flats" button → `finance/flats?building=<code>&hasBalance=true&sort=balance&asOf=D`. The sheet
  closes on swipe down, backdrop tap and Android back; focus returns to the building.
- Frame 4: a new `finance/period.tsx` screen with the checklist, unapplied payments and the timeline (3.4).
- Bell: opens the timeline section of `period.tsx` (there is no finance notification feed; section 6).
- Period pill: opens `period.tsx`.
- States: as 4.2. Offline: the dashboard is not cached (below), so offline shows the error state with Retry,
  never stale figures.
- The dashboard query is **not persisted** to the AsyncStorage offline cache (it holds owner names and
  balances). Keep its query key out of the persister (Q5) and test that.

Charts use `react-native-svg` (already `~15.12.1`). The same geometry functions are ported from the
web components. Copy the math, do not share code (the shared package is still deferred). Signed values as
in section 4. Use `FlashList` for the lists, TanStack Query for the endpoint, skeletons and haptics on taps,
and honour reduced motion. Touch targets are at least 48 dp. Use the RTL-safe chevrons already in
`finance-ui.tsx`.

**No `*.test.tsx` under `src/app/`.** Run `npx expo export --platform android` before asking for a
build, then `git checkout uniwind-types.d.ts`.

## 6. Out of scope and deviations (each needs the owner's acceptance)

Rule 6 makes every difference from the mockups a finding unless listed here. Every item below is an
**accepted** deviation: the owner accepted all 15 as written on 2026-11-15 (web keeps a fixed 12-month chart, item 14).

Not built:

1. **"Remind" / "Remind all" buttons.** No resident reminder channel for finance yet. Hidden.
2. **Inline "Pay"** from the owing list: goes to the existing record-payment flow with the flat prefilled.
3. **Manual checklist items** "Match bank statement", "Issue flat statements", "Review audit log", and
   "Review late fees" (no late-fee feature). No data (Q3).
4. **Exports, published summaries, R1/R2/R7/R9.**

Changed:

5. **Checklist content.** The mockup's six ticked items become the computed checks of 4.1 (`ok` / `warn`),
   with no tick boxes and no "left" counters for manual items. "Reconcile cash payments" has no data and is
   dropped; "Apply unapplied payments" becomes the unapplied check.
6. **Aging labels.** "0–30 / 31–60 / 61–90 / 90+" becomes "Current–30 / 31–60 / 61–90 / Over 90" (AR
   "حتى 30 يوماً / 31–60 / 61–90 / أكثر من 90"), because the first bucket includes charges not yet due and a
   charge 90 days late is in 61–90.
7. **Metric copy.** The ring and "Billed this month" read the month's own charges (cohort, Q1), while
   "Collected this month" on the KPI tile is the month's allocations of any charge. The tile keeps its copy;
   the ring's caption says "of this month's charges" / "من رسوم هذا الشهر".
8. **Pending-cheques card.** The mockup's fourth attention card slot shows pending cheques when there are
   any and the period status otherwise.
9. **Building sheet list source.** The owing flats in the sheet come from the flats list (first page), not
   from the dashboard response.
10. **Timeline labels.** The real audit actions (3.4) replace the mockup's four sample labels;
    "Unapplied payment" and "Late fee" never appear (unapplied payments have their own panel).
11. **Donut with reversals.** The "Reversed" line under the donut is not in the mockup (section 4).
12. **Web grid geometry.** The mockup is a static 1440 px layout; at narrower widths the grid collapses to
    the web app's existing breakpoints. Section order never changes.
13. **Navigation chrome.** Web keeps the finance app shell and its nav; mobile keeps the ACCOUNTANT
    `(finance)` nav instead of the mockup's resident tab bar.
14. **Controls.** Web follows sample 4: a fixed 12-month chart, no 6M / 12M switch (mobile keeps the
    switch from sample 5). Adding the switch on web is a deviation only the owner can approve. The mockups'
    theme and language toggles are the app's own settings, not dashboard controls.
15. **Bell.** Opens the timeline section of Period close (section 5; `/finance/period?section=timeline`), not
    a notification feed. The period pill opens the top of the same screen.

Added during build, proposed in the 9.6 review (**awaiting the owner's acceptance**):

16. **"View flats" link in the web building panel** (review L10). Mirrors mobile frame 3; not in sample 4.
17. **Mobile unapplied and cheque attention cards** open `/finance/period` (review L11), because mobile has no
    payments list; web opens `/finance/payments`.
18. **Deposits figure.** Web shows it in the fund tile's tooltip (risk 2). Mobile has no tooltips, so it is in
    the fund card's screen-reader label only (review L4).
19. **Over-90 drilldown.** The card links to `overdueDays=91` without `hasBalance`, so a net-credit flat that
    still holds a 91-day-old charge stays in the list the card's amount was summed from (review L7).

## 7. Task split (CLAUDE.md §15 rubric)

| # | Task | Model | Depends on |
| --- | --- | --- | --- |
| 9.0 | **Contract freeze**: the response DTO (field names, Decimal-string types, nullability), the money/percentage adapters, and the chart-geometry contract (inputs, signed values, empty states) as TypeScript types plus a fixture JSON both clients test against. Reviewed by the owner's reviewer before any UI work | Opus | — |
| 9.1 | Kernel SQL predicates + parity tests, `flowBuckets`, `liveFundEntryWhere`; dashboard service + controller + DTO + unit/db-spec tests; `sort=balance` on the flats list; benchmark | Opus (first of its kind, money invariants) | 9.0 |
| 9.2 | Web SVG chart components against the 9.0 fixture (each with a test that it renders the given data, including negatives and empties, in both themes) | Sonnet | 9.0 |
| 9.3 | Web `/finance` dashboard wiring + flats-list URL parameters + i18n AR/EN | Sonnet | 9.1, 9.2 |
| 9.4 | Mobile SVG chart components + bottom sheet against the 9.0 fixture | Sonnet | 9.0 |
| 9.5 | Mobile finance home + `period.tsx` + flats route parameters + i18n | Sonnet | 9.1, 9.4 |
| 9.6 | Review (one review doc, `ACCOUNTING-SLICE-9-REVIEW.md`) + fixes. Accounting findings are fixed by Opus | Opus review | all |

Gates: backend typecheck/lint/tests (including db-specs at G1); `pnpm --dir apps/web check`; mobile
type-check + jest + `expo export`. UI gates add: the offline-cache exclusion test (mobile), adapter tests
for Decimal strings, and a side-by-side comparison of each built section against its mockup section in AR
and EN, dark and light, written into the review doc (the owner does the visual check himself; the review
lists what to look at). One commit per task, no push without the owner's yes, no EAS build without the
owner's yes. The owner does the click-tests himself (list handed over at the end).

## 8. Decisions (delegated by the owner on 2026-11-15)

- **Q1. Collection rate basis: (a).** Live allocations as of D to the month's own operating charges ÷ those
  charges (`cohort`). Rationale: it answers "how much of what we billed this month is paid", the standard
  service-charge measure. (b) mixes in arrears paid this month and can pass 100 %, which hides a growing
  debt; arrears are already visible in `outstanding` and the over-90 bucket. Changes: the ring and hero use
  `cohort` only; `collected[]` stays the allocation-date flow for the chart and the KPI tile; the rate is
  `null` when nothing was billed; `previous` is taken as of D′, because early in a month the rate is
  naturally low and must be compared with the same day of last month, not with a full month.
- **Q2. Compound map: grid by building code in v1.** Rationale: the site plan is not in the repo, and an
  invented layout would look like a real one. Changes: the web and mobile maps each read positions from one
  static file (`compound-layout.ts`: building code to row and column, generated from the sorted codes in v1).
  When the owner sends the site plan, only those files change. A building missing from the file falls back
  to the grid. No backend change.
- **Q3. Period checklist: computed checks only, no new table.** Rationale: a manual tick is an unaudited
  self-attestation; the real attestation is the ADMIN's period close, which is already audited. Manual items
  arrive with bank reconciliation, which brings its own data. Changes: the checks of 4.1; each shows `ok` or
  `warn`, never `fail`, and none blocks the close (the close endpoint keeps its own rules). Unapplied
  payments, pending cheques and "no service charges this month" are plain warnings, because prepayments,
  cheques that clear next month and quarterly billing are all legitimate. PREVIEW billing runs or import
  batches in the period, and a period that is not OPEN, are the strong warnings and are shown first.
- **Q4. Opening balances: out of billed, the cohort and receipts by method; in outstanding, aging,
  `owingFlats`, `byBuilding` and `topOwing`; collections of them count.** Rationale: they are past debt and
  past money, not this month's activity; counting them as billed would inflate the go-live month (plan 4.6,
  6.1). Changes: the exclusion is **by kind** — `OPENING_BALANCE` charges are out of `billed` and `cohort`,
  `isOpening` payments are out of `receiptsByMethod`. `collected` has **no** opening filter: under plan 4.6
  the only allocations the import creates are from `isOpening` payments to `MAINTENANCE_DEPOSIT` charges,
  which `collected` already excludes by kind. So a later `apply-credit` of opening credit to a service charge,
  and a real payment against an `OPENING_BALANCE` charge, both count on their `allocatedAt` (plan L-4).
  The one figure the kind rule cannot clean is `deposits.billed` (the import's deposit charge): see risk 1.
- **Q5. Owner names: ACCOUNTANT and ADMIN (SUPER_ADMIN through ADMIN), name only.** Rationale: the privacy
  decision already discloses that admins and named accountants see the owner's name and phone for
  collection. PDPL 151/2020 treats finance data as sensitive, so the dashboard shows the minimum: the current
  owner's name on the top 10 rows, no phone (it stays on the flat page), no payer names in the unapplied
  list. Changes: `topOwing` carries no contact field; a deleted account shows as "former owner"; the mobile
  query stays out of the offline cache; nothing from this endpoint feeds a published summary or an export.

### Other risks found (listed, not expanded)

1. **Import provenance is a Phase 1b requirement, not slice 9 work.** No opening importer exists on
   `feature/accounting` (it is Phase 1b), so there is nothing to backfill and slice 9 adds no migration
   (this replaces the earlier delegated `Charge.importBatchId` decision). Until the importer ships, no opening
   rows exist and every figure is correct. **Requirement for the Phase 1b importer:** record which rows a
   batch created (for example `importBatchId` on `Charge`, `Payment` and `PaymentAllocation`, or a link table),
   and extend the dashboard's `deposits.billed` and R4 to exclude the import's `MAINTENANCE_DEPOSIT` charges
   by it, with a test that committing an import leaves every flow figure unchanged. Add this line to the
   Phase 1b section of `ACCOUNTING-PLAN.md` when that phase is planned.
2. **Deposits are mixed into billed, collected and the ring.** `MAINTENANCE_DEPOSIT` is fund capital, not
   service-charge income (R1 excludes it, R4 holds it). **Decided (delegated):** the ring, `billed`,
   `collected` and the cohort cover operating charges only; deposits appear on the fund KPI tile and its
   tooltip (`deposits`, R4 basis). The 12-month chart stays operating-only.
3. **`unapplied` was defined on `availableCredit`**, a current-state gate figure (plan 2.1.1). Fixed in
   section 3 to the unallocated amount as of D. From Phase 2 the refund terms must join this figure.
4. **`owingFlats` used open amount > 0; the flats list uses balance > 0.** Fixed to balance > 0;
   `outstanding` and `aging` stay gross open amounts, so Σ aging = `outstanding` = Σ balance + Σ credit.
5. **`pendingCheques` was current-state** and broke the "closed `asOf` is reproducible" test. Fixed to as
   of D.

## 9. External review (astra, 2026-11-15)

| # | Finding | Verdict | Landed in |
| --- | --- | --- | --- |
| 1 | Risk 1 assumed an importer and an ImportRow backfill | **Accepted.** Verified: no importer on `feature/accounting`. Migration dropped, slice is read-only, provenance is a Phase 1b requirement; the one leak left (`deposits.billed`) is named | rule 5, Q4, risk 1 |
| 2 | Q4 exclusions suppressed L-4 collections | **Adapted.** Simpler than "exclude only import-created allocations": the import only allocates to deposit charges, which `collected` already drops, so `collected` has no opening filter at all | Q4, 3.2, tests |
| 3 | Wrong invariant; future-due and 90-day overlap | **Accepted.** `outstanding` = Σ openAmount = Σ balance + Σ credit; days past due floored at 0; buckets Current–30 / 31–60 / 61–90 / over 90; label change listed | 3.1, 3.2, tests, §6 item 6 |
| 4 | Ring/hero mixed measures | **Accepted.** `cohort { charges, allocated, open, rate }`; Decimal one-decimal half-up; null deltas on zero baseline | 3.1, 3.2, §4, Q1 |
| 5 | Historical and reversal contract | **Accepted.** SQL predicates in `kernel/` with parity tests, `flowBuckets`, earliest invalidation, pre-window originals, D cap, clamped D′, missing period = OPEN, fund by `entryDate` with dated voids, money-only reproducibility | rules 1–2, 3.1, tests |
| 6 | UI data without contract | **Accepted.** `checks`, `credit`, `paymentId`/`flatId`, `deposits` with N-1, card/check table, audit label map bounded to D | 3.2, 3.4, 4.1 |
| 7 | Drilldowns not wired | **Accepted.** Verified: no balance sort; mobile ignores route params; web reads only two. `sort=balance` sorts before the cursor, balance DESC id ASC; `topOwing` uses the same order; inactive flats included | 3.3, 4.1, §5 |
| 8 | Fidelity gaps | **Accepted.** 15 deviations listed for owner acceptance (web 6M switch removed to match sample 4); selection, focus, sheet dismissal, bell, period pill, Apply, empty/error/offline and signed values (donut gross + reversal line) specified | §4.2, §5, §6 |
| 9 | Gates | **Accepted.** 9.0 contract freeze before 9.2/9.4; Opus for accounting and review; listed tests; one REPEATABLE READ snapshot; Decimal-string adapters; 690-flat benchmark with `EXPLAIN ANALYZE` before any cache | rules 3 and 5, Performance, tests, §7 |

Also corrected while revising: rule 3 claimed the existing DTOs send strings (they send numbers); the flat
count is about 690, not 400.

## 10. Build notes for the 9.6 review

### 9.1 (backend, built 2026-11-15)

Deviations the 9.6 review must rule on:

- `collected` counts every charge except `MAINTENANCE_DEPOSIT`, so collections against `OPENING_BALANCE`
  charges count (Q4, L-4 and the opening-row tests; the 3.2 table's "operating charges" wording is stale).
- Deltas divide by |previous|, not previous.
- `owingFlats` and `totalFlats` are top-level numbers.
- Extra fields: floors carry counts; unapplied rows carry `receivedAt`.
- A deleted owner is `ownerDeleted: true` with no name; the clients render "former owner".
- `daysPastDue` is floored at 0 and differs from the flats list's `oldestDueDays`.
- No separate contract-freeze task exists; the 9.1 response DTO is the frozen contract for 9.2–9.5.

Gates: `pnpm test` 56 suites / 1085 tests; `pnpm lint:check` clean; `tsc --noEmit` only the 3 pre-existing
`src/main.ts` errors; `pnpm test:db` 56 passed on a local Postgres 16 (G1 on Postgres 15 still the owner's).
Benchmark (690 flats × 24 months, local): p50 339 ms, p95 388 ms; no index added; cache decided from the
Render logs. `format:check` already fails on 94 untouched files (pre-existing).

### 9.2 (web charts, built 2026-11-15)

- One shared custom tooltip (`charts/tooltip.ts`) replaces native `<title>`, same text as sample 4.
- Every chart has a visually-hidden table; Donut and StackedBar keep their visible legends.
- Map tint is normalised to the real data range instead of the mockup's fixed range (review to rule).
- Tokens `--chart-1..5`, `--chart-a1..a4` added in `globals.css` (dark + light).
- Gate: `pnpm --dir apps/web check` exit 0 (572 tests, 64 pages).

### 9.4 (mobile charts, built 2026-11-15)

- Taps go through a button overlay above the SVG; 12M month columns are ~25 dp wide, under the 48 dp
  target (same density as sample 5; review to rule).
- Ring size set to the mockup's 132. The charts have no motion; with reduced motion the sheet animates in 1 ms.
- The sheet takes its flats from the parent (§6 #9); no "Remind all" (§6 #1).
- Gates: type-check clean; jest 63 suites / 482 tests; eslint 0 errors (12 warnings); `expo export` ok
  (charts not yet imported by a screen, so the bundle check repeats in 9.5).

### 9.3 (web screen, built 2026-11-15)

- The map opens with the building with the highest outstanding selected (ties: code order), as in sample 4.
  No "All buildings" state.
- The period pill is plain text (web has no period page); the period card and checklist link to `/finance/audit`.
- The timeline shows day + time and is capped at the latest 8 rows (review to rule).
- The flats page reads `building`, `hasBalance`, `sort`, `asOf` and `overdueDays` from the URL.
- Gate: `pnpm --dir apps/web check` exit 0 (33 files, 591 tests).

### 9.5 (mobile screens, built 2026-11-15)

- The header keeps the existing find-flat and profile icons next to the pill and bell. The finance stack
  has no tab bar, so these are the ACCOUNTANT's only way to reach them (§6 #13).
- Tapping the unapplied check row does nothing; its Apply button opens the flat (review to rule).
- The flats list honours `building`, `hasBalance`, `overdueDays`, `sort` and `asOf`; the dashboard query is
  excluded from the offline cache (test in `src/__tests__/finance-dashboard-cache.test.ts`).
- Gates: type-check clean; jest 68 suites / 506 tests; eslint 0 errors; `expo export --platform android` ok.
