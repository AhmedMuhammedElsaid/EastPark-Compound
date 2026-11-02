import { Prisma } from '@prisma/client';

import { fiscalYearOf } from 'src/common/finance/cairo-date';

import { FinanceTx } from './finance-tx';
import { readFiscalYearStartMonth } from './finance-settings';

/**
 * Receipt scopes (plan 3.4), fixed letters: R payments, O opening-balance
 * payments, E expenses, V revenues, F fund entries.
 */
export const RECEIPT_SCOPES = ['R', 'O', 'E', 'V', 'F'] as const;
export type ReceiptScope = (typeof RECEIPT_SCOPES)[number];

/** `R-2026-000123`. */
export function formatReceiptNo(
    scope: ReceiptScope,
    yearLabel: string,
    n: number
): string {
    return `${scope}-${yearLabel}-${String(n).padStart(6, '0')}`;
}

/**
 * Lock-order step 3: reserves `count` consecutive numbers of one scope and
 * fiscal year with ONE upsert-increment. The counter row stays locked until
 * the caller's transaction ends and rolls back with it, so numbers have no
 * gaps (a Postgres SEQUENCE would not roll back). Returns `last - count + 1 … last`.
 */
async function reserveRange(
    tx: FinanceTx,
    scope: ReceiptScope,
    year: number,
    count: number
): Promise<number> {
    const rows = await tx.$queryRaw<{ last: number }[]>(
        Prisma.sql`INSERT INTO "receipt_counters" ("scope", "year", "last") VALUES (${scope}, ${year}::int, ${count}::int) ON CONFLICT ("scope", "year") DO UPDATE SET "last" = "receipt_counters"."last" + ${count}::int RETURNING "last"`
    );
    const last = Number(rows[0]?.last);
    if (!Number.isInteger(last) || last < count)
        throw new Error('receipt counter reservation failed');
    return last - count + 1;
}

/**
 * Numbers for postings dated `accountingDates` (DATE-column values: the
 * year is the Cairo accounting date's fiscal year, never the click time).
 * One reservation per fiscal year, in ascending year order; the result is
 * aligned with the input. Call it LAST, right before the inserts (plan 3.4).
 */
export async function reserveReceiptNumbers(
    tx: FinanceTx,
    scope: ReceiptScope,
    accountingDates: readonly Date[]
): Promise<string[]> {
    if (accountingDates.length === 0) return [];
    const startMonth = await readFiscalYearStartMonth(tx);
    const fiscal = accountingDates.map(d => fiscalYearOf(d, startMonth));
    const byYear = new Map<number, { label: string; indexes: number[] }>();
    fiscal.forEach((f, i) => {
        const group = byYear.get(f.year) ?? { label: f.label, indexes: [] };
        group.indexes.push(i);
        byYear.set(f.year, group);
    });
    const out = new Array<string>(accountingDates.length);
    const groups = [...byYear.entries()].sort(([a], [b]) => a - b);
    for (const [year, group] of groups) {
        const first = await reserveRange(tx, scope, year, group.indexes.length);
        group.indexes.forEach((index, offset) => {
            out[index] = formatReceiptNo(scope, group.label, first + offset);
        });
    }
    return out;
}

/** One number (single posting). */
export async function nextReceiptNumber(
    tx: FinanceTx,
    scope: ReceiptScope,
    accountingDate: Date
): Promise<string> {
    const [receiptNo] = await reserveReceiptNumbers(tx, scope, [
        accountingDate,
    ]);
    if (!receiptNo) throw new Error('receipt counter reservation failed');
    return receiptNo;
}
