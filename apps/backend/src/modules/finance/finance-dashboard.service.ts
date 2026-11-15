import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import {
    BillingRunStatus,
    FinancePaymentMethod,
    ImportBatchStatus,
    OwnershipClosedReason,
    PeriodStatus,
    Prisma,
} from '@prisma/client';

import {
    cairoToday,
    dateOnlyString,
    parseDateOnly,
    periodOf,
} from 'src/common/finance/cairo-date';
import { GROUND_FLOOR } from 'src/common/finance/compound-layout';
import { DatabaseService } from 'src/common/database/services/database.service';

import { FinanceDashboardQueryDto } from './dtos/request/finance-query.dto';
import {
    FinanceDashboardBuildingDto,
    FinanceDashboardCohortDto,
    FinanceDashboardDto,
    FinanceDashboardTopOwingDto,
} from './dtos/response/finance-dashboard.response.dto';
import {
    deltaText,
    moneyText,
    percentText,
    pointsDeltaText,
    ratePercent,
} from './finance-dashboard.format';
import { FinanceReader } from './kernel/finance-tx';
import {
    FlowBucket,
    flowBuckets,
    FlowRow,
    monthBuckets,
    periodEnd,
    periodStart,
    sameDayLastMonth,
} from './kernel/flow-buckets';
import {
    AsOfSql,
    asOfPointsSql,
    asOfSql,
    liveAllocationSpanSql,
    liveAllocationSql,
    liveChargeSpanSql,
    liveChargeSql,
    liveFundEntrySpanSql,
    liveFundEntrySql,
    LiveSpanSql,
    livePaymentSpanSql,
    livePaymentSql,
    pointAsOf,
    spanEnd,
} from './kernel/live-predicates.sql';

const ZERO = new Prisma.Decimal(0);
type Decimal = Prisma.Decimal;

/** One read-only snapshot for every figure (slice 9 rule 5). */
export const DASHBOARD_TX_OPTIONS = {
    isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
    maxWait: 10_000,
    timeout: 30_000,
} as const;

const METHODS: readonly FinancePaymentMethod[] = [
    FinancePaymentMethod.CASH,
    FinancePaymentMethod.BANK_TRANSFER,
    FinancePaymentMethod.INSTAPAY,
    FinancePaymentMethod.CHEQUE,
];

/**
 * Charge class for flows, alias `c`: `OP` operating (not OPENING_BALANCE, not
 * MAINTENANCE_DEPOSIT: past debt and fund capital, plan 4.6 / R4), `DEP`
 * deposit, `OPEN` opening balance.
 */
const CHARGE_CLASS = Prisma.sql`CASE c."kind" WHEN 'MAINTENANCE_DEPOSIT' THEN 'DEP' WHEN 'OPENING_BALANCE' THEN 'OPEN' ELSE 'OP' END`;
const OPERATING = Prisma.sql`c."kind" NOT IN ('OPENING_BALANCE', 'MAINTENANCE_DEPOSIT')`;

/** An allocation with its charge `c` and its payment `p` (the live view). */
const ALLOCATIONS_JOINED = Prisma.sql`"payment_allocations" a JOIN "charges" c ON c."id" = a."chargeId" JOIN "finance_live_payments" p ON p."id" = a."paymentId"`;

interface SpanRow {
    key: string;
    start: Date;
    endDate: Date | null;
    endAt: Date | null;
    amount: Decimal;
}

interface CohortRow {
    idx: number;
    charges: Decimal;
    allocated: Decimal;
    count: number;
}

interface PointRow {
    idx: number;
    outstanding: Decimal;
    owingFlats: number;
    fundBalance: Decimal;
}

interface TotalsRow {
    outstanding: Decimal;
    current: Decimal;
    d31_60: Decimal;
    d61_90: Decimal;
    over90: Decimal;
    owingFlats: number;
    totalFlats: number;
    netCreditFlats: number;
    netCreditTotal: Decimal;
    creditTotal: Decimal;
}

interface FloorRow {
    building: string;
    floor: string;
    totalFlats: number;
    owingFlats: number;
    outstanding: Decimal;
}

