import { ApiProperty } from '@nestjs/swagger';
import { FinancePaymentMethod, PeriodStatus } from '@prisma/client';

/*
 * `GET /finance/dashboard` (slice 9, section 3.2). Unlike the other finance
 * DTOs, money is a 2-dp decimal STRING (`"12500.00"`, may be negative) and a
 * percentage a 1-dp string rounded half up (`"87.4"`), so no float ever
 * touches a figure: clients convert in one adapter. Dates are `YYYY-MM-DD`,
 * months `YYYY-MM`. Counts are integers. No phone, email or payer name.
 */

const MONEY = { type: String, example: '12500.00' } as const;
const PERCENT = {
    type: String,
    nullable: true,
    example: '87.4',
    description: '1 dp, half up; null when the denominator is 0',
} as const;

export class FinanceDashboardPeriodDto {
    @ApiProperty({ example: '2026-11' })
    period: string;

    @ApiProperty({ enum: PeriodStatus, description: 'A missing row is OPEN' })
    status: PeriodStatus;
}

export class FinanceDashboardCohortDto {
    @ApiProperty({
        ...MONEY,
        description:
            'Live operating charges with accrualPeriod = the as-of month',
    })
    charges: string;

    @ApiProperty({ ...MONEY, description: 'Live allocations to those charges' })
    allocated: string;

    @ApiProperty({ ...MONEY, description: 'charges − allocated' })
    open: string;

    @ApiProperty({ ...PERCENT, description: 'allocated ÷ charges × 100' })
    rate: string | null;
}

export class FinanceDashboardMonthAmountDto {
    @ApiProperty({ example: '2026-11' })
    period: string;

    @ApiProperty({
        ...MONEY,
        description: 'N-1 flow of the month (may be negative)',
    })
    amount: string;
}

export class FinanceDashboardMethodDto {
    @ApiProperty({ enum: FinancePaymentMethod })
    method: FinancePaymentMethod;

    @ApiProperty({ ...MONEY, description: 'Received in the month' })
    gross: string;

    @ApiProperty({
        ...MONEY,
        description: 'Bounced or voided in the month (≤ 0)',
    })
    reversed: string;

    @ApiProperty({ ...MONEY, description: 'gross + reversed' })
    net: string;
}

export class FinanceDashboardCreditDto {
    @ApiProperty({ description: 'Flats with balance < 0' })
    netCreditFlats: number;

    @ApiProperty({ ...MONEY, description: 'Σ −balance over those flats' })
    netCreditTotal: string;

    @ApiProperty({
        ...MONEY,
        description: 'Σ unallocated live payments, every flat',
    })
    creditTotal: string;
}

export class FinanceDashboardAgingDto {
    @ApiProperty({
        ...MONEY,
        description: '0–30 days past due, incl. not yet due',
    })
    current: string;

    @ApiProperty(MONEY)
    d31_60: string;

    @ApiProperty(MONEY)
    d61_90: string;

    @ApiProperty({ ...MONEY, description: '91 days or more' })
    over90: string;
}

export class FinanceDashboardDepositsDto {
    @ApiProperty({
        ...MONEY,
        description: 'MAINTENANCE_DEPOSIT charges, flow of the month',
    })
    billed: string;

    @ApiProperty({
        ...MONEY,
        description:
            'DEPOSIT_IN fund entries counted in the fund, flow of the month',
    })
    collected: string;
}

export class FinanceDashboardUnappliedItemDto {
    @ApiProperty()
    paymentId: string;

    @ApiProperty()
    flatId: string;

    @ApiProperty({ example: 'A1-3-2' })
    flatLabel: string;

    @ApiProperty({ enum: FinancePaymentMethod })
    method: FinancePaymentMethod;

    @ApiProperty({ example: '2026-10-04' })
    receivedAt: string;

    @ApiProperty(MONEY)
    unallocated: string;

    @ApiProperty({ description: 'Days from receipt to the as-of date' })
    ageDays: number;
}

export class FinanceDashboardUnappliedDto {
    @ApiProperty()
    count: number;

    @ApiProperty(MONEY)
    total: string;

    @ApiProperty({
        type: [FinanceDashboardUnappliedItemDto],
        description: 'The 5 oldest, by receivedAt then id',
    })
    oldest: FinanceDashboardUnappliedItemDto[];
}

export class FinanceDashboardCountTotalDto {
    @ApiProperty()
    count: number;

    @ApiProperty(MONEY)
    total: string;
}

export class FinanceDashboardChecksDto {
    @ApiProperty({ description: 'PREVIEW billing runs booking into the month' })
    previewBillingRuns: number;

    @ApiProperty({ description: 'PREVIEW import batches dated in the month' })
    previewImportBatches: number;

    @ApiProperty({
        description: 'Live operating charges with accrualPeriod = the month',
    })
    operatingChargesInMonth: number;
}

export class FinanceDashboardFloorDto {
    @ApiProperty({ example: '3' })
    floor: string;

    @ApiProperty()
    totalFlats: number;

    @ApiProperty()
    owingFlats: number;

    @ApiProperty(MONEY)
    outstanding: string;
}

export class FinanceDashboardBuildingDto {
    @ApiProperty({ example: 'A1' })
    building: string;

    @ApiProperty()
    totalFlats: number;

    @ApiProperty()
    owingFlats: number;

    @ApiProperty(MONEY)
    outstanding: string;

    @ApiProperty({
        type: [FinanceDashboardFloorDto],
        description: 'G first, then 1, 2, …',
    })
    floors: FinanceDashboardFloorDto[];
}

