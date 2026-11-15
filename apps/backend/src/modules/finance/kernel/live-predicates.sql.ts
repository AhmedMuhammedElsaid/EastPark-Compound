import { Prisma } from '@prisma/client';

import {
    cairoDate,
    dateOnlyString,
    periodOf,
} from 'src/common/finance/cairo-date';

import { endOfCairoDay } from './live-predicates';

/*
 * The raw-SQL twins of `live-predicates.ts` (plan 2.1.1), for the aggregate
 * reads (slice 9 dashboard, Phase 3 reports). Same rules, same columns; a
 * parity db-spec runs each fragment and its Prisma twin over one seeded
 * ledger at several dates and asserts the same row ids. Nothing outside
 * `kernel/` may compare `voidedAt` / `bouncedAt` or spell `'POSTED'` itself.
 *
 * Dates never depend on the session time zone: the as-of day is sent as
 * `'YYYY-MM-DD'::date`, and the first instant after that Cairo day
 * (`endOfCairoDay`) as tz-less UTC text cast to `::timestamp`, because the
 * `voidedAt` columns are `timestamp(3)` holding UTC.
 */

/** An as-of date D in SQL: the DATE value and the instant its Cairo day ends. */
export interface AsOfSql {
    /** A `date` expression (D). */
    day: Prisma.Sql;
    /** A `timestamp` expression: the first instant after Cairo day D (UTC). */
    end: Prisma.Sql;
    /** A `text` expression: D's `YYYY-MM` period (`periodOf(D)`). */
    period: Prisma.Sql;
}

const ALIAS = /^[a-z_][a-z0-9_]*$/;

function col(alias: string, column: string): Prisma.Sql {
    if (!ALIAS.test(alias)) throw new Error(`bad SQL alias: ${alias}`);
    return Prisma.raw(`${alias}."${column}"`);
}

/** `'YYYY-MM-DDTHH:mm:ss.sss'` (UTC, no zone) for a `::timestamp` cast. */
export function utcTimestampText(at: Date): string {
    return at.toISOString().slice(0, 23);
}

/** D as SQL parameters. */
export function asOfSql(asOf: Date): AsOfSql {
    return {
        day: Prisma.sql`${dateOnlyString(asOf)}::date`,
        end: Prisma.sql`${utcTimestampText(endOfCairoDay(asOf))}::timestamp`,
        period: Prisma.sql`${periodOf(asOf)}::text`,
    };
}

/** Several as-of dates as `VALUES (idx, day, "end"), …` rows. */
function asOfValuesSql(dates: readonly Date[]): Prisma.Sql {
    if (dates.length === 0) throw new Error('no as-of points');
    const rows = dates.map(
        (d, i) =>
            Prisma.sql`(${i}::int, ${dateOnlyString(d)}::date, ${utcTimestampText(endOfCairoDay(d))}::timestamp)`
    );
    return Prisma.sql`VALUES ${Prisma.join(rows)}`;
}

/**
 * Several as-of dates as a FROM item `(VALUES …) AS alias(idx, day, "end")`,
 * so one query evaluates a figure at every point (month ends of a series).
 * Use the columns through `pointAsOf(alias)`.
 */
export function asOfPointsSql(
    dates: readonly Date[],
    alias = 'pt'
): Prisma.Sql {
    if (!ALIAS.test(alias)) throw new Error(`bad SQL alias: ${alias}`);
    return Prisma.sql`(${asOfValuesSql(dates)}) AS ${Prisma.raw(alias)}("idx", "day", "end")`;
}

/** The as-of columns of an `asOfPointsSql` row. */
export function pointAsOf(alias = 'pt'): AsOfSql {
    return {
        day: col(alias, 'day'),
        end: col(alias, 'end'),
        period: Prisma.sql`to_char(${col(alias, 'day')}, 'YYYY-MM')`,
    };
}

/** `liveChargeWhere` on alias `c` (a `charges` row). */
export function liveChargeSql(d: AsOfSql, c = 'c'): Prisma.Sql {
    return Prisma.sql`(${col(c, 'accrualPeriod')} <= ${d.period} AND (${col(c, 'status')} = 'POSTED' OR ${col(c, 'voidedAt')} >= ${d.end}))`;
}

/** `livePaymentWhere` on alias `p` (a `finance_live_payments` row). */
export function livePaymentSql(d: AsOfSql, p = 'p'): Prisma.Sql {
    return Prisma.sql`(${col(p, 'receivedAt')} <= ${d.day} AND (${col(p, 'status')} = 'POSTED' OR ${col(p, 'voidedAt')} >= ${d.end}) AND (${col(p, 'bouncedAt')} IS NULL OR ${col(p, 'bouncedAt')} > ${d.day}))`;
}

