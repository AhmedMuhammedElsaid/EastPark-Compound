import {
    ChargeKind,
    ChequeState,
    EntryDirection,
    FinancePaymentMethod,
    FundEntryKind,
    PostingStatus,
    PrismaClient,
} from '@prisma/client';

import { cairoDayStart, parseDateOnly } from 'src/common/finance/cairo-date';

/**
 * Hand-seeded ledger rows for the dashboard db-specs (slice 9). Rows are
 * written straight through Prisma, so a spec controls every date (past
 * months, voids at chosen instants) without going through the posting rules.
 */
export const day = (s: string): Date => parseDateOnly(s);

let seq = 0;
const next = (prefix: string): string => `${prefix}_${++seq}`;

export function ledger(db: PrismaClient, actorId: string) {
    return {
        charge: (o: {
            id?: string;
            flatId: string;
            amount: string;
            period: string;
            due: string;
            kind?: ChargeKind;
            voidedAt?: Date;
        }) =>
            db.charge.create({
                data: {
                    id: o.id ?? next('ch'),
                    flatId: o.flatId,
                    kind: o.kind ?? ChargeKind.SERVICE_CHARGE,
                    amount: o.amount,
                    description: 'x',
                    descriptionAr: 'x',
                    accrualPeriod: o.period,
                    dueDate: day(o.due),
                    fundContribution: o.kind === ChargeKind.MAINTENANCE_DEPOSIT,
                    status: o.voidedAt
                        ? PostingStatus.VOID
                        : PostingStatus.POSTED,
                    voidedAt: o.voidedAt ?? null,
                    createdById: actorId,
                },
            }),

        payment: (o: {
            id?: string;
            flatId: string;
            amount: string;
            received: string;
            method?: FinancePaymentMethod;
            isOpening?: boolean;
            voidedAt?: Date;
            bounced?: string;
            cleared?: string;
        }) => {
            const id = o.id ?? next('pay');
            const method = o.method ?? FinancePaymentMethod.CASH;
            const cheque = method === FinancePaymentMethod.CHEQUE;
            return db.payment.create({
                data: {
                    id,
                    receiptNo: `T-${id}`,
                    amount: o.amount,
                    method,
                    requestKey: `rk-${id}`,
                    requestHash: 'h',
                    receivedAt: day(o.received),
                    isOpening: o.isOpening ?? false,
                    chequeState: !cheque
                        ? ChequeState.NOT_APPLICABLE
                        : o.bounced
                          ? ChequeState.BOUNCED
                          : o.cleared
                            ? ChequeState.CLEARED
                            : ChequeState.PENDING_CLEARANCE,
                    bouncedAt: o.bounced ? day(o.bounced) : null,
                    clearedAt: o.cleared ? day(o.cleared) : null,
                    status: o.voidedAt
                        ? PostingStatus.VOID
                        : PostingStatus.POSTED,
                    voidedAt: o.voidedAt ?? null,
                    flatId: o.flatId,
                    createdById: actorId,
                },
            });
        },

        allocation: (o: {
            id?: string;
            paymentId: string;
            chargeId: string;
            amount: string;
            at: string;
            voidedAt?: Date;
        }) =>
            db.paymentAllocation.create({
                data: {
                    id: o.id ?? next('al'),
                    paymentId: o.paymentId,
                    chargeId: o.chargeId,
                    amount: o.amount,
                    allocatedAt: day(o.at),
                    voidedAt: o.voidedAt ?? null,
                    createdById: actorId,
                },
            }),

        fund: (o: {
            id?: string;
            amount: string;
            date: string;
            kind?: FundEntryKind;
            direction?: EntryDirection;
            counts?: boolean;
            voidedAt?: Date;
            paymentId?: string;
        }) => {
            const id = o.id ?? next('fe');
            return db.fundEntry.create({
                data: {
                    id,
                    entryNo: `F-${id}`,
                    requestKey: `rk-${id}`,
                    requestHash: 'h',
                    kind: o.kind ?? FundEntryKind.DEPOSIT_IN,
                    direction: o.direction ?? EntryDirection.IN,
                    countsInFundTotal: o.counts ?? true,
                    amount: o.amount,
                    entryDate: day(o.date),
                    description: 'x',
                    status: o.voidedAt
                        ? PostingStatus.VOID
                        : PostingStatus.POSTED,
                    voidedAt: o.voidedAt ?? null,
                    paymentId: o.paymentId ?? null,
                    createdById: actorId,
                },
            });
        },

        /** A bounce as the service writes it: payment `bouncedAt`, its live allocations and fund entries voided at the start of that Cairo day. */
        bounce: async (paymentId: string, date: string) => {
            const at = cairoDayStart(day(date));
            await db.payment.update({
                where: { id: paymentId },
                data: {
                    chequeState: ChequeState.BOUNCED,
                    bouncedAt: day(date),
                },
            });
            await db.paymentAllocation.updateMany({
                where: { paymentId, voidedAt: null },
                data: { voidedAt: at },
            });
            await db.fundEntry.updateMany({
                where: { paymentId, status: PostingStatus.POSTED },
                data: { status: PostingStatus.VOID, voidedAt: at },
            });
        },
    };
}