interface TopRow {
    id: string;
    label: string;
    balance: Decimal;
    dpd: number;
}

interface UnappliedRow {
    id: string;
    flatId: string;
    label: string;
    method: FinancePaymentMethod;
    receivedAt: Date;
    unallocated: Decimal;
    ageDays: number;
    count: number;
    total: Decimal;
}

/** One row of `flatStock`: a `totals`, `floor` or `top` row (unused columns null). */
type FlatStockRow = { kind: 'totals' | 'floor' | 'top' } & {
    [K in keyof (TotalsRow & FloorRow & TopRow & { rank: number })]:
        | (TotalsRow & FloorRow & TopRow & { rank: number })[K]
        | null;
};

interface CountTotalRow {
    count: number;
    total: Decimal;
}

/** The one result of a single-bucket call / single-row query. */
function only<T>(values: readonly T[]): T {
    const value = values[0];
    if (value === undefined) throw new Error('expected one row');
    return value;
}

function flowRows(
    rows: readonly SpanRow[],
    keep: (key: string) => boolean = () => true
): FlowRow[] {
    return rows
        .filter(r => keep(r.key))
        .map(r => ({
            amount: r.amount,
            start: r.start,
            end: spanEnd(r.endDate, r.endAt),
        }));
}

function cohortDto(row: CohortRow | undefined): {
    dto: FinanceDashboardCohortDto;
    rate: Decimal | null;
} {
    const charges = row?.charges ?? ZERO;
    const allocated = row?.allocated ?? ZERO;
    const rate = ratePercent(allocated, charges);
    return {
        dto: {
            charges: moneyText(charges),
            allocated: moneyText(allocated),
            open: moneyText(charges.sub(allocated)),
            rate: rate === null ? null : percentText(rate),
        },
        rate,
    };
}

const floorRank = (floor: string): number =>
    floor === GROUND_FLOOR ? 0 : Number(floor) || 99;

/**
 * Per-flat figures as of D in SQL (`summariseFlats` semantics): `co` = live
 * charges with their open amount and days past due (floored at 0); `ff` =
 * every flat (active or not) with balance, credit and open amount. Balance =
 * charges − payments, credit = payments − allocations, so Σ open = Σ balance
 * + Σ credit.
 */
function flatFiguresCte(d: AsOfSql): Prisma.Sql {
    return Prisma.sql`WITH ch AS (
    SELECT c."id", c."flatId", c."amount", c."dueDate" FROM "charges" c WHERE ${liveChargeSql(d)}
), al AS (
    SELECT a."chargeId", p."flatId", a."amount" FROM ${ALLOCATIONS_JOINED} WHERE ${liveAllocationSql(d)}
), alc AS (
    SELECT "chargeId", SUM("amount") AS "amount" FROM al GROUP BY 1
), alf AS (
    SELECT "flatId", SUM("amount") AS "amount" FROM al GROUP BY 1
), pay AS (
    SELECT p."flatId", SUM(p."amount") AS "amount" FROM "finance_live_payments" p WHERE ${livePaymentSql(d)} GROUP BY 1
), co AS (
    SELECT ch."flatId", ch."amount", ch."amount" - COALESCE(alc."amount", 0) AS "open",
           GREATEST(0, ${d.day} - ch."dueDate") AS "dpd"
      FROM ch LEFT JOIN alc ON alc."chargeId" = ch."id"
), cf AS (
    SELECT "flatId", SUM("amount") AS "charged", SUM("open") AS "open",
           MAX("dpd") FILTER (WHERE "open" > 0) AS "dpd"
      FROM co GROUP BY 1
), ff AS (
    SELECT f."id", f."label", f."building", f."floor",
           COALESCE(cf."charged", 0) - COALESCE(pay."amount", 0) AS "balance",
           COALESCE(pay."amount", 0) - COALESCE(alf."amount", 0) AS "credit",
           COALESCE(cf."open", 0) AS "open",
           cf."dpd"
      FROM "flats" f
      LEFT JOIN cf ON cf."flatId" = f."id"
      LEFT JOIN pay ON pay."flatId" = f."id"
      LEFT JOIN alf ON alf."flatId" = f."id"
)`;
}

