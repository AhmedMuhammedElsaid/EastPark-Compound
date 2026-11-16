# Accounting slice 9 review — Finance dashboard (task 9.6)

Commits `5e8cfa7` (9.1 backend), `93ac8b8` (9.4 mobile charts), `aac2483` (9.2 web charts), `d6a90aa` (9.3 web
screen), `3065fee` (9.5 mobile screens); diff `353f2af^..3065fee`. Reviewed 2026-11-16 against
`ACCOUNTING-SLICE-9-DASHBOARD.md` (all sections), `ACCOUNTING-PLAN.md` (2.1.1, 6.1, N-1, L-4) and the approved
mockups `mockups/finance-dashboard/sample-4.html` (web) and `sample-5-mobile.html` (mobile). Independent review;
no source changed.

## Verdict

**Accounting core: sound. No Critical or High findings.** Every figure reads the kernel SQL twins, flows go through
`flowBuckets` (earliest invalidation, pre-window originals, D cap), stocks are computed once as of D in one
read-only REPEATABLE READ transaction, money leaves the server as Decimal strings, roles and PII minimisation
match Q5, and the mobile query is outside the persister. All raw SQL is parameterised; the only `Prisma.raw`
inputs are a regex-checked alias and fixed column/prefix names.

Three Medium findings must be fixed before the owner click-test: the building sheet ignores Android back (M1),
mobile can show stale figures silently after a failed refetch (M2), and copy drifts from the mockups in a way rule
6 makes a finding (M3). The Lows are fidelity and hardening.

Counts: Critical 0 · High 0 · Medium 3 · Low 12.

## Gates run (this review)

| Gate | Result |
| --- | --- |
| backend `pnpm test` (apps/backend) | 56 suites / 1085 tests passed |
| `pnpm --dir apps/web check` (lint + tsc + vitest + build) | exit 0; 33 files / 591 tests; 64/64 pages |
| mobile `pnpm type-check && pnpm test` | exit 0; 68 suites / 506 tests |
| backend `pnpm test:db` (db-specs, benchmark) | **not re-run** (no Postgres here). The 9.1 note reports 56 passed on local PG 16; G1 on PG 15 stays the owner's |
| mobile `npx expo export --platform android` | **not re-run** (it rewrites `uniwind-types.d.ts`; 9.5 reports it ok) |

## Findings

### M1 — Mobile: the building sheet does not close on Android back

- Files: `apps/mobile/src/components/finance/charts/building-sheet.tsx:48-73` (`BottomSheetModal` with
  `enablePanDownToClose` and a backdrop with `pressBehavior="close"`; no back handling),
  `apps/mobile/src/app/(finance)/finance/today.tsx:113-122`. `@gorhom/bottom-sheet ^5.2.8`
  (`apps/mobile/package.json:61`) does not handle the hardware back button itself. A repo-wide grep finds
  `BackHandler` only in `checkout/confirmation.tsx` and `lib/hooks/use-origin-back.ts`. The root CLAUDE.md already
  records the same gap for `AuthWallSheet`.
- Problem: spec §5 frame 3 says the sheet "closes on swipe down, backdrop tap **and Android back**; focus returns to
  the building". Today Android back pops or leaves the finance stack while the sheet is open, and the selection and
  focus are lost.
- Fix: while `building` is set, register `BackHandler.addEventListener('hardwareBackPress', …)`. The handler calls
  `sheetRef.current?.dismiss()` and returns `true`; `onDismiss` then runs `closeSheet`, which restores focus. Add a
  jest test that a back press with the sheet open calls `onClose` and does not navigate.

### M2 — Mobile: stale figures stay on screen after a failed refetch; the 6M/12M switch can mismatch its data

- Files: `today.tsx:38-64` (the error UI only renders when `dash.isError && !data`), `today.tsx:40`
  (`useRefocusEffect` refetch), `today.tsx:100` (pull to refresh), `period.tsx:37`,
  `services/api/finance.ts` `useFinanceDashboard` (`placeholderData: keepPreviousData`).
