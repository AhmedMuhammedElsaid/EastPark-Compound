import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ChargeKind } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
    IsDefined,
    IsIn,
    IsOptional,
    IsString,
    Length,
    MaxLength,
} from 'class-validator';

import { VOID_REASON_MIN } from '../../kernel/void-policy';
import { IsDateOnly, IsPeriod, TrimString } from './finance.validators';

/** Kinds a person may post by hand (OPENING_BALANCE is written only by the import). */
export const MANUAL_CHARGE_KINDS = [
    ChargeKind.SERVICE_CHARGE,
    ChargeKind.MAINTENANCE_DEPOSIT,
    ChargeKind.SHORTFALL,
    ChargeKind.SERVICE_FEE,
    ChargeKind.OTHER,
] as const;

/** `POST /finance/charges`. */
export class FinanceChargeCreateDto {
    @ApiProperty({ example: 'flat_A1-3-2' })
    @IsString()
    @Length(1, 64)
    flatId: string;

    @ApiProperty({ enum: MANUAL_CHARGE_KINDS })
    @IsIn(MANUAL_CHARGE_KINDS)
    kind: ChargeKind;

    @ApiProperty({
        example: 450,
        description:
            'EGP, 0.01 to 9,999,999.99, at most 2 decimals (more is rejected with finance.error.amountPrecision, never rounded). A JSON number or a decimal string.',
        oneOf: [{ type: 'number' }, { type: 'string' }],
    })
    @IsDefined()
    amount: number | string;

    @ApiProperty({ example: 'Service charge, November 2026', maxLength: 300 })
    @TrimString()
    @IsString()
    @Length(1, 300)
    description: string;

    @ApiProperty({ example: 'رسوم خدمة نوفمبر 2026', maxLength: 300 })
    @TrimString()
    @IsString()
    @Length(1, 300)
    descriptionAr: string;

    @ApiProperty({
        example: '2026-11-10',
        description: 'YYYY-MM-DD (Cairo date)',
    })
    @IsDateOnly()
    dueDate: string;

    @ApiPropertyOptional({
        example: '2026-11',
        description:
            'YYYY-MM the charge books into; defaults to the month of dueDate. Must be OPEN.',
    })
    @IsPeriod()
    @IsOptional()
    accrualPeriod?: string;

    @ApiPropertyOptional({
        description: 'Id of the voided charge this one corrects (same flat)',
    })
    @IsString()
    @MaxLength(64)
    @IsOptional()
    replacesId?: string;
}

/** `POST /finance/charges/:id/void` (and every later finance void). */
export class FinanceVoidDto {
    @ApiProperty({ minLength: VOID_REASON_MIN, maxLength: 500 })
    @Transform(({ value }: { value: unknown }) =>
        typeof value === 'string' ? value.trim() : value
    )
    @IsString({ message: 'finance.error.reasonRequired' })
    @Length(VOID_REASON_MIN, 500, { message: 'finance.error.reasonRequired' })
    reason: string;
}
