import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
    ChequeState,
    FinancePaymentMethod,
    PostingStatus,
} from '@prisma/client';
import { Type } from 'class-transformer';
import {
    ArrayMaxSize,
    ArrayMinSize,
    IsArray,
    IsBoolean,
    IsDefined,
    IsEnum,
    IsIn,
    IsNotEmpty,
    IsOptional,
    IsString,
    Length,
    MaxLength,
    ValidateNested,
} from 'class-validator';

import { FinancePageQueryDto } from './finance-query.dto';
import { IsDateOnly, TrimString } from './finance.validators';

/**
 * What auto allocation may settle (plan 3.3): `AUTO` = open charges oldest due
 * first, skipping MAINTENANCE_DEPOSIT; `DEPOSIT` = deposit charges only.
 */
export const PAY_FOR = ['AUTO', 'DEPOSIT'] as const;
export type PayFor = (typeof PAY_FOR)[number];

/** Most explicit allocations one request may carry. */
export const MAX_ALLOCATIONS = 50;

const AMOUNT_DOC = {
    description:
        'EGP, 0.01 to 9,999,999.99, at most 2 decimals. A decimal string (canonical) or a JSON number.',
    oneOf: [{ type: 'number' }, { type: 'string' }],
};

export class FinanceAllocationInputDto {
    @ApiProperty()
    @IsString()
    @Length(1, 64)
    chargeId: string;

    @ApiProperty({ example: '450.00', ...AMOUNT_DOC })
    @IsDefined()
    amount: number | string;
}

/** `POST /finance/payments` (header `Idempotency-Key` required). */
export class FinancePaymentCreateDto {
    @ApiProperty({ example: 'flat_A1-3-2' })
    @IsString()
    @Length(1, 64)
    flatId: string;

    @ApiProperty({ example: '900.00', ...AMOUNT_DOC })
    @IsDefined()
    amount: number | string;

    @ApiProperty({ enum: FinancePaymentMethod })
    @IsEnum(FinancePaymentMethod)
    method: FinancePaymentMethod;

    @ApiPropertyOptional({
        description: 'Transfer ref, cheque number or InstaPay ref',
        maxLength: 100,
    })
    @TrimString()
    @IsString()
    @Length(1, 100)
    @IsOptional()
    reference?: string;

    @ApiProperty({
        example: '2026-11-02',
        description:
            'Cash date, YYYY-MM-DD (Cairo). Not in the future; its month must be OPEN.',
    })
    @IsDateOnly()
    receivedAt: string;

    @ApiPropertyOptional({ maxLength: 120 })
    @TrimString()
    @IsString()
    @Length(1, 120)
    @IsOptional()
    payerName?: string;

    @ApiPropertyOptional({ maxLength: 500 })
    @TrimString()
    @IsString()
    @Length(1, 500)
    @IsOptional()
    note?: string;

    @ApiPropertyOptional({
        description:
            'Path returned by POST /finance/attachments (your own upload, private bucket)',
    })
    @IsString()
    @MaxLength(300)
    @IsOptional()
    attachmentPath?: string;

    @ApiPropertyOptional({
        type: [FinanceAllocationInputDto],
        description:
            'Explicit allocations. Omit for auto allocation (oldest due first). The rest stays as credit.',
    })
    @IsArray()
    @ArrayMinSize(1)
    @ArrayMaxSize(MAX_ALLOCATIONS)
    @ValidateNested({ each: true })
    @Type(() => FinanceAllocationInputDto)
    @IsOptional()
    allocations?: FinanceAllocationInputDto[];

    @ApiPropertyOptional({ enum: PAY_FOR, default: 'AUTO' })
    @IsIn(PAY_FOR)
    @IsOptional()
    payFor?: PayFor;

    @ApiPropertyOptional({
        description:
            'Post even though a live payment with the same method and reference exists (after a duplicateReference warning)',
    })
    @IsBoolean()
    @IsOptional()
    force?: boolean;