/**
 * `GET /finance/dashboard` (slice 9): a read-only subset of R3, R4, R6 and R8
 * as of one Cairo date D. Every figure reads the shared live predicates
 * (`kernel/live-predicates.sql.ts`, the `finance_live_payments` view); flows
 * follow N-1 through `kernel/flow-buckets.ts`; stock figures use D once. All
 * queries run in one read-only REPEATABLE READ transaction.
 */
@Injectable()
export class FinanceDashboardService {
    private readonly logger = new Logger(FinanceDashboardService.name);

    constructor(private readonly db: DatabaseService) {}

    async dashboard(
        query: FinanceDashboardQueryDto
    ): Promise<FinanceDashboardDto> {
        const today = cairoToday();
        const asOf = query.asOf ? parseDateOnly(query.asOf) : today;
        if (asOf.getTime() > today.getTime())
            throw new BadRequestException('finance.error.futureDate');
        const months = query.months ?? 12;

        const startedAt = Date.now();
        const result = await this.db.$transaction(async tx => {
            await tx.$executeRaw`SET TRANSACTION READ ONLY`;
            return this.build(tx, asOf, months);
        }, DASHBOARD_TX_OPTIONS);
        this.logger.log(
            `finance dashboard asOf=${dateOnlyString(asOf)} months=${months} ${Date.now() - startedAt}ms`
        );
        return result;
    }

