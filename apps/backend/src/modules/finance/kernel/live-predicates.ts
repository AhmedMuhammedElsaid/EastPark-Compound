import { PostingStatus, Prisma } from '@prisma/client';

import {
    addDays,
    cairoDayStart,
    periodOf,
} from 'src/common/finance/cairo-date';

/*
 * The shared "live as of D" predicates (plan 2.1.1). `asOf` is a DATE-column
 * value (a Cairo calendar day, UTC midnight). Timestamp columns (`voidedAt`)
 * are compared through the Cairo day: `cairoDate(voidedAt) > D` is
 * `voidedAt >= cairoDayStart(D + 1)`. Nothing else in the codebase may
 * re-spell these: balance, credit, statements and reports all read them.
 * Phase 1 has no refund terms (the Expense table arrives in Phase 2).
 */

/** First instant after Cairo day `asOf` ends. */
export function endOfCairoDay(asOf: Date): Date {
    return cairoDayStart(addDays(asOf, 1));
}

/**
 * Live payment as of D: received by D, not voided by D (Cairo day of
 * `voidedAt`), not bounced by D. A PENDING_CLEARANCE cheque is live.
 * Same columns as the `finance_live_payments` view.
 */
export function livePaymentWhere(asOf: Date): Prisma.PaymentWhereInput {
    return {
        receivedAt: { lte: asOf },
        AND: [
            {
                OR: [
                    { status: PostingStatus.POSTED },
                    { voidedAt: { gte: endOfCairoDay(asOf) } },
                ],
            },
            { OR: [{ bouncedAt: null }, { bouncedAt: { gt: asOf } }] },
        ],
    };
}

/**
 * Live charge as of D: its accrual month has started by D (`accrualPeriod`
 * <= D's month; `YYYY-MM` strings compare in date order) and it was not
 * voided by D. Overdue figures additionally read `dueDate`.
 */
export function liveChargeWhere(asOf: Date): Prisma.ChargeWhereInput {
    return {
        accrualPeriod: { lte: periodOf(asOf) },
        OR: [
            { status: PostingStatus.POSTED },
            { voidedAt: { gte: endOfCairoDay(asOf) } },
        ],
    };
}

/**
 * Live allocation as of D: allocated by D, not voided by D, AND its charge
 * and its payment are both live as of D (review M1). Without the last two an
 * allocation to a charge whose accrual month has not started, or one that
 * outlives a bounced cheque, would count in `credit` but not in the open
 * amount, and `balance = open − credit` would break.
 */
export function liveAllocationWhere(
    asOf: Date
): Prisma.PaymentAllocationWhereInput {
    return {
        allocatedAt: { lte: asOf },
        OR: [{ voidedAt: null }, { voidedAt: { gte: endOfCairoDay(asOf) } }],
        charge: liveChargeWhere(asOf),
        payment: livePaymentWhere(asOf),
    };
}
