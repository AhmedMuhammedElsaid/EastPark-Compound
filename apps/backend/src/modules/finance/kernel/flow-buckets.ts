import { Prisma } from '@prisma/client';

import {
    addDays,
    dateOnlyString,
    parseDateOnly,
    periodOf,
    shiftPeriod,
} from 'src/common/finance/cairo-date';

const ZERO = new Prisma.Decimal(0);

/**
 * One row of a flow figure (plan 6.1 "Reversals in flow reports", N-1): it is
 * live on [start, end) (the span of its live predicate, `live-predicates.sql.ts`),
 * `end` null while still live. Rows may be pre-aggregated (same span, summed).
 */
export interface FlowRow {
    amount: Prisma.Decimal;
    start: Date;
    end: Date | null;
}

/** A bucket of DATE-column values, both ends inclusive. */
export interface FlowBucket {
    from: Date;
    to: Date;
}

export interface FlowTotals {
    /** Σ amount of rows that became live in the bucket (originals). */
    gross: Prisma.Decimal;
    /** −Σ amount of rows that stopped being live in the bucket (≤ 0). */
    reversed: Prisma.Decimal;
    /** gross + reversed. */
    net: Prisma.Decimal;
}

/**
 * The plan's `flowBuckets` (6.1, N-1): +amount in the bucket of `start`,
 * −amount in the bucket of `end` (its earliest invalidation). Events outside
 * every bucket are ignored: an original before the first bucket shows only
 * its reversal, anything after the last bucket's `to` counts nowhere. A row
 * that was never live (end <= start) counts nowhere. Equivalent to
 * `S(to) − S(to of the previous bucket)`, where `S(d)` is Σ amount of rows
 * live as of d, for contiguous buckets (a db-spec asserts it).
 */
export function flowBuckets(
    rows: Iterable<FlowRow>,
    buckets: readonly FlowBucket[]
): FlowTotals[] {
    const totals = buckets.map(() => ({ gross: ZERO, reversed: ZERO }));
    const bucketOf = (date: Date) =>
        totals.find((_, i) => {
            const b = buckets[i];
            return (
                b !== undefined &&
                b.from.getTime() <= date.getTime() &&
                date.getTime() <= b.to.getTime()
            );
        });
    for (const row of rows) {
        if (row.end && row.end.getTime() <= row.start.getTime()) continue;
        const original = bucketOf(row.start);
        if (original) original.gross = original.gross.add(row.amount);
        if (row.end) {
            const reversal = bucketOf(row.end);
            if (reversal) reversal.reversed = reversal.reversed.sub(row.amount);
        }
    }
    return totals.map(t => ({ ...t, net: t.gross.add(t.reversed) }));
}

/** First day of a `YYYY-MM` period (DATE-column value). */
export function periodStart(period: string): Date {
    return parseDateOnly(`${period}-01`);
}

/** Last day of a `YYYY-MM` period (DATE-column value). */
export function periodEnd(period: string): Date {
    return addDays(periodStart(shiftPeriod(period, 1)), -1);
}

export interface MonthBucket extends FlowBucket {
    period: string;
}

/**
 * The `months` calendar months ending at D's month, oldest first. Each
 * bucket ends on its month's last day, except the last, which ends at D.
 */
export function monthBuckets(asOf: Date, months: number): MonthBucket[] {
    const last = periodOf(asOf);
    const out: MonthBucket[] = [];
    for (let i = months - 1; i >= 0; i -= 1) {
        const period = shiftPeriod(last, -i);
        out.push({
            period,
            from: periodStart(period),
            to: i === 0 ? asOf : periodEnd(period),
        });
    }
    return out;
}

/** D minus one calendar month, clamped to that month's last day (31 Mar → 28/29 Feb). */
export function sameDayLastMonth(asOf: Date): Date {
    const period = shiftPeriod(periodOf(asOf), -1);
    const end = periodEnd(period);
    const day = Number(dateOnlyString(asOf).slice(8, 10));
    return parseDateOnly(
        `${period}-${String(Math.min(day, end.getUTCDate())).padStart(2, '0')}`
    );
}