- Problem: spec §5 says offline "shows the error state with Retry, **never stale figures**". TanStack keeps `data`
  when a refetch fails. Coming back to the screen offline, or pulling to refresh, leaves the earlier figures on
  screen with no error and no "as of" cue. During an offline 6M→12M switch the chart gets `months={12}` with the
  placeholder 6-month arrays until the request settles.
- Fix: whenever `dash.isError`, show an inline error banner with Retry above the content, and hide or dim the
  figures, as web does (`FinanceDashboard.tsx:204-219`). Drive the bars window from `data.months`, not from the
  requested `months`, and show the switch's pending state while `isPlaceholderData`. Test: a refetch that rejects
  after a success renders the banner.

### M3 — Copy that differs from the mockups (rule 6), not covered by §6

Each row is a rule-6 finding. None changes a figure. Fix the copy; for any line the owner prefers as built, record
it as an approved deviation instead.

| Where | Built (EN / AR) | Mockup (EN / AR) | Evidence |
| --- | --- | --- | --- |
| Web h1 | "Welcome, {name}" / "أهلًا {name}" (fallback "Finance desk") | "Finance" / "المالية" | `FinanceDashboard.tsx:179-181`, web `finance.dashboard.title_named` |
| Web hero eyebrow | month only | "November 2026 · OPEN" | `FinanceDashboard.tsx:305` |
| Web period pill / period card | raw "Period 2026-11: Open" | "Period: OPEN" with the month in the eyebrow | `FinanceDashboard.tsx:188-191`, `att_period_title` |
| Web checklist title | "Period checklist" / "قائمة فحص الفترة" | "Period close" / "إقفال الفترة" | `close_title` |
| Web building panel list | "Top owing flats" / "أعلى الشقق المتأخرة" | "Top 10 owing flats" / "أعلى 10 شقق متأخرة" | `panel_top` |
| Mobile aging title | "Overdue by age" / "المتأخرات حسب العمر" | "Debt aging" / "أعمار الديون" | mobile `finance.dash.aging_title` |
| Mobile methods title | "Receipts by method" / "المقبوضات حسب الطريقة" | "Collections by method" / "التحصيل حسب طريقة الدفع" | `methods_title` |
| Mobile sheet amount label | "Outstanding" / "المستحق" | "Total outstanding" / "إجمالي المتأخرات" | `outstanding` |
| Mobile sheet floors | "Outstanding by floor" / "المستحق حسب الدور" | "Arrears by floor" / "المتأخرات لكل دور" | `by_floor` |
| Mobile 6M/12M (AR) | "٦ أشهر" / "١٢ شهراً" | "6M" / "12M" in both languages | `months_6`, `months_12` |
| Reversed line (AR) | web "مرتجع", mobile "المسترد" | (§6 #11, no mockup copy) | the two clients should use one word |

### L1 — Bell and period pill both open the top of `period.tsx`

- `dash-charts.tsx:43,53`. §5 and §6 #15 say the bell opens the **timeline section**. Fix: pass a param
  (`/finance/period?section=timeline`) and `scrollToIndex`/`scrollToEnd` on the FlashList after load. The mockup's
  badge dot can stay off (there is no unread state).

### L2 — Mobile top-owing rows have no chevron; the days chip hides at 0

- `dash-sections.tsx:155-180` (`TopOwingRow`). The mockup's `.mrow` ends with `chev()`, and §5 asks for the RTL-safe
  chevrons. Fix: add `CaretRight mirrored={I18nManager.isRTL}` as `DashRow` does (`dash-ui.tsx:48`). A row with
  daysPastDue 0 is fine without a chip.

### L3 — Mobile timeline rows show the actor instead of the flat and amount

- `period-sections.tsx:105-121` renders the label plus `item.actor.name`. The mockup (frame 4) and web
  (`FinanceDashboard.tsx:759-781`) show "Payment recorded **A1-2-3** 1,250 EGP" from `meta.flatLabel` /
  `meta.amount`. Fix: render those two meta fields as web does. A staff name is not resident PII, so it may stay in
  the a11y label.

### L4 — Deposits figures are not presented as specified

- Web shows the deposits line as a visible paragraph under the fund tile (`FinanceDashboard.tsx:290,363-367`).
  §3.2 and risk 2 call for a **tooltip**, and the mockup tile has no extra line. Mobile never shows `deposits`.
  Fix: web moves it into the shared chart tooltip on the fund tile. Mobile either adds it to the fund card's a11y
  label and a tap readout, or the owner records "deposits on web only" as a deviation.

### L5 — Rule 3: money arithmetic inside components

- Web `charts/Donut.tsx:117-123` sums `reversed` and `net` through `Math.round(geo(v) * 100)` in the component,
  although `lib/finance/dashboard.ts:98` `stringToCents` (BigInt) exists. Mobile `building-sheet.tsx` calls
  `num`/`formatCurrency` directly instead of `lib/finance-dashboard.ts` `parseMoney`/`formatMoney`. The values are
  display-only and safe at these magnitudes, but rule 3 confines conversion to the adapter. Fix: use the adapters.

### L6 — No display serif on web (and mobile EN)

- The mockup `.serif` is Cormorant Garamond in EN and Alexandria in AR, used for the h1, the hero h2, KPI values and
  the building code. Built web uses sans everywhere (`FinanceDashboard.tsx:179,308,350,666`), although
  `--font-family-display` exists (`globals.css:7`). Mobile hero/KPI values are `FONT.sans` 300. Fix: apply the display
  family to those four elements in EN only (DESIGN rule: Cormorant never in Arabic or functional UI).

### L7 — "Debt over 90 days" card and its drilldown can disagree

- Aging (`finance-dashboard.service.ts:609-612`) sums open amounts ≥ 91 days over **every** flat. The card links to
  `hasBalance=true&overdueDays=91` (`lib/finance/dashboard.ts:197`; mobile `lib/finance-dashboard.ts:92`), which
  drops a net-credit flat that still has a 91-day-old open charge. The card can say 12,000 EGP while the list shows
  fewer flats. Fix (either): drop `hasBalance=true` from that link, so `overdueDays` alone filters
  `oldestDueDays ≥ 91`; or keep it and add a hint line on the list. Add a db-spec with such a flat.

### L8 — `sort=balance` paging throws `invalidCursor` when the cursor flat stops matching

- `finance-flats.service.ts` `afterCursor` runs on the filtered, sorted set. If the last flat of page 1 is paid off
  (or its balance changes) before "Load more", page 2 is a 400. This is realistic for an accountant collecting while
  paging a drilldown with `asOf` = today. The behaviour is tested as intended
  (`finance-read.service.spec.ts:497`), but the UX cost is new with `sort=balance`. Web
  `FinanceFlats.tsx` `load(next)` keeps the stale cursor. Fix (cheap): on `finance.error.invalidCursor`, clients
  reload from page 1 with a short notice. Mobile TanStack refetches recompute the cursors, so only "load more" is
  exposed.

### L9 — Over-90 share precision differs between clients

- Web prints one decimal ("26.7 %", `percentOf`, `AttentionCardView`); mobile rounds to an integer
  (`lib/finance-dashboard.ts:87`); the mockup shows "27%". Fix: integer on both, or one decimal on both, from the
  same rule.

### L10 — Web building panel adds a "View flats" link not in sample 4

- `FinanceDashboard.tsx:697-702`. It is useful and mirrors mobile frame 3. Recommend the owner approve it as a
  deviation; otherwise remove it.

### L11 — Mobile attention cards for unapplied payments and cheques go to `/finance/period`

- `lib/finance-dashboard.ts:84,105`. Spec 4.1 says `/finance/payments`, which does not exist on mobile. `period.tsx`
  holds the unapplied list, so the destination is reasonable. Recommend the owner accept it; record it as a mobile
  deviation.

### L12 — Test gaps

- No cross-client contract test. 9.0 was folded into 9.1 (§10), web zod (`lib/finance/dashboard.ts:17`) silently
  strips unknown keys, and the mobile `FinanceDashboard` type is never checked against a real response. The fixtures
  (`apps/mobile/src/__tests__/fixtures/finance-dashboard.ts`, web tests) are hand-written. Fix: emit the backend
  "assembles every field" result (`test/modules/finance-dashboard.spec.ts:537`) as a JSON fixture. Web parses it
  with `dashboardSchema.strict()`; mobile asserts the key set and value types.
- No web screen test for `FinanceDashboard` loading, error + Retry, and the empty state (§4.2). The derivations are
  tested (`finance-dashboard.test.ts`).
- No tests for M1 (Android back) or M2 (error after a refetch).
- Backend coverage of the spec's list is otherwise complete. Covered: N-1 additivity for bounce, void payment, void
  allocation, void charge and void `DEPOSIT_IN`; double reversal; pre-window original; aging 90/91/not due; credit;
  opening rows (L-4); null rate and deltas; pagination; closed period (a)(b)(c); snapshot; roles; predicate parity
  across Feb–Jul; and the invariants, including `series[last]` equal to the top-level figures
  (`finance-dashboard.db-spec.ts:66-73`).

## Checked and found correct

- **Predicates (rule 1).** `kernel/live-predicates.sql.ts` mirrors `live-predicates.ts` term for term, including the
  allocation's live charge and live payment. Spans are `[start, end)` with `end` = the earliest of the own void,
  the payment's void or bounce and the charge's void (`LEAST` ignores NULL). A VOID row without `voidedAt` gets the
  1900 sentinel, so it is never live. Cairo days are handled in JS (`spanEnd` → `cairoDate`), not by the session
  time zone. A spec test forbids the service from spelling `voidedAt`/`bouncedAt`/`'POSTED'`.
- **N-1.** `flowBuckets` books +amount at `start` and −amount at `end` within inclusive buckets; the last bucket ends
  at D. The `spans` pre-filter (`start ≤ D` and (start in window, or either end ≥ window start − 1 day)) keeps
  every row that can land in the window. `collectedBefore` reuses the same rows for D′'s month (always inside a
  6- or 12-month window).