export class FinanceDashboardTopOwingDto {
    @ApiProperty()
    flatId: string;

    @ApiProperty({ example: 'A1-3-2' })
    label: string;

    @ApiProperty({
        type: String,
        nullable: true,
        description:
            'Current owner name; null when there is none or the account was deleted',
    })
    ownerName: string | null;

    @ApiProperty({
        description: 'The last owner account was deleted (show "former owner")',
    })
    ownerDeleted: boolean;

    @ApiProperty(MONEY)
    balance: string;

    @ApiProperty({
        description:
            'Days past due of the oldest open charge (0 when not yet due)',
    })
    daysPastDue: number;
}

export class FinanceDashboardSeriesPointDto {
    @ApiProperty({ example: '2026-10' })
    period: string;

    @ApiProperty({
        example: '2026-10-31',
        description: 'Month end, or the as-of date for the last point',
    })
    date: string;

    @ApiProperty(MONEY)
    outstanding: string;

    @ApiProperty()
    owingFlats: number;

    @ApiProperty(MONEY)
    fundBalance: string;
}

export class FinanceDashboardPreviousDto {
    @ApiProperty({
        example: '2026-10-15',
        description: 'D′: the as-of date minus one month, clamped',
    })
    asOf: string;

    @ApiProperty({ type: FinanceDashboardCohortDto })
    cohort: FinanceDashboardCohortDto;

    @ApiProperty({
        ...MONEY,
        description: "Month-to-date flow of D′'s month up to D′",
    })
    collected: string;

    @ApiProperty(MONEY)
    outstanding: string;

    @ApiProperty()
    owingFlats: number;

    @ApiProperty(MONEY)
    fundBalance: string;
}

export class FinanceDashboardDeltasDto {
    @ApiProperty({
        ...PERCENT,
        description: 'Relative change vs D′; null on a zero baseline',
    })
    collected: string | null;

    @ApiProperty(PERCENT)
    outstanding: string | null;

    @ApiProperty(PERCENT)
    owingFlats: string | null;

    @ApiProperty(PERCENT)
    fundBalance: string | null;

    @ApiProperty({
        ...PERCENT,
        description: 'cohort.rate − previous.cohort.rate, in percentage points',
    })
    rate: string | null;
}

export class FinanceDashboardDto {
    @ApiProperty({ example: '2026-11-15' })
    asOf: string;

    @ApiProperty({ enum: [6, 12] })
    months: number;

    @ApiProperty({ type: FinanceDashboardPeriodDto })
    period: FinanceDashboardPeriodDto;

    @ApiProperty({ type: FinanceDashboardCohortDto })
    cohort: FinanceDashboardCohortDto;

    @ApiProperty({
        type: [FinanceDashboardMonthAmountDto],
        description: 'Operating charges, oldest month first',
    })
    billed: FinanceDashboardMonthAmountDto[];

    @ApiProperty({
        type: [FinanceDashboardMonthAmountDto],
        description:
            'Allocations to every charge except MAINTENANCE_DEPOSIT (opening balances included, Q4 / L-4), by allocatedAt',
    })
    collected: FinanceDashboardMonthAmountDto[];

    @ApiProperty({
        type: [FinanceDashboardMethodDto],
        description: 'Month M, every method, isOpening excluded',
    })
    receiptsByMethod: FinanceDashboardMethodDto[];

    @ApiProperty({
        ...MONEY,
        description: 'Σ open amount, every flat (= Σ balance + Σ credit)',
    })
    outstanding: string;

    @ApiProperty({ type: FinanceDashboardCreditDto })
    credit: FinanceDashboardCreditDto;

    @ApiProperty({ type: FinanceDashboardAgingDto })
    aging: FinanceDashboardAgingDto;

    @ApiProperty({ description: 'Flats with balance > 0' })
    owingFlats: number;

    @ApiProperty({ description: 'Every flat, active or not' })
    totalFlats: number;

    @ApiProperty({
        ...MONEY,
        description: 'Fund balance (IN − OUT, countsInFundTotal)',
    })
    fundBalance: string;

    @ApiProperty({ type: FinanceDashboardDepositsDto })
    deposits: FinanceDashboardDepositsDto;

    @ApiProperty({ type: FinanceDashboardUnappliedDto })
    unapplied: FinanceDashboardUnappliedDto;

    @ApiProperty({
        type: FinanceDashboardCountTotalDto,
        description: 'Live cheques not cleared by D',
    })
    pendingCheques: FinanceDashboardCountTotalDto;

    @ApiProperty({ type: FinanceDashboardChecksDto })
    checks: FinanceDashboardChecksDto;

    @ApiProperty({
        type: [FinanceDashboardBuildingDto],
        description: 'By building code',
    })
    byBuilding: FinanceDashboardBuildingDto[];

    @ApiProperty({
        type: [FinanceDashboardTopOwingDto],
        description: 'Balance DESC, id ASC (= flats?sort=balance page 1)',
    })
    topOwing: FinanceDashboardTopOwingDto[];

    @ApiProperty({
        type: [FinanceDashboardSeriesPointDto],
        description: 'Stock at each month end, last point = D',
    })
    series: FinanceDashboardSeriesPointDto[];

    @ApiProperty({ type: FinanceDashboardPreviousDto })
    previous: FinanceDashboardPreviousDto;

    @ApiProperty({ type: FinanceDashboardDeltasDto })
    deltas: FinanceDashboardDeltasDto;
}