    /** Every figure, on one client (the snapshot transaction). */
    async build(
        client: FinanceReader,
        asOf: Date,
        months: number
    ): Promise<FinanceDashboardDto> {
        const period = periodOf(asOf);
        const previousAsOf = sameDayLastMonth(asOf);
        const buckets = monthBuckets(asOf, months);
        const windowFrom = only(buckets).from;
        const monthBucket: FlowBucket[] = [
            { from: periodStart(period), to: asOf },
        ];
        const previousBucket: FlowBucket[] = [
            { from: periodStart(periodOf(previousAsOf)), to: previousAsOf },
        ];
        const d = asOfSql(asOf);

        // Sequential on purpose: one transaction is one connection.
        const periodRow = await client.fiscalPeriod.findUnique({
            where: { period },
            select: { status: true },
        });
        const cohorts = await this.cohorts(client, [asOf, previousAsOf]);
        const { totals, floors, top } = await this.flatStock(client, d);
        const owners = await this.owners(
            client,
            top.map(t => t.id)
        );
        const points = await this.points(client, [
            ...buckets.map(b => b.to),
            previousAsOf,
        ]);
        const chargeSpans = await this.spans(client, {
            from: Prisma.sql`"charges" c`,
            key: CHARGE_CLASS,
            span: liveChargeSpanSql(),
            amount: Prisma.sql`c."amount"`,
            where: Prisma.sql`TRUE`,
            windowFrom,
            asOf,
        });
        const allocationSpans = await this.spans(client, {
            from: ALLOCATIONS_JOINED,
            key: CHARGE_CLASS,
            span: liveAllocationSpanSql(),
            amount: Prisma.sql`a."amount"`,
            where: Prisma.sql`TRUE`,
            windowFrom,
            asOf,
        });
        const paymentSpans = await this.spans(client, {
            from: Prisma.sql`"finance_live_payments" p`,
            key: Prisma.sql`p."method"::text`,
            span: livePaymentSpanSql(),
            amount: Prisma.sql`p."amount"`,
            where: Prisma.sql`p."isOpening" = false`,
            windowFrom,
            asOf,
        });
        const fundSpans = await this.spans(client, {
            from: Prisma.sql`"fund_entries" f`,
            key: Prisma.sql`'DEPOSIT_IN'`,
            span: liveFundEntrySpanSql(),
            amount: Prisma.sql`f."amount"`,
            where: Prisma.sql`f."kind" = 'DEPOSIT_IN' AND f."countsInFundTotal" = true`,
            windowFrom,
            asOf,
        });
        const unapplied = await this.unapplied(client, d);
        const pending = await this.pendingCheques(client, d);
        const previewBillingRuns = await client.billingRun.count({
            where: { status: BillingRunStatus.PREVIEW, accrualPeriod: period },
        });
        const previewImportBatches = await client.importBatch.count({
            where: {
                status: ImportBatchStatus.PREVIEW,
                asOf: { gte: periodStart(period), lte: periodEnd(period) },
            },
        });

        // Flows (N-1).
        const billed = flowBuckets(
            flowRows(chargeSpans, k => k === 'OP'),
            buckets
        );
        // Q4 / L-4: every allocation except to a MAINTENANCE_DEPOSIT charge (fund
        // capital, R4) is a collection, including one to an OPENING_BALANCE
        // charge and an apply-credit of opening credit; no isOpening filter.
        const collectedRows = flowRows(allocationSpans, k => k !== 'DEP');
        const collected = flowBuckets(collectedRows, buckets);
        const collectedNow = collected[collected.length - 1]?.net ?? ZERO;
        const collectedBefore = only(
            flowBuckets(collectedRows, previousBucket)
        ).net;
        const receipts = METHODS.map(method => {
            const t = only(
                flowBuckets(
                    flowRows(paymentSpans, k => k === method),
                    monthBucket
                )
            );
            return {
                method,
                gross: moneyText(t.gross),
                reversed: moneyText(t.reversed),
                net: moneyText(t.net),
            };
        });
        const depositsBilled = only(
            flowBuckets(
                flowRows(chargeSpans, k => k === 'DEP'),
                monthBucket
            )
        ).net;
        const depositsCollected = only(
            flowBuckets(flowRows(fundSpans), monthBucket)
        ).net;

        // Stock (as of D, and as of each month end / D′).
        const now = cohortDto(cohorts.get(0));
        const before = cohortDto(cohorts.get(1));
        const pointAt = (i: number): PointRow => {
            const row = points.get(i);
            return {
                idx: i,
                outstanding: row?.outstanding ?? ZERO,
                owingFlats: row?.owingFlats ?? 0,
                fundBalance: row?.fundBalance ?? ZERO,
            };
        };
        const atD = pointAt(buckets.length - 1);
        const atPrevious = pointAt(buckets.length);

        return {
            asOf: dateOnlyString(asOf),
            months,
            period: {
                period,
                status: periodRow?.status ?? PeriodStatus.OPEN,
            },
            cohort: now.dto,
            billed: buckets.map((b, i) => ({
                period: b.period,
                amount: moneyText(billed[i]?.net ?? ZERO),
            })),
            collected: buckets.map((b, i) => ({
                period: b.period,
                amount: moneyText(collected[i]?.net ?? ZERO),
            })),
            receiptsByMethod: receipts,
            outstanding: moneyText(totals.outstanding),
            credit: {
                netCreditFlats: totals.netCreditFlats,
                netCreditTotal: moneyText(totals.netCreditTotal),
                creditTotal: moneyText(totals.creditTotal),
            },
            aging: {
                current: moneyText(totals.current),
                d31_60: moneyText(totals.d31_60),
                d61_90: moneyText(totals.d61_90),
                over90: moneyText(totals.over90),
            },
            owingFlats: totals.owingFlats,
            totalFlats: totals.totalFlats,
            fundBalance: moneyText(atD.fundBalance),
            deposits: {
                billed: moneyText(depositsBilled),
                collected: moneyText(depositsCollected),
            },
            unapplied: {
                count: unapplied[0]?.count ?? 0,
                total: moneyText(unapplied[0]?.total ?? ZERO),
                oldest: unapplied.map(u => ({
                    paymentId: u.id,
                    flatId: u.flatId,
                    flatLabel: u.label,
                    method: u.method,
                    receivedAt: dateOnlyString(u.receivedAt),
                    unallocated: moneyText(u.unallocated),
                    ageDays: u.ageDays,
                })),
            },
            pendingCheques: {
                count: pending.count,
                total: moneyText(pending.total),
            },
            checks: {
                previewBillingRuns,
                previewImportBatches,
                operatingChargesInMonth: cohorts.get(0)?.count ?? 0,
            },
            byBuilding: this.buildings(floors),
            topOwing: top.map(t => ({
                flatId: t.id,
                label: t.label,
                ...(owners.get(t.id) ?? {
                    ownerName: null,
                    ownerDeleted: false,
                }),
                balance: moneyText(t.balance),
                daysPastDue: t.dpd,
            })),
            series: buckets.map((b, i) => {
                const p = pointAt(i);
                return {
                    period: b.period,
                    date: dateOnlyString(b.to),
                    outstanding: moneyText(p.outstanding),
                    owingFlats: p.owingFlats,
                    fundBalance: moneyText(p.fundBalance),
                };
            }),
            previous: {
                asOf: dateOnlyString(previousAsOf),
                cohort: before.dto,
                collected: moneyText(collectedBefore),
                outstanding: moneyText(atPrevious.outstanding),
                owingFlats: atPrevious.owingFlats,
                fundBalance: moneyText(atPrevious.fundBalance),
            },
            deltas: {
                collected: deltaText(collectedNow, collectedBefore),
                outstanding: deltaText(atD.outstanding, atPrevious.outstanding),
                owingFlats: deltaText(
                    new Prisma.Decimal(atD.owingFlats),
                    new Prisma.Decimal(atPrevious.owingFlats)
                ),
                fundBalance: deltaText(atD.fundBalance, atPrevious.fundBalance),
                rate: pointsDeltaText(now.rate, before.rate),
            },
        };
    }

