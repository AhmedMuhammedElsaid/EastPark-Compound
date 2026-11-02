import {
    BadRequestException,
    ConflictException,
    NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { isPeriod } from 'src/common/finance/cairo-date';

import { FinanceTx } from './finance-tx';

/*
 * Posting locks, always taken in this order (plan 3.4, deadlock rule):
 *   (0) fiscal period row(s) FOR SHARE, ascending period order  -> lockPeriods
 *   (1) the flat row FOR UPDATE (two flats: ascending id order)  -> lockFlat
 *   (2) the charges FOR UPDATE, ascending id order               -> lockCharges
 *   (3) the receipt counter, last                                -> receipt-counter.ts
 *   (4) insert / update, then the finance audit row (same transaction)
 * Period close takes its period row FOR UPDATE and nothing else, so it cannot
 * deadlock with a posting.
 */

/**
 * Step 0 (plan 3.2): upsert each period row as OPEN (a posting never relies on
 * a missing row), then lock it `FOR SHARE` and refuse a CLOSED period with
 * 409 `finance.error.periodClosed`. `FOR SHARE` lets postings run in parallel
 * but blocks a close (`FOR UPDATE`) until they commit; a posting that starts
 * after a close waits for it and then sees CLOSED.
 */
export async function lockPeriods(
    tx: FinanceTx,
    periods: readonly string[]
): Promise<void> {
    const ordered = [...new Set(periods)].sort();
    for (const period of ordered) {
        if (!isPeriod(period))
            throw new BadRequestException('finance.error.invalidPeriod');
        await tx.$executeRaw(
            Prisma.sql`INSERT INTO "fiscal_periods" ("period", "status") VALUES (${period}, 'OPEN') ON CONFLICT ("period") DO NOTHING`
        );
        const rows = await tx.$queryRaw<{ status: string }[]>(
            Prisma.sql`SELECT "status"::text AS "status" FROM "fiscal_periods" WHERE "period" = ${period} FOR SHARE`
        );
        if (rows[0]?.status !== 'OPEN')
            throw new ConflictException('finance.error.periodClosed');
    }
}

export interface LockedFlat {
    id: string;
    label: string;
    isActive: boolean;
}

/** Step 1: the flat row `FOR UPDATE`; 404 `finance.error.flatNotFound`. */
export async function lockFlat(
    tx: FinanceTx,
    flatId: string
): Promise<LockedFlat> {
    const rows = await tx.$queryRaw<LockedFlat[]>(
        Prisma.sql`SELECT "id", "label", "isActive" FROM "flats" WHERE "id" = ${flatId} FOR UPDATE`
    );
    const flat = rows[0];
    if (!flat) throw new NotFoundException('finance.error.flatNotFound');
    return flat;
}

/** Step 2: charge rows `FOR UPDATE` in ascending id order; returns the ids found. */
export async function lockCharges(
    tx: FinanceTx,
    chargeIds: readonly string[]
): Promise<string[]> {
    const ordered = [...new Set(chargeIds)].sort();
    if (ordered.length === 0) return [];
    const rows = await tx.$queryRaw<{ id: string }[]>(
        Prisma.sql`SELECT "id" FROM "charges" WHERE "id" IN (${Prisma.join(ordered)}) ORDER BY "id" FOR UPDATE`
    );
    return rows.map(r => r.id);
}
