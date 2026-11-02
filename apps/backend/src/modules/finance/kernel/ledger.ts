import { Prisma } from '@prisma/client';

import { daysBetween } from 'src/common/finance/cairo-date';

import { FinanceReader } from './finance-tx';
import {
    liveAllocationWhere,
    liveChargeWhere,
    livePaymentWhere,
} from './live-predicates';

const ZERO = new Prisma.Decimal(0);

export interface OpenCharge {
    id: string;
    amount: Prisma.Decimal;
    openAmount: Prisma.Decimal;
    dueDate: Date;
}

/**
 * A flat's figures as of D (plan 2.1.1), all from the shared predicates:
 * - `balance` = live charges − live payments (negative: the flat is in credit);
 * - `credit` = live payments − live allocations (an allocation is live only
 *   while its charge and its payment are live, so credit never goes negative);
 * - `availableCredit` = credit − pending refunds (Phase 1: no refunds, = credit);
 * - `openAmount` = Σ (charge − its live allocations) over live charges;
 * - `overdueAmount` / `oldestDueDays` over open charges due before D.
 * Invariant (tested): `balance = openAmount − credit`.
 */
export interface FlatFinanceSummary {
    flatId: string;
    balance: Prisma.Decimal;
    credit: Prisma.Decimal;
    availableCredit: Prisma.Decimal;
    openAmount: Prisma.Decimal;
    overdueAmount: Prisma.Decimal;
    oldestDueDays: number | null;
    openCharges: OpenCharge[];
}

function emptySummary(flatId: string): FlatFinanceSummary {
    return {
        flatId,
        balance: ZERO,
        credit: ZERO,
        availableCredit: ZERO,
        openAmount: ZERO,
        overdueAmount: ZERO,
        oldestDueDays: null,
        openCharges: [],
    };
}

const add = (
    map: Map<string, Prisma.Decimal>,
    key: string,
    value: Prisma.Decimal
): void => {
    map.set(key, (map.get(key) ?? ZERO).add(value));
};

/**
 * Figures for many flats in three indexed reads (charges, allocations,
 * payment sums). About 690 flats, so a full-desk pass stays cheap. Pass the
 * transaction client to read inside a posting (after the flat lock).
 */
export async function summariseFlats(
    client: FinanceReader,
    flatIds: readonly string[],
    asOf: Date
): Promise<Map<string, FlatFinanceSummary>> {
    const out = new Map<string, FlatFinanceSummary>();
    for (const id of flatIds) out.set(id, emptySummary(id));
    if (flatIds.length === 0) return out;
    const ids = [...flatIds];

    const [charges, allocations, payments] = await Promise.all([
        client.charge.findMany({
            where: { flatId: { in: ids }, ...liveChargeWhere(asOf) },
            select: { id: true, flatId: true, amount: true, dueDate: true },
            orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
        }),
        client.paymentAllocation.findMany({
            where: {
                AND: [
                    liveAllocationWhere(asOf),
                    { payment: { flatId: { in: ids } } },
                ],
            },
            select: {
                amount: true,
                chargeId: true,
                payment: { select: { flatId: true } },
            },
        }),
        client.payment.groupBy({
            by: ['flatId'],
            where: { flatId: { in: ids }, ...livePaymentWhere(asOf) },
            _sum: { amount: true },
        }),
    ]);

    const allocatedByCharge = new Map<string, Prisma.Decimal>();
    const allocatedByFlat = new Map<string, Prisma.Decimal>();
    for (const a of allocations) {
        add(allocatedByCharge, a.chargeId, a.amount);
        add(allocatedByFlat, a.payment.flatId, a.amount);
    }
    const paidByFlat = new Map<string, Prisma.Decimal>();
    for (const p of payments) add(paidByFlat, p.flatId, p._sum.amount ?? ZERO);

    const chargedByFlat = new Map<string, Prisma.Decimal>();
    for (const c of charges) {
        const summary = out.get(c.flatId);
        if (!summary) continue;
        add(chargedByFlat, c.flatId, c.amount);
        const open = c.amount.sub(allocatedByCharge.get(c.id) ?? ZERO);
        summary.openAmount = summary.openAmount.add(open);
        if (open.gt(0)) {
            summary.openCharges.push({
                id: c.id,
                amount: c.amount,
                openAmount: open,
                dueDate: c.dueDate,
            });
            if (c.dueDate.getTime() < asOf.getTime()) {
                summary.overdueAmount = summary.overdueAmount.add(open);
                const days = daysBetween(c.dueDate, asOf);
                if (
                    summary.oldestDueDays === null ||
                    days > summary.oldestDueDays
                )
                    summary.oldestDueDays = days;
            }
        }
    }

    for (const summary of out.values()) {
        const charged = chargedByFlat.get(summary.flatId) ?? ZERO;
        const paid = paidByFlat.get(summary.flatId) ?? ZERO;
        const allocated = allocatedByFlat.get(summary.flatId) ?? ZERO;
        summary.balance = charged.sub(paid);
        summary.credit = paid.sub(allocated);
        summary.availableCredit = summary.credit;
    }
    return out;
}

/** One flat's figures (see `summariseFlats`). */
export async function summariseFlat(
    client: FinanceReader,
    flatId: string,
    asOf: Date
): Promise<FlatFinanceSummary> {
    const map = await summariseFlats(client, [flatId], asOf);
    return map.get(flatId) ?? emptySummary(flatId);
}