    /** `cohort` at each date X: the month-of-X operating charges live as of X, and their live allocations. */
    private async cohorts(
        client: FinanceReader,
        dates: readonly Date[]
    ): Promise<Map<number, CohortRow>> {
        const pt = pointAsOf();
        const sameMonth = Prisma.sql`c."accrualPeriod" = ${pt.period}`;
        const rows = await client.$queryRaw<CohortRow[]>(Prisma.sql`
SELECT pt."idx",
    (SELECT COALESCE(SUM(c."amount"), 0) FROM "charges" c
      WHERE ${OPERATING} AND ${sameMonth} AND ${liveChargeSql(pt)}) AS "charges",
    (SELECT COUNT(*)::int FROM "charges" c
      WHERE ${OPERATING} AND ${sameMonth} AND ${liveChargeSql(pt)}) AS "count",
    (SELECT COALESCE(SUM(a."amount"), 0) FROM ${ALLOCATIONS_JOINED}
      WHERE ${OPERATING} AND ${sameMonth} AND ${liveAllocationSql(pt)}) AS "allocated"
FROM ${asOfPointsSql(dates)}`);
        return new Map(rows.map(r => [r.idx, r]));
    }

    /**
     * Outstanding, owing flats and fund balance at each date, in one query
     * and one pass per table: each point is a `SUM(...) FILTER (WHERE <live
     * as of that point>)` column, so no row is multiplied by the number of
     * points and nothing runs per point or per flat outside SQL.
     */
    private async points(
        client: FinanceReader,
        dates: readonly Date[]
    ): Promise<Map<number, PointRow>> {
        const at = dates.map(asOfSql);
        const cols = (
            f: (d: AsOfSql, name: (prefix: string) => Prisma.Sql) => Prisma.Sql
        ) =>
            Prisma.join(
                at.map((d, i) => f(d, prefix => Prisma.raw(`"${prefix}${i}"`))),
                ', '
            );
        const rows = await client.$queryRaw<
            Record<string, unknown>[]
        >(Prisma.sql`
WITH cb AS (
    SELECT c."flatId", ${cols((d, n) => Prisma.sql`COALESCE(SUM(c."amount") FILTER (WHERE ${liveChargeSql(d)}), 0) AS ${n('b')}`)}
      FROM "charges" c GROUP BY 1
), pb AS (
    SELECT p."flatId", ${cols((d, n) => Prisma.sql`COALESCE(SUM(p."amount") FILTER (WHERE ${livePaymentSql(d)}), 0) AS ${n('b')}`)}
      FROM "finance_live_payments" p GROUP BY 1
), ow AS (
    SELECT ${cols((_, n) => Prisma.sql`(COUNT(*) FILTER (WHERE COALESCE(cb.${n('b')}, 0) - COALESCE(pb.${n('b')}, 0) > 0))::int AS ${n('owing')}`)}
      FROM cb FULL JOIN pb ON pb."flatId" = cb."flatId"
), ch AS (
    SELECT ${cols((_, n) => Prisma.sql`COALESCE(SUM(cb.${n('b')}), 0) AS ${n('charged')}`)} FROM cb
), al AS (
    SELECT ${cols((d, n) => Prisma.sql`COALESCE(SUM(a."amount") FILTER (WHERE ${liveAllocationSql(d)}), 0) AS ${n('allocated')}`)}
      FROM ${ALLOCATIONS_JOINED}
), fu AS (
    SELECT ${cols((d, n) => Prisma.sql`COALESCE(SUM(CASE WHEN f."direction" = 'IN' THEN f."amount" ELSE -f."amount" END) FILTER (WHERE ${liveFundEntrySql(d)}), 0) AS ${n('fund')}`)}
      FROM "fund_entries" f WHERE f."countsInFundTotal" = true
)
SELECT * FROM ow CROSS JOIN ch CROSS JOIN al CROSS JOIN fu`);
        const row = only(rows);
        const money = (key: string): Prisma.Decimal => {
            const value = row[key];
            return value instanceof Prisma.Decimal ? value : ZERO;
        };
        return new Map(
            dates.map((_, idx) => [
                idx,
                {
                    idx,
                    outstanding: money(`charged${idx}`).sub(
                        money(`allocated${idx}`)
                    ),
                    owingFlats: Number(row[`owing${idx}`] ?? 0),
                    fundBalance: money(`fund${idx}`),
                },
            ])
        );
    }