/**
 * `liveAllocationWhere` on alias `a` (a `payment_allocations` row). The
 * caller joins its charge as `c` and its payment (`finance_live_payments`)
 * as `p`: an allocation is live only while both are (review M1).
 */
export function liveAllocationSql(
    d: AsOfSql,
    aliases: { a?: string; c?: string; p?: string } = {}
): Prisma.Sql {
    const { a = 'a', c = 'c', p = 'p' } = aliases;
    return Prisma.sql`(${col(a, 'allocatedAt')} <= ${d.day} AND (${col(a, 'voidedAt')} IS NULL OR ${col(a, 'voidedAt')} >= ${d.end}) AND ${liveChargeSql(d, c)} AND ${livePaymentSql(d, p)})`;
}

/** `liveFundEntryWhere` on alias `f` (a `fund_entries` row). */
export function liveFundEntrySql(d: AsOfSql, f = 'f'): Prisma.Sql {
    return Prisma.sql`(${col(f, 'entryDate')} <= ${d.day} AND (${col(f, 'status')} = 'POSTED' OR ${col(f, 'voidedAt')} >= ${d.end}))`;
}

/*
 * Live spans, for flow figures (N-1, `flow-buckets.ts`). Each predicate above
 * is a conjunction of "D >= a start date" and "D < an end date" terms, so a
 * row is live exactly on [start, end). A span is three SQL expressions:
 * `start` (date), `endDate` (date, or NULL) and `endAt` (timestamp, or NULL:
 * the Cairo day of it is the end). `spanEnd` turns the last two into the end
 * date in JS, through the same `cairoDate` the Prisma twins use, so no time
 * zone is evaluated in SQL. A row with end <= start was never live.
 */
export interface LiveSpanSql {
    start: Prisma.Sql;
    endDate: Prisma.Sql;
    endAt: Prisma.Sql;
}

/** A VOID row with no `voidedAt` was never live: an end before any start. */
const NEVER = Prisma.sql`'1900-01-01 00:00:00'::timestamp`;

function voidEnd(alias: string): Prisma.Sql {
    return Prisma.sql`CASE WHEN ${col(alias, 'status')} = 'POSTED' THEN NULL ELSE COALESCE(${col(alias, 'voidedAt')}, ${NEVER}) END`;
}

function chargeStart(c: string): Prisma.Sql {
    return Prisma.sql`to_date(${col(c, 'accrualPeriod')} || '-01', 'YYYY-MM-DD')`;
}

/** Span of `liveChargeSql`: from the first day of its accrual month. */
export function liveChargeSpanSql(c = 'c'): LiveSpanSql {
    return {
        start: chargeStart(c),
        endDate: Prisma.sql`NULL::date`,
        endAt: voidEnd(c),
    };
}

/** Span of `livePaymentSql`: from `receivedAt`, to its void or bounce. */
export function livePaymentSpanSql(p = 'p'): LiveSpanSql {
    return {
        start: col(p, 'receivedAt'),
        endDate: col(p, 'bouncedAt'),
        endAt: voidEnd(p),
    };
}

/**
 * Span of `liveAllocationSql` (charge `c` and payment `p` joined): from the
 * latest of its own date, its charge's accrual month and its payment's
 * receipt, to the earliest of its own void, its payment's void or bounce and
 * its charge's void. Several invalidations reverse it once, at the first.
 */
export function liveAllocationSpanSql(
    aliases: { a?: string; c?: string; p?: string } = {}
): LiveSpanSql {
    const { a = 'a', c = 'c', p = 'p' } = aliases;
    return {
        start: Prisma.sql`GREATEST(${col(a, 'allocatedAt')}, ${chargeStart(c)}, ${col(p, 'receivedAt')})`,
        endDate: col(p, 'bouncedAt'),
        endAt: Prisma.sql`LEAST(${col(a, 'voidedAt')}, ${voidEnd(p)}, ${voidEnd(c)})`,
    };
}

/** Span of `liveFundEntrySql`: from `entryDate`, to its void. */
export function liveFundEntrySpanSql(f = 'f'): LiveSpanSql {
    return {
        start: col(f, 'entryDate'),
        endDate: Prisma.sql`NULL::date`,
        endAt: voidEnd(f),
    };
}

/** The end date of a span row (`null`: still live). */
export function spanEnd(endDate: Date | null, endAt: Date | null): Date | null {
    const fromAt = endAt ? cairoDate(endAt) : null;
    if (!endDate) return fromAt;
    if (!fromAt) return endDate;
    return fromAt.getTime() < endDate.getTime() ? fromAt : endDate;
}