- **Exclusions (Q4).** `billed` and `cohort` are operating only. `collected` drops `MAINTENANCE_DEPOSIT` only, so
  allocations to `OPENING_BALANCE` and apply-credit of opening credit count (L-4). `receiptsByMethod` filters
  `isOpening = false` and keeps deposits (cash basis, R3). `deposits.collected` reads `DEPOSIT_IN` with
  `countsInFundTotal = true`. `fundBalance` reads IN − OUT with `countsInFundTotal = true`.
- **Stocks.** One `flatFiguresCte` matches `summariseFlats`: balance = charges − payments, credit = payments −
  allocations, open by charge, allocations grouped by the payment's flat. It covers every flat, active or not.
  Aging uses `GREATEST(0, D − dueDate)` with buckets ≤30 / 31–60 / 61–90 / ≥91. `topOwing` is balance DESC,
  `id COLLATE "C"` ASC, the same order as the flats list's JS comparison (ASCII ids). `unapplied` takes count and
  total from window functions before `LIMIT 5`. `pendingCheques` compares the `clearedAt` DATE with D.
- **Snapshot (rule 5).** `$transaction` with `RepeatableRead`, `SET TRANSACTION READ ONLY` as the first statement,
  and every query sequential on the same client. The db-spec at `finance-dashboard.db-spec.ts:685` covers a
  concurrent posting.