    /**
     * The stock figures of D that need per-flat figures, in ONE statement so
     * `flatFiguresCte` is computed once: a `totals` row (outstanding, aging,
     * owing / net-credit counts, credit), one `floor` row per building and
     * floor, and the `top` 10 owing flats (balance DESC, id ASC in code-unit
     * order, the flats list `sort=balance` order), told apart by `kind`.
     */
    private async flatStock(
        client: FinanceReader,
        d: AsOfSql
    ): Promise<{ totals: TotalsRow; floors: FloorRow[]; top: TopRow[] }> {
        const rows = await client.$queryRaw<
            FlatStockRow[]
        >(Prisma.sql`${flatFiguresCte(d)}
SELECT 'totals' AS "kind", NULL::text AS "building", NULL::text AS "floor", NULL::text AS "id", NULL::text AS "label",
       x."outstanding", x."current", x."d31_60", x."d61_90", x."over90",
       y."owingFlats", y."totalFlats", y."netCreditFlats", y."netCreditTotal", y."creditTotal",
       NULL::numeric AS "balance", NULL::int AS "dpd", NULL::int AS "rank"
  FROM (
    SELECT COALESCE(SUM("open"), 0) AS "outstanding",
           COALESCE(SUM("open") FILTER (WHERE "dpd" <= 30), 0) AS "current",
           COALESCE(SUM("open") FILTER (WHERE "dpd" BETWEEN 31 AND 60), 0) AS "d31_60",
           COALESCE(SUM("open") FILTER (WHERE "dpd" BETWEEN 61 AND 90), 0) AS "d61_90",
           COALESCE(SUM("open") FILTER (WHERE "dpd" >= 91), 0) AS "over90"
      FROM co
  ) x CROSS JOIN (
    SELECT (COUNT(*) FILTER (WHERE "balance" > 0))::int AS "owingFlats",
           COUNT(*)::int AS "totalFlats",
           (COUNT(*) FILTER (WHERE "balance" < 0))::int AS "netCreditFlats",
           COALESCE(SUM(-"balance") FILTER (WHERE "balance" < 0), 0) AS "netCreditTotal",
           COALESCE(SUM("credit"), 0) AS "creditTotal"
      FROM ff
  ) y
UNION ALL
SELECT 'floor', "building", "floor", NULL, NULL,
       COALESCE(SUM("open"), 0), NULL, NULL, NULL, NULL,
       (COUNT(*) FILTER (WHERE "balance" > 0))::int, COUNT(*)::int, NULL, NULL, NULL,
       NULL, NULL, NULL
  FROM ff GROUP BY "building", "floor"
UNION ALL
SELECT 'top', NULL, NULL, t."id", t."label",
       NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
       t."balance", t."dpd", t."rank"
  FROM (
    SELECT "id", "label", "balance", COALESCE("dpd", 0)::int AS "dpd",
           (ROW_NUMBER() OVER (ORDER BY "balance" DESC, "id" COLLATE "C" ASC))::int AS "rank"
      FROM ff WHERE "balance" > 0
  ) t
 WHERE t."rank" <= 10`);
        const totalsRow = only(rows.filter(r => r.kind === 'totals'));
        return {
            totals: {
                outstanding: totalsRow.outstanding ?? ZERO,
                current: totalsRow.current ?? ZERO,
                d31_60: totalsRow.d31_60 ?? ZERO,
                d61_90: totalsRow.d61_90 ?? ZERO,
                over90: totalsRow.over90 ?? ZERO,
                owingFlats: totalsRow.owingFlats ?? 0,
                totalFlats: totalsRow.totalFlats ?? 0,
                netCreditFlats: totalsRow.netCreditFlats ?? 0,
                netCreditTotal: totalsRow.netCreditTotal ?? ZERO,
                creditTotal: totalsRow.creditTotal ?? ZERO,
            },
            floors: rows
                .filter(r => r.kind === 'floor')
                .map(r => ({
                    building: r.building ?? '',
                    floor: r.floor ?? '',
                    totalFlats: r.totalFlats ?? 0,
                    owingFlats: r.owingFlats ?? 0,
                    outstanding: r.outstanding ?? ZERO,
                })),
            top: rows
                .filter(r => r.kind === 'top')
                .sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0))
                .map(r => ({
                    id: r.id ?? '',
                    label: r.label ?? '',
                    balance: r.balance ?? ZERO,
                    dpd: r.dpd ?? 0,
                })),
        };
    }

    /** Live payments as of D with money not allocated as of D: the 5 oldest plus count and total. */
    private unapplied(
        client: FinanceReader,
        d: AsOfSql
    ): Promise<UnappliedRow[]> {
        return client.$queryRaw<UnappliedRow[]>(Prisma.sql`
WITH lp AS (
    SELECT p."id", p."flatId", p."method", p."amount", p."receivedAt"
      FROM "finance_live_payments" p WHERE ${livePaymentSql(d)}
), la AS (
    SELECT a."paymentId", SUM(a."amount") AS "amount"
      FROM ${ALLOCATIONS_JOINED} WHERE ${liveAllocationSql(d)} GROUP BY 1
), u AS (
    SELECT lp.*, lp."amount" - COALESCE(la."amount", 0) AS "unallocated"
      FROM lp LEFT JOIN la ON la."paymentId" = lp."id"
)
SELECT u."id", u."flatId", f."label", u."method"::text AS "method", u."receivedAt", u."unallocated",
       (${d.day} - u."receivedAt")::int AS "ageDays",
       (COUNT(*) OVER ())::int AS "count",
       SUM(u."unallocated") OVER () AS "total"
  FROM u JOIN "flats" f ON f."id" = u."flatId"
 WHERE u."unallocated" > 0
 ORDER BY u."receivedAt" ASC, u."id" COLLATE "C" ASC
 LIMIT 5`);
    }

    /** Live cheques as of D not cleared by D. */
    private async pendingCheques(
        client: FinanceReader,
        d: AsOfSql
    ): Promise<CountTotalRow> {
        const rows = await client.$queryRaw<CountTotalRow[]>(Prisma.sql`
SELECT COUNT(*)::int AS "count", COALESCE(SUM(p."amount"), 0) AS "total"
  FROM "finance_live_payments" p
 WHERE ${livePaymentSql(d)} AND p."method" = 'CHEQUE'
   AND (p."clearedAt" IS NULL OR p."clearedAt" > ${d.day})`);
        return only(rows);
    }

    /**
     * Rows of one flow figure, pre-aggregated by live span (same span, summed)
     * and limited to what can land in the window: started by D, and either
     * started in the window or ended (possibly) inside it.
     */
    private spans(
        client: FinanceReader,
        args: {
            from: Prisma.Sql;
            key: Prisma.Sql;
            span: LiveSpanSql;
            amount: Prisma.Sql;
            where: Prisma.Sql;
            windowFrom: Date;
            asOf: Date;
        }
    ): Promise<SpanRow[]> {
        const from = dateOnlyString(args.windowFrom);
        return client.$queryRaw<SpanRow[]>(Prisma.sql`
SELECT s."key", s."start", s."endDate", s."endAt", SUM(s."amount") AS "amount" FROM (
    SELECT ${args.key} AS "key", ${args.span.start} AS "start", ${args.span.endDate} AS "endDate",
           ${args.span.endAt} AS "endAt", ${args.amount} AS "amount"
      FROM ${args.from} WHERE ${args.where}
) s
 WHERE s."start" <= ${dateOnlyString(args.asOf)}::date
   AND (s."start" >= ${from}::date
        OR s."endDate" >= ${from}::date
        OR s."endAt" >= ${from}::date - 1)
 GROUP BY 1, 2, 3, 4`);
    }

    /**
     * Current owner per flat (registry state, not as of D). A flat whose last
     * owner account was deleted (period closed ACCOUNT_DELETED, or an open
     * period of a deleted user) reports `ownerDeleted` with no name.
     */
    private async owners(
        client: FinanceReader,
        flatIds: string[]
    ): Promise<
        Map<
            string,
            Pick<FinanceDashboardTopOwingDto, 'ownerName' | 'ownerDeleted'>
        >
    > {
        const out = new Map<
            string,
            Pick<FinanceDashboardTopOwingDto, 'ownerName' | 'ownerDeleted'>
        >();
        if (flatIds.length === 0) return out;
        const rows = await client.flatOwnership.findMany({
            where: { flatId: { in: flatIds } },
            orderBy: [
                { fromDate: 'desc' },
                { createdAt: 'desc' },
                { id: 'desc' },
            ],
            select: {
                flatId: true,
                toDate: true,
                closedReason: true,
                user: { select: { name: true, deletedAt: true } },
            },
        });
        for (const row of rows) {
            if (out.has(row.flatId)) continue;
            if (row.toDate === null) {
                const deleted = row.user.deletedAt !== null;
                out.set(row.flatId, {
                    ownerName: deleted ? null : row.user.name,
                    ownerDeleted: deleted,
                });
            } else {
                out.set(row.flatId, {
                    ownerName: null,
                    ownerDeleted:
                        row.closedReason ===
                        OwnershipClosedReason.ACCOUNT_DELETED,
                });
            }
        }
        return out;
    }

    /** Floors nested under buildings; buildings by code, floors G first. */
    private buildings(
        rows: readonly FloorRow[]
    ): FinanceDashboardBuildingDto[] {
        const byCode = new Map<
            string,
            {
                owing: number;
                total: number;
                outstanding: Decimal;
                floors: FloorRow[];
            }
        >();
        for (const row of rows) {
            const b = byCode.get(row.building) ?? {
                owing: 0,
                total: 0,
                outstanding: ZERO,
                floors: [],
            };
            b.owing += row.owingFlats;
            b.total += row.totalFlats;
            b.outstanding = b.outstanding.add(row.outstanding);
            b.floors.push(row);
            byCode.set(row.building, b);
        }
        return [...byCode.entries()]
            .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
            .map(([building, b]) => ({
                building,
                totalFlats: b.total,
                owingFlats: b.owing,
                outstanding: moneyText(b.outstanding),
                floors: [...b.floors]
                    .sort((x, y) => floorRank(x.floor) - floorRank(y.floor))
                    .map(f => ({
                        floor: f.floor,
                        totalFlats: f.totalFlats,
                        owingFlats: f.owingFlats,
                        outstanding: moneyText(f.outstanding),
                    })),
            }));
    }
}
