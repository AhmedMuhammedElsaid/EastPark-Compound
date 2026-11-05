import { ChargeKind, PostingStatus, Prisma } from '@prisma/client';

import { dateOnlyString } from 'src/common/finance/cairo-date';
import {
    COMPOUND_BUILDINGS,
    GROUND_FLOOR,
} from 'src/common/finance/compound-layout';
import { toMoneyNumber } from 'src/common/helper/money';

import { FinanceChargeDto } from './dtos/response/finance.response.dto';

/** Prisma select for a charge as the API returns it. */
export const CHARGE_SELECT = {
    id: true,
    flatId: true,
    kind: true,
    amount: true,
    description: true,
    descriptionAr: true,
    accrualPeriod: true,
    dueDate: true,
    status: true,
    fundContribution: true,
    billingRunId: true,
    replacesId: true,
    createdAt: true,
    createdById: true,
    voidedAt: true,
    voidReason: true,
    flat: { select: { label: true } },
    createdBy: { select: { id: true, name: true } },
    voidedBy: { select: { id: true, name: true } },
} satisfies Prisma.ChargeSelect;

export type ChargeRow = Prisma.ChargeGetPayload<{
    select: typeof CHARGE_SELECT;
}>;

export function toChargeDto(row: ChargeRow): FinanceChargeDto {
    return {
        id: row.id,
        flatId: row.flatId,
        flatLabel: row.flat.label,
        kind: row.kind as ChargeKind,
        amount: toMoneyNumber(row.amount),
        description: row.description,
        descriptionAr: row.descriptionAr,
        accrualPeriod: row.accrualPeriod,
        dueDate: dateOnlyString(row.dueDate),
        status: row.status as PostingStatus,
        fundContribution: row.fundContribution,
        billingRunId: row.billingRunId,
        replacesId: row.replacesId,
        createdBy: row.createdBy,
        createdAt: row.createdAt,
        voidedAt: row.voidedAt,
        voidReason: row.voidReason,
        voidedBy: row.voidedBy,
    };
}

const BUILDING_ORDER = new Map(
    COMPOUND_BUILDINGS.map((b, index) => [b.code, index] as const)
);

const floorRank = (floor: string): number =>
    floor === GROUND_FLOOR ? 0 : Number(floor) || 99;

/** Layout order: building (phase order), then floor (G first), then flat number. */
export function compareFlats(
    a: { building: string; floor: string; flatNumber: string; id: string },
    b: { building: string; floor: string; flatNumber: string; id: string }
): number {
    const ba = BUILDING_ORDER.get(a.building) ?? 99;
    const bb = BUILDING_ORDER.get(b.building) ?? 99;
    if (ba !== bb) return ba - bb;
    if (a.building !== b.building) return a.building < b.building ? -1 : 1;
    const fa = floorRank(a.floor);
    const fb = floorRank(b.floor);
    if (fa !== fb) return fa - fb;
    const na = Number(a.flatNumber) || 99;
    const nb = Number(b.flatNumber) || 99;
    if (na !== nb) return na - nb;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}