- **Formatting.** `moneyText` (2 dp, no `-0.00`), `percentText` (1 dp, half up), null rate on a zero denominator,
  null delta on a zero baseline, rate delta in points.
- **Security and privacy.** `@AllowedRoles([ACCOUNTANT, ADMIN])` (SUPER_ADMIN through ADMIN); the route is not
  public, so a guest gets 401. A future `asOf` is a 400 (key exists in `finance.json`); `months` ∈ {6, 12}.
  `topOwing` carries the name only, with `ownerDeleted` for deleted accounts; there is no payer name in
  `unapplied`. The web BFF allow-lists `dashboard` with a zod query, `requireFinance` and `private, no-store`,
  and the client fetch is `no-store`. On mobile, `financeKeys.dashboard`, `audit` and `flats` sit under the
  non-persisted `finance` root with `gcTime: 0`, tested in `__tests__/finance-dashboard-cache.test.ts`.
- **Contract.** Backend DTO, web zod and mobile type agree field by field: names, `string | null` for rates and
  deltas, money as strings, counts as numbers, `ownerDeleted`, unapplied `receivedAt`, and floors with counts.
  The `PeriodStatus` enum is `OPEN | CLOSED`, matching both clients' status keys.
- **Timeline.** Both clients map all 27 `FINANCE_AUDIT_ACTIONS` with a generic fallback. `FUND_ENTRY_RECORDED`
  reads "Fund deposit", `PAYMENT_RECORDED` reads "Payment recorded", and the bounds are `from` = first of M and
  `to` = D.
