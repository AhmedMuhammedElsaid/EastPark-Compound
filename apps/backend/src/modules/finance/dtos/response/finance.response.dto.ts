import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
    ChargeKind,
    OwnershipClosedReason,
    PeriodStatus,
    PostingStatus,
    Role,
} from '@prisma/client';

/*
 * Accountant-facing shapes (plan 9 "ACCOUNTANT scope"): owner name and phone
 * for collection, never email, national id, passport or password data.
 * Money is a JSON number (2 dp), dates are `YYYY-MM-DD`.
 */

export class FinancePersonDto {
    @ApiProperty()
    id: string;

    @ApiProperty()
    name: string;
}

export class FinanceFlatTotalsDto {
    @ApiProperty({ example: 900, description: 'Owed (negative: in credit)' })
    balance: number;

    @ApiProperty({ example: 0 })
    credit: number;

    @ApiProperty({ example: 0, description: 'credit minus pending refunds' })
    availableCredit: number;

    @ApiProperty({ example: 900 })
    overdueAmount: number;

    @ApiProperty({ nullable: true, type: Number, example: 23 })
    oldestDueDays: number | null;
}

export class FinanceFlatListItemDto extends FinanceFlatTotalsDto {
    @ApiProperty()
    id: string;

    @ApiProperty({ example: 'A1-3-2' })
    label: string;

    @ApiProperty({ example: 'A1' })
    building: string;

    @ApiProperty({ example: '3' })
    floor: string;

    @ApiProperty({ example: '2' })
    flatNumber: string;

    @ApiProperty({ example: 'phase-1' })
    phase: string;

    @ApiProperty()
    isActive: boolean;

    @ApiProperty({ nullable: true, type: String })
    ownerName: string | null;

    @ApiProperty({ description: 'The flat has a current owner account' })
    hasAccount: boolean;
}

export class FinanceFlatPageDto {
    @ApiProperty({ example: '2026-11-02' })
    asOf: string;

    @ApiProperty({ type: [FinanceFlatListItemDto] })
    items: FinanceFlatListItemDto[];

    @ApiPropertyOptional()
    nextCursor?: string;
}

export class FinanceOwnerContactDto {
    @ApiProperty()
    userId: string;

    @ApiProperty()
    name: string;

    @ApiProperty({ nullable: true, type: String })
    phone: string | null;

    @ApiProperty({ example: '2026-01-01' })
    since: string;
}

export class FinanceOpenChargeDto {
    @ApiProperty()
    id: string;

    @ApiProperty({ enum: ChargeKind })
    kind: ChargeKind;

    @ApiProperty()
    description: string;

    @ApiProperty()
    descriptionAr: string;

    @ApiProperty({ example: '2026-11' })
    accrualPeriod: string;

    @ApiProperty({ example: '2026-11-10' })
    dueDate: string;

    @ApiProperty()
    amount: number;

    @ApiProperty()
    openAmount: number;
}

export class FinanceFlatDetailDto extends FinanceFlatTotalsDto {
    @ApiProperty()
    id: string;

    @ApiProperty({ example: 'A1-3-2' })
    label: string;

    @ApiProperty()
    building: string;

    @ApiProperty()
    floor: string;

    @ApiProperty()
    flatNumber: string;

    @ApiProperty()
    phase: string;

    @ApiProperty()
    isActive: boolean;

    @ApiProperty({ example: '2026-11-02' })
    asOf: string;

    @ApiProperty()
    openAmount: number;

    @ApiProperty({ nullable: true, type: FinanceOwnerContactDto })
    owner: FinanceOwnerContactDto | null;

    @ApiProperty({
        type: [FinanceOpenChargeDto],
        description: 'Oldest due first',
    })
    openCharges: FinanceOpenChargeDto[];
}

export class FinanceOwnershipItemDto {
    @ApiProperty()
    id: string;

    @ApiProperty({
        nullable: true,
        type: String,
        description:
            'null once the account is deleted (shown as "former owner")',
    })
    ownerName: string | null;

    @ApiProperty()
    ownerDeleted: boolean;

    @ApiProperty({ example: '1900-01-01' })
    fromDate: string;

