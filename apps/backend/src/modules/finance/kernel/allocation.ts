import { BadRequestException, ConflictException } from '@nestjs/common';
import { ChargeKind, PostingStatus, Prisma } from '@prisma/client';

import { FinanceTx } from './finance-tx';
import { lockCharges } from './locks';

const ZERO = new Prisma.Decimal(0);

/** A charge that can receive money, with its CURRENT open amount. */
export interface AllocatableCharge {
    id: string;
    kind: ChargeKind;
    amount: Prisma.Decimal;
    /** amount − Σ allocations not voided (current state, any date). */
    openAmount: Prisma.Decimal;
    dueDate: Date;
    createdAt: Date;
    description: string;
}

export interface AllocationLine {
    chargeId: string;
    kind: ChargeKind;
    amount: Prisma.Decimal;
}

export interface RequestedAllocation {
    chargeId: string;
    amount: Prisma.Decimal;
}

/**
 * Lock-order step 2 (plan 3.4): locks the flat's candidate charges FOR UPDATE
 * and reads their open amounts. Call it AFTER `lockFlat`. `chargeIds` limits
 * the candidates (explicit allocations); otherwise every posted charge of the
 * flat with money still open. The open amount is current-state (allocations
 * not voided), so money committed to a charge whose accrual month has not
 * started is not handed out twice. Returned oldest due first
 * (`dueDate, createdAt, id`).
 */
export async function lockOpenCharges(
    tx: FinanceTx,
    flatId: string,
    chargeIds?: readonly string[]
): Promise<AllocatableCharge[]> {
    const where: Prisma.ChargeWhereInput = {
        flatId,
        status: PostingStatus.POSTED,
        ...(chargeIds ? { id: { in: [...chargeIds] } } : {}),
    };
    const ids = (await tx.charge.findMany({ where, select: { id: true } })).map(
        c => c.id
    );
    await lockCharges(tx, ids);
    if (ids.length === 0) return [];
    const rows = await tx.charge.findMany({
        where: { ...where, id: { in: ids } },
        select: {
            id: true,
            kind: true,
            amount: true,
            dueDate: true,
            createdAt: true,
            description: true,
            allocations: {
                where: { voidedAt: null },
                select: { amount: true },
            },
        },
        orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
    });
    return rows.map(({ allocations, ...c }) => ({
        ...c,
        openAmount: allocations.reduce((s, a) => s.sub(a.amount), c.amount),
    }));
}

/**
 * Auto allocation (plan 3.3): walk the open charges oldest due first and
 * apply `total` until it is used up. `DEPOSIT` settles only
 * MAINTENANCE_DEPOSIT charges; `AUTO` skips them (deposit protection). What
 * is left over stays as credit.
 */
export function planAutoAllocation(
    charges: readonly AllocatableCharge[],
    total: Prisma.Decimal,
    payFor: 'AUTO' | 'DEPOSIT'
): AllocationLine[] {
    const lines: AllocationLine[] = [];
    let left = total;
    for (const charge of charges) {
        if (left.lte(0)) break;
        const isDeposit = charge.kind === ChargeKind.MAINTENANCE_DEPOSIT;
        if (payFor === 'DEPOSIT' ? !isDeposit : isDeposit) continue;
        if (charge.openAmount.lte(0)) continue;
        const amount = Prisma.Decimal.min(left, charge.openAmount);
        lines.push({ chargeId: charge.id, kind: charge.kind, amount });
        left = left.sub(amount);
    }
    return lines;
}

/**
 * Explicit allocation (plan 3.3): every requested charge must be a posted
 * charge of this flat (409 `finance.error.allocationChargeNotOpen`), listed
 * once (400
 * `finance.error.duplicateAllocation`), and receive at most its open amount
 * (409 `finance.error.allocationExceedsCharge`); the sum may not exceed
 * `available` (409 `exceedsError`: `allocationExceedsPayment` for a new
 * payment, `insufficientCredit` for apply-credit). Deposit charges are fine
 * here: ticking them is how a deposit is paid ahead of older arrears.
 */
export function planExplicitAllocation(
    charges: readonly AllocatableCharge[],
    requested: readonly RequestedAllocation[],
    available: Prisma.Decimal,
    exceedsError: string
): AllocationLine[] {
    const byId = new Map(charges.map(c => [c.id, c]));
    const seen = new Set<string>();
    let sum = ZERO;
    const lines: AllocationLine[] = [];
    for (const r of requested) {
        if (seen.has(r.chargeId))
            throw new BadRequestException('finance.error.duplicateAllocation');
        seen.add(r.chargeId);
        const charge = byId.get(r.chargeId);
        if (!charge)
            throw new ConflictException(
                'finance.error.allocationChargeNotOpen'
            );
        if (r.amount.gt(charge.openAmount))
            throw new ConflictException(
                'finance.error.allocationExceedsCharge'
            );
        sum = sum.add(r.amount);
        lines.push({
            chargeId: charge.id,
            kind: charge.kind,
            amount: r.amount,
        });
    }
    if (sum.gt(available)) throw new ConflictException(exceedsError);
    return lines;
}

/** Σ of the lines. */
export function sumLines(lines: readonly { amount: Prisma.Decimal }[]) {
    return lines.reduce((s, l) => s.add(l.amount), ZERO);
}
