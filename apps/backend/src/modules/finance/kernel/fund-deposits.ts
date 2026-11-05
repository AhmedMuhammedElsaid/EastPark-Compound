import { createHash } from 'node:crypto';

import {
    ChargeKind,
    EntryDirection,
    FundEntryKind,
    Prisma,
} from '@prisma/client';

import { FinanceTx } from './finance-tx';
import { reserveReceiptNumbers } from './receipt-counter';

export interface NewAllocation {
    paymentId: string;
    receiptNo: string;
    chargeId: string;
    kind: ChargeKind;
    amount: Prisma.Decimal;
}

/**
 * Lock-order step 3 (counter last): one `F-` number per allocation line to a
 * MAINTENANCE_DEPOSIT charge, reserved in one statement BEFORE any insert.
 */
export function reserveFundNumbers(
    tx: FinanceTx,
    lines: readonly { kind: ChargeKind }[],
    entryDate: Date
): Promise<string[]> {
    const deposits = lines.filter(
        l => l.kind === ChargeKind.MAINTENANCE_DEPOSIT
    );
    return reserveReceiptNumbers(
        tx,
        'F',
        deposits.map(() => entryDate)
    );
}

/**
 * Step 4: inserts allocations dated `allocatedAt`, plus one automatic
 * `DEPOSIT_IN` fund entry per allocation to a MAINTENANCE_DEPOSIT charge
 * (plan 2.4 "How the fund is fed"), numbered from `fundNumbers`
 * (`reserveFundNumbers`) and keyed `<paymentId>:<allocationId>` so a replay
 * cannot create it twice. Returns the new allocation ids in input order.
 */
export async function insertAllocations(
    tx: FinanceTx,
    lines: readonly NewAllocation[],
    allocatedAt: Date,
    fundNumbers: readonly string[],
    flatLabel: string,
    actorId: string
): Promise<string[]> {
    let fundIndex = 0;
    const ids: string[] = [];
    for (const line of lines) {
        const allocation = await tx.paymentAllocation.create({
            data: {
                paymentId: line.paymentId,
                chargeId: line.chargeId,
                amount: line.amount,
                allocatedAt,
                createdById: actorId,
            },
            select: { id: true },
        });
        ids.push(allocation.id);
        if (line.kind !== ChargeKind.MAINTENANCE_DEPOSIT) continue;
        const entryNo = fundNumbers[fundIndex++];
        if (!entryNo) throw new Error('fund number not reserved');
        const requestKey = `${line.paymentId}:${allocation.id}`;
        await tx.fundEntry.create({
            data: {
                entryNo,
                requestKey,
                requestHash: createHash('sha256')
                    .update(requestKey)
                    .digest('hex'),
                kind: FundEntryKind.DEPOSIT_IN,
                direction: EntryDirection.IN,
                amount: line.amount,
                entryDate: allocatedAt,
                description: `Maintenance deposit, ${flatLabel}, ${line.receiptNo}`,
                paymentId: line.paymentId,
                createdById: actorId,
            },
            select: { id: true },
        });
    }
    return ids;
}