    @ApiPropertyOptional({
        description: 'Id of the voided payment this one corrects (same flat)',
    })
    @IsString()
    @MaxLength(64)
    @IsOptional()
    replacesId?: string;
}

/** `POST /finance/payments/:id/cheque-cleared|cheque-bounced`. */
export class FinanceChequeDateDto {
    @ApiPropertyOptional({
        example: '2026-11-02',
        description:
            'Cairo date of the clearance/bounce (default today). Not in the future, not before receivedAt; its month must be OPEN.',
    })
    @IsDateOnly()
    @IsOptional()
    date?: string;
}

/** `POST /finance/flats/:id/apply-credit`. */
export class FinanceApplyCreditDto {
    @ApiProperty({
        example: '550.00',
        description:
            'The availableCredit the client displayed (decimal string). A different server figure is 409 finance.error.creditChanged, so a retry cannot apply credit twice.',
    })
    @IsString()
    @IsNotEmpty()
    expectedCredit: string;

    @ApiPropertyOptional({
        type: [FinanceAllocationInputDto],
        description:
            'Explicit charges and amounts. Omit for auto (oldest due first).',
    })
    @IsArray()
    @ArrayMinSize(1)
    @ArrayMaxSize(MAX_ALLOCATIONS)
    @ValidateNested({ each: true })
    @Type(() => FinanceAllocationInputDto)
    @IsOptional()
    allocations?: FinanceAllocationInputDto[];

    @ApiPropertyOptional({ enum: PAY_FOR, default: 'AUTO' })
    @IsIn(PAY_FOR)
    @IsOptional()
    payFor?: PayFor;

    @ApiPropertyOptional({
        ...AMOUNT_DOC,
        description: 'Auto mode: apply at most this much (default all credit)',
    })
    @IsOptional()
    amount?: number | string;
}

/** `GET /finance/payments`. */
export class FinancePaymentsQueryDto extends FinancePageQueryDto {
    @ApiPropertyOptional()
    @IsString()
    @MaxLength(64)
    @IsOptional()
    flatId?: string;

    @ApiPropertyOptional({ enum: FinancePaymentMethod })
    @IsEnum(FinancePaymentMethod)
    @IsOptional()
    method?: FinancePaymentMethod;

    @ApiPropertyOptional({ enum: PostingStatus })
    @IsEnum(PostingStatus)
    @IsOptional()
    status?: PostingStatus;

    @ApiPropertyOptional({ enum: ChequeState })
    @IsEnum(ChequeState)
    @IsOptional()
    chequeState?: ChequeState;

    @ApiPropertyOptional({ description: 'Only payments posted by this user' })
    @IsString()
    @MaxLength(64)
    @IsOptional()
    createdById?: string;

    @ApiPropertyOptional({
        example: '2026-11-01',
        description: 'receivedAt from (inclusive)',
    })
    @IsDateOnly()
    @IsOptional()
    from?: string;

    @ApiPropertyOptional({
        example: '2026-11-30',
        description: 'receivedAt to (inclusive)',
    })
    @IsDateOnly()
    @IsOptional()
    to?: string;

    @ApiPropertyOptional({
        description: 'Receipt number or reference contains',
        maxLength: 100,
    })
    @TrimString()
    @IsString()
    @Length(1, 100)
    @IsOptional()
    q?: string;
}

/** `GET /finance/attachments/signed-url`: exactly one of `paymentId`, `path`. */
export class FinanceSignedUrlQueryDto {
    @ApiPropertyOptional({ description: 'Payment whose attachment to open' })
    @IsString()
    @MaxLength(64)
    @IsOptional()
    paymentId?: string;

    @ApiPropertyOptional({
        description: 'Stored attachment path (must belong to a payment)',
    })
    @IsString()
    @MaxLength(300)
    @IsOptional()
    path?: string;
}
