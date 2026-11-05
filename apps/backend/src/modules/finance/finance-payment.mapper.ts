import {
    ChargeKind,
    ChequeState,
    FinancePaymentMethod,
    PostingStatus,
    Prisma,
} from '@prisma/client';

import { dateOnlyString } from 'src/common/finance/cairo-date';
import { toMoneyNumber } from 'src/common/helper/money';

import {
    FinanceAllocationDto,
    FinancePaymentDetailDto,
    FinancePaymentDto,
} from './dtos/response/finance.response.dto';

const ZERO = new Prisma.Decimal(0);

/** Prisma select for an allocation as the API returns it. */
export const ALLOCATION_SELECT = {
    id: true,
    paymentId: true,
    chargeId: true,
    amount: true,
    allocatedAt: true,
    voidedAt: true,
    voidReason: true,
    payment: { select: { receiptNo: true } },
    charge: {
        select: {
            kind: true,
            description: true,
            descriptionAr: true,
            accrualPeriod: true,
            dueDate: true,
        },
    },
} satisfies Prisma.PaymentAllocationSelect;

export type AllocationRow = Prisma.PaymentAllocationGetPayload<{
    select: typeof ALLOCATION_SELECT;
}>;

/**
 * Prisma select for a payment. `attachmentPath` is read only to derive
 * `hasAttachment`; the path itself is never returned.
 */
export const PAYMENT_SELECT = {
    id: true,
    receiptNo: true,
    flatId: true,
    amount: true,
    method: true,
    reference: true,
    chequeState: true,
    clearedAt: true,
    bouncedAt: true,
    receivedAt: true,
    payerName: true,
    note: true,
    status: true,
    isOpening: true,
    attachmentPath: true,
    replacesId: true,
    requestHash: true,
    createdAt: true,
    createdById: true,
    voidedAt: true,
    voidReason: true,
    flat: { select: { label: true } },
    createdBy: { select: { id: true, name: true } },
    voidedBy: { select: { id: true, name: true } },
    allocations: {
        select: ALLOCATION_SELECT,
        orderBy: [{ allocatedAt: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
    },
} satisfies Prisma.PaymentSelect;

export type PaymentRow = Prisma.PaymentGetPayload<{
    select: typeof PAYMENT_SELECT;
}>;

export function toAllocationDto(row: AllocationRow): FinanceAllocationDto {
    return {
        id: row.id,
        paymentId: row.paymentId,
        receiptNo: row.payment.receiptNo,
        chargeId: row.chargeId,
        chargeKind: row.charge.kind as ChargeKind,
        chargeDescription: row.charge.description,
        chargeDescriptionAr: row.charge.descriptionAr,
        accrualPeriod: row.charge.accrualPeriod,
        dueDate: dateOnlyString(row.charge.dueDate),
        amount: toMoneyNumber(row.amount),
        allocatedAt: dateOnlyString(row.allocatedAt),
        voidedAt: row.voidedAt,
        voidReason: row.voidReason,
    };
}

export function toPaymentDto(row: PaymentRow): FinancePaymentDto {
    const allocated = row.allocations
        .filter(a => a.voidedAt === null)
        .reduce((sum, a) => sum.add(a.amount), ZERO);
    return {
        id: row.id,
        receiptNo: row.receiptNo,
        flatId: row.flatId,
        flatLabel: row.flat.label,
        amount: toMoneyNumber(row.amount),
        method: row.method as FinancePaymentMethod,
        reference: row.reference,
        chequeState: row.chequeState as ChequeState,
        clearedAt: row.clearedAt ? dateOnlyString(row.clearedAt) : null,
        bouncedAt: row.bouncedAt ? dateOnlyString(row.bouncedAt) : null,
        receivedAt: dateOnlyString(row.receivedAt),
        payerName: row.payerName,
        note: row.note,
        status: row.status as PostingStatus,
        isOpening: row.isOpening,
        hasAttachment: row.attachmentPath !== null,
        replacesId: row.replacesId,
        allocatedAmount: toMoneyNumber(allocated),
        unallocatedAmount: toMoneyNumber(row.amount.sub(allocated)),
        createdBy: row.createdBy,
        createdAt: row.createdAt,
        voidedAt: row.voidedAt,
        voidReason: row.voidReason,
        voidedBy: row.voidedBy,
    };
}

export function toPaymentDetailDto(row: PaymentRow): FinancePaymentDetailDto {
    return {
        ...toPaymentDto(row),
        allocations: row.allocations.map(toAllocationDto),
    };
}