- **Drilldowns.** Web `parseFlatsParams` validates `building` against `BUILDINGS`, `overdueDays` against
  30/60/90/91 (91 labelled "over 90"), `sort` and `asOf`. Later pages pin page 1's `asOf` on both clients. Mobile
  `readRoute` validates and pre-selects the chip; the building chip can be cleared.
- **Mobile traps.** No `*.test.*` under `src/app/`; `route-collisions.test.ts` adds `/finance/period`; no new
  native dependency.

## §10 rulings

| Build note | Ruling |
| --- | --- |
| 9.1 `collected` counts every charge except `MAINTENANCE_DEPOSIT` | **ACCEPT.** Q4 and L-4 require it. Update the stale "operating charges" wording in the §3.2 `collected` row |
| 9.1 deltas divide by \|previous\| | **ACCEPT.** The sign is right on a negative baseline. Write it into §3.1 |
| 9.1 `owingFlats` / `totalFlats` top-level numbers | **ACCEPT** |
| 9.1 extra fields (floor counts, unapplied `receivedAt`) | **ACCEPT.** No PII |
| 9.1 deleted owner = `ownerDeleted: true`, no name | **ACCEPT.** Stricter than Q5 asks |
| 9.1 `daysPastDue` floored at 0, differs from `oldestDueDays` | **ACCEPT.** The ≥ 91 threshold is the same on both. See L7 for the `hasBalance` interaction |
| 9.1 no separate contract-freeze task | **ACCEPT**, tied to L12 (add the generated-fixture contract test) |
| 9.2 shared custom tooltip replaces `<title>` | **ACCEPT.** Same text as sample 4 |
| 9.2 visually hidden tables; Donut/StackedBar legends | **ACCEPT** |
| 9.2 map tint normalised to the data range | **ACCEPT.** The mockup's fixed 1,800–4,400 EGP/flat range only fits its fake data; the legend reads Less/More. Web and mobile normalise the same way |
| 9.2 `--chart-*` tokens (dark + light) | **ACCEPT** |
| 9.4 12M columns ≈ 25 dp | **ACCEPT.** Contiguous full-height strips, each with an a11y label; the 6M default is about 50 dp; same density as sample 5 |
| 9.4 ring 132, no chart motion, reduced-motion sheet 1 ms | **ACCEPT** |
| 9.4 sheet flats from the parent, no "Remind all" | **ACCEPT** (§6 #1, #9) |
| 9.3 map opens on the highest-outstanding building; no "All buildings" | **ACCEPT.** Matches sample 4 (`S.sel` preset, no reset control). Strike the "All buildings clears it" sentence in §4.2 |
| 9.3 period pill plain text; period card and checklist link to `/finance/audit` | **ACCEPT.** Web has no period page (routes: `audit`, `flats`, `payments`). Re-point them when one exists |
| 9.3 timeline day + time, latest 8 rows | **ACCEPT.** A month-long list needs the day; "See all" goes to the audit page |
| 9.3 flats page reads `building`, `hasBalance`, `sort`, `asOf`, `overdueDays` | **ACCEPT.** Required by §3.3 |
| 9.5 header keeps find-flat and profile icons | **ACCEPT** (§6 #13; no tab bar in the finance stack) |
| 9.5 unapplied check row not tappable; Apply opens the flat | **ACCEPT.** The unapplied list sits directly below it on the same screen; `DashRow` drops the chevron when there is no `onPress` |
| 9.5 flats honour route params; dashboard out of the offline cache | **ACCEPT.** Tested |

## Section-by-section fidelity (what the owner should look at)

Web vs `sample-4.html`. Order matches: header, hero, KPIs, attention, map + panel, billed vs collected, aging |
methods, timeline | unapplied, top 10, checklist.

| Section | Matches | Differs (finding) |
| --- | --- | --- |
| Header | eyebrow, gold hairline, pill, two actions | h1 copy, pill format (M3); no serif (L6) |
| Hero | ring 200 (mockup 220), story sentence and sub-line copy, 3 chips | eyebrow lacks status (M3) |
| KPIs | 4 tiles, deltas good/bad tone, sparklines, colours c1/c4/err/c3 | fund deposits line (L4) |
| Attention | 4 cards, tones, links per 4.1; 4th slot cheques/period (§6 #8) | — |
| Map + panel | grid, gate label, legend, gold outline, Enter/Space, focus kept | "View flats" (L10), "Top owing flats" copy (M3) |
| Billed vs collected | fixed 12 months, legend, signed bars | — |
| Aging / methods | §6 #6 labels, donut colours, Reversed/Net line (§6 #11) | — |
| Timeline / unapplied | real actions (§6 #10), Apply → flat | day + time (accepted) |
| Top 10 | columns, >90 in red, Open › | — |
| Checklist | computed checks, ok/warn, ok-count pill + bar (§6 #5) | title copy (M3) |

Mobile vs `sample-5-mobile.html`:

| Frame | Matches | Differs (finding) |
| --- | --- | --- |
| 1 | header with pill + bell (+ find/profile, accepted), ring 132 hero, KPI snap carousel + dots, attention list with chevrons, gold FAB | bell target (L1) |
| 2 | map, 6M/12M (default 6M as mockup), aging, donut, top-owing list | titles (M3), row chevron (L2), stale state (M2) |
| 3 | sheet: code + pill, amount, floor bars, owing flats from the list API, View flats | Android back (M1), labels (M3) |
| 4 | progress, checks, unapplied with Apply, timeline | timeline row content (L3) |

## Owner click-test list

Run each in **AR and EN**, **dark and light**. Web at 1440 px and about 390 px. Mobile on the A72 after an
EAS/OTA build (only on Ahmed's go-ahead).

Web `/finance`:

1. Sign in as ACCOUNTANT, then ADMIN, then SUPER_ADMIN: the dashboard loads. A RESIDENT cannot reach `/finance`.
2. Compare with sample 4 section by section in the order above. Check RTL mirroring of chips, arrows and table
   alignment.
3. Ring: the rate and the "of this month's charges" caption. In a month with no charges: "—" and the empty
   story line.
4. KPI deltas: "—" on a zero baseline. Outstanding and owing flats turn red when they rise.
5. Hover/focus each chart: tooltips (map, bars, donut, aging) carry the same text as the mockup. Tab to a map
   building, press Enter/Space: the panel updates, the scroll stays, focus stays on the building.
6. Attention links: Unapplied → payments; Over 90 → flats list pre-filtered (owes + "over 90" + balance sort);
   Building → flats list for that building; Period/cheques card.
7. Flats list from a drilldown: "Load more" keeps the same day. Record a payment for the last flat on page 1, then
   press Load more (L8).
8. Top 10 rows open the flat; a deleted owner shows "Former owner".
9. Timeline: this month's entries with the flat and amount; an unknown action reads "Finance activity".
10. Simulate the backend down: an inline error with Retry; Record payment and Find a flat stay usable.

Mobile finance home:

1. Frame 1: the pill and the bell open Period close. The bell should land on the timeline (L1). The KPI carousel
   snaps and its dots track the card in RTL and LTR. The FAB opens Record payment.
2. Frame 2: 6M/12M switches without losing scroll or the building selection. Tap a month (12M too): the readout
   appears. Aging and donut show the Reversed/Net line.
3. Frame 3: tap a building. The sheet opens with floor bars and owing flats. Close it by swipe down, by backdrop tap
   and **by Android back** (M1). TalkBack focus returns to the building. "View flats" opens the filtered list with
   the building chip.
4. Top-owing rows open the flat ledger (chevron, L2).
5. Period close: checks ok/warn, strong warnings first. Apply opens the flat (apply-credit). The timeline shows
   this month.
6. Airplane mode: open the finance home cold → error state with Retry. With figures on screen, go offline and pull
   to refresh or switch to 12M: you must not keep seeing old figures without a warning (M2).
7. Kill and relaunch offline: no dashboard figures come from storage.
8. Reduced motion on: the sheet appears without animation.

## Fixes applied (2026-11-16)

Uncommitted in the `feature/accounting` worktree. Opus findings M1–M3, L1–L12 and Astra A1–A5. Astra items that are
the same as an Opus finding share its row.

| Finding | Status | What changed / reason |
| --- | --- | --- |
| A1 (mobile map overlaps with 12 buildings) | fixed | `mapLayout` computes the row count and canvas height from the real rows (row height 118 dp, 2 rows still 260 dp, 3 rows 394 dp), one road per row gap (`roadYs`). Tests with all 12 real codes at 3 widths: no overlapping rects, roads clear of buildings, each building's button selects only itself. Web had no overlap (rows were already derived) but squeezed 3 rows into the 2-row canvas; `mapCells` now grows the canvas the same way, with the same 12-code tests |
| M1 = A4 (Android back) | fixed | `BackHandler` registered while the sheet is open; it dismisses the sheet (`onDismiss` then `onClose` restores focus) and consumes the press. Test covers consume, `onClose`, and listener removal |
| M2 = A2 (stale figures) | fixed | Today and Period replace the figures with the error state and Retry on any failed fetch (`isError`), including a failed refetch with old data. Bars use `data.months` (the window the data covers) with `requested` and `pending` (dimmed, busy) while 6M/12M loads. Tests: load then failed refetch on both screens, pending window |
| M3 (copy drift) | fixed | Web: h1 "Finance"/"المالية", hero eyebrow "{month} · {status}", pill "Period: {status}", period card "Period: {status}", checklist "Period close"/"إقفال الفترة", panel "Top 10 owing flats"/"أعلى 10 شقق متأخرة". Mobile: "Debt aging", "Collections by method", "Total outstanding", "Arrears by floor", "6M"/"12M" in both languages. Reversed in Arabic is "مرتجع" on both |
| L1 = A5 (bell target) | fixed | Bell opens `/finance/period?section=timeline`; Period close scrolls to the timeline title once after layout. The pill still opens the top. Tests: top for the pill, one scroll for the bell |
| L2 (top-owing chevron) | fixed | RTL-mirrored `CaretRight` on `TopOwingRow` |
| L3 (timeline row content) | fixed | Row shows flat and amount from `meta.flatLabel`/`meta.amount`; the actor stays in the spoken label. Test |
| L4 (deposits) | fixed | Web: the visible line is gone; the figures are the fund tile's tooltip (focusable). Mobile has no tooltips: the figures are in the fund card's screen-reader label, recorded as spec §6 item 18 for the owner |
| L5 = A3 (float money) | fixed | New `lib/decimal-money.ts` (BigInt piasters: parse half away from zero, sum, compare, whole and one-decimal percentages, ratio cross-multiplication, compact parts) and `lib/format-money.ts` (exact beyond 2^53). Mobile donut, bars readout, building sheet, map, attention share and furthest-behind use them; numbers remain only for geometry. Web `Donut` sums and shares use `sumDecimal`/`percentTenths`, `stringToCents` rounds a third decimal. Tests at fractional-piaster boundaries (0.005, 0.1+0.2, 1/8) and 2^53 aggregates |
| L6 (display serif) | fixed | Web h1, hero h2, KPI value and building code use the display family in English only. Mobile hero title and KPI value use `FONT.display` in English only (the sheet code already did) |
| L7 (over-90 vs drilldown) | fixed | Both clients link `overdueDays=91&sort=balance` without `hasBalance` (the backend filters `oldestDueDays ≥ N` on its own). No db-spec needed since no `hasBalance` interaction remains. Spec §6 item 19 |
| L8 (stale cursor) | fixed | Web already restarted from page 1 (`fetchPage`); it now says so ("The list changed. Reload it from the start."). Mobile refetches from page 1 when `fetchNextPage` fails with `finance.error.invalidCursor` |
| L9 (share precision) | fixed | Integer percent half up on both clients (mockup "27%"); the donut shares keep one decimal |
| L10 (web "View flats") | not fixed | Useful and mirrors mobile; the owner decides. Listed in spec §6 item 16 as awaiting acceptance |
| L11 (mobile attention destination) | not fixed | `/finance/period` is the only list mobile has for unapplied payments and cheques. Spec §6 item 17 awaiting acceptance |
| L12 (test gaps) | fixed | Backend spec emits and compares `test/fixtures/finance-dashboard.contract.json` (`UPDATE_CONTRACT_FIXTURE=1` rewrites it); copies in web and mobile fixtures. Web parses it with `dashboardSchema.strict()` and checks no key is dropped; mobile asserts the key set and value types. Web `FinanceDashboardView` tests: loading, error + Retry (header actions stay), loaded copy, empty state. M1 and M2 tests listed above |
| §10 rulings | applied | Spec §3.1 (delta divisor `\|x′\|`), §3.2 (`collected` includes allocations to `OPENING_BALANCE`), §4.2 (no "All buildings"; pill behaviour per client), §6 item 15 and new items 16–19 |

Decision for the owner: items 16–19 of spec §6. Files touched: backend 1 test + 1 fixture; web 9 source/translation
files, 4 tests, 1 fixture; mobile 17 source/translation files, 8 tests, 2 libs, 1 fixture. Gates, all run after the
last edit: backend `pnpm test` 56 suites / 1086 tests and `pnpm lint:check` exit 0; `pnpm --dir apps/web check`
exit 0 (34 files / 604 tests, 64/64 pages); mobile `tsc --noemit` clean, jest 70 suites / 527 tests, eslint 0
errors (74 warnings, all existing patterns), `expo export --platform android` ok, `uniwind-types.d.ts` restored.

### Follow-up fixes after the Astra re-review (2026-11-16)

| Finding | Status | What changed |
| --- | --- | --- |
| R1 [Medium] back listener survived navigation (`building-sheet.tsx`) | fixed | The listener is registered with `useFocusEffect`, so it exists only while the screen is focused and the sheet is open. Today clears the selection (dismisses the sheet) before pushing a flat or "View flats". Tests: no listener while unfocused; the sheet is gone after the push |
| R2 [Medium] scroll-to-timeline ran too early (`period.tsx`) | fixed | The scroll runs once the dashboard and audit queries have settled and the timeline title has laid out (next animation frame, once). Test with delayed audit data: no scroll while loading, one scroll after the rows arrive |
| R2b [Medium] scroll flag cleared too early (`period.tsx`) | fixed | The pending flag is cleared only after `scrollToOffset` runs on a mounted list. A scroll needs a successful, settled dashboard and audit, and a timeline layout measured after the data (the layout resets on error so Retry re-measures). Test: error, then Retry, then late layout, then exactly one scroll |
| R2c [Medium] scroll could still be clamped (`period.tsx`) | fixed | The list reports `onContentSizeChange`; the scroll is attempted only after a content-size change observed once the dashboard succeeded and the audit settled, with the list mounted and the title measured. The flag clears after `scrollToOffset`; the measurements reset on error so Retry re-measures. Test: layout and a size event while loading give no scroll, a settled audit alone gives none, growth after settle gives exactly one scroll at the measured offset |
| R3 [Medium] error state dropped the FAB (`today.tsx`) | fixed | `RecordPaymentFab` is rendered in the error state too, next to the header navigation. Test |
| R4 [Low, L12] contract test | fixed | Walks every array element, compares key paths and value types, and asserts the backend, web and mobile fixture copies are byte-identical |

Gates after these edits: mobile `tsc --noemit` clean, jest 70 suites / 530 tests, eslint 0 errors, `expo export --platform android` ok, `uniwind-types.d.ts` restored. Web and backend untouched.