    @ApiProperty({
        description: 'Owned since before finance go-live (1900-01-01 sentinel)',
    })
    beforeGoLive: boolean;

    @ApiProperty({ nullable: true, type: String })
    toDate: string | null;

    @ApiProperty({ nullable: true, enum: OwnershipClosedReason })
    closedReason: OwnershipClosedReason | null;
}

export class FinanceOwnershipListDto {
    @ApiProperty({ type: [FinanceOwnershipItemDto] })
    items: FinanceOwnershipItemDto[];
}

export class FinanceChargeDto {
    @ApiProperty()
    id: string;

    @ApiProperty()
    flatId: string;

    @ApiProperty({ example: 'A1-3-2' })
    flatLabel: string;

    @ApiProperty({ enum: ChargeKind })
    kind: ChargeKind;

    @ApiProperty({ example: 450 })
    amount: number;

    @ApiProperty()
    description: string;

    @ApiProperty()
    descriptionAr: string;

    @ApiProperty({ example: '2026-11' })
    accrualPeriod: string;

    @ApiProperty({ example: '2026-11-10' })
    dueDate: string;

    @ApiProperty({ enum: PostingStatus })
    status: PostingStatus;

    @ApiProperty()
    fundContribution: boolean;

    @ApiProperty({ nullable: true, type: String })
    billingRunId: string | null;

    @ApiProperty({ nullable: true, type: String })
    replacesId: string | null;

    @ApiProperty({ type: FinancePersonDto })
    createdBy: FinancePersonDto;

    @ApiProperty()
    createdAt: Date;

    @ApiProperty({ nullable: true, type: Date })
    voidedAt: Date | null;

    @ApiProperty({ nullable: true, type: String })
    voidReason: string | null;

    @ApiProperty({ nullable: true, type: FinancePersonDto })
    voidedBy: FinancePersonDto | null;
}

export class FinanceAuditActorDto extends FinancePersonDto {
    @ApiProperty({ enum: Role })
    role: Role;
}

export class FinanceAuditItemDto {
    @ApiProperty()
    id: string;

    @ApiProperty({ example: 'CHARGE_CREATED' })
    action: string;

    @ApiProperty({ example: 'Charge' })
    entity: string;

    @ApiProperty({ nullable: true, type: String })
    entityId: string | null;

    @ApiProperty({ nullable: true, type: Object })
    meta: Record<string, unknown> | null;

    @ApiProperty()
    createdAt: Date;

    @ApiProperty({ type: FinanceAuditActorDto })
    actor: FinanceAuditActorDto;
}

export class FinanceAuditPageDto {
    @ApiProperty({ type: [FinanceAuditItemDto] })
    items: FinanceAuditItemDto[];

    @ApiPropertyOptional()
    nextCursor?: string;
}

export class FinancePeriodDto {
    @ApiProperty({ example: '2026-11' })
    period: string;

    @ApiProperty({
        enum: PeriodStatus,
        description: 'A month with no row is OPEN',
    })
    status: PeriodStatus;

    @ApiProperty({ nullable: true, type: Date })
    closedAt: Date | null;

    @ApiProperty({ nullable: true, type: FinancePersonDto })
    closedBy: FinancePersonDto | null;

    @ApiProperty({ nullable: true, type: Date })
    reopenedAt: Date | null;

    @ApiProperty({ nullable: true, type: FinancePersonDto })
    reopenedBy: FinancePersonDto | null;

    @ApiProperty({ nullable: true, type: String })
    reopenReason: string | null;
}

export class FinancePeriodListDto {
    @ApiProperty({
        type: [FinancePeriodDto],
        description: 'Newest month first',
    })
    items: FinancePeriodDto[];
}

export class FinanceSettingDto {
    @ApiProperty({ example: 'expense.approvalThreshold' })
    key: string;

    @ApiProperty({ example: 5000, description: 'JSON value' })
    value: unknown;

    @ApiProperty()
    updatedAt: Date;

    @ApiProperty({ nullable: true, type: FinancePersonDto })
    updatedBy: FinancePersonDto | null;
}

export class FinanceSettingListDto {
    @ApiProperty({ type: [FinanceSettingDto] })
    items: FinanceSettingDto[];
}
