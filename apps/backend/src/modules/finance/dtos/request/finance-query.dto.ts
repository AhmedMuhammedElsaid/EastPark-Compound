import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
    IsBoolean,
    IsIn,
    IsInt,
    IsOptional,
    IsString,
    Max,
    MaxLength,
    Min,
} from 'class-validator';

import { ToBoolean } from 'src/common/helper/transforms/to-boolean.transform';
import { FINANCE_AUDIT_ACTIONS } from 'src/modules/audit/audit.actions';

import { IsDateOnly, IsPeriod, TrimString } from './finance.validators';

/** Shared cursor + limit (plan 7: default 20, max 100). */
export class FinancePageQueryDto {
    @ApiPropertyOptional()
    @IsString()
    @MaxLength(64)
    @IsOptional()
    cursor?: string;

    @ApiPropertyOptional({ default: 20, maximum: 100 })
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(100)
    @IsOptional()
    limit?: number = 20;
}

/** `?asOf=YYYY-MM-DD` (default: today in Cairo). */
export class FinanceAsOfQueryDto {
    @ApiPropertyOptional({
        example: '2026-11-02',
        description: 'Figures as of this Cairo date (default today)',
    })
    @IsDateOnly()
    @IsOptional()
    asOf?: string;
}

/** `GET /finance/flats`. */
export class FinanceFlatsQueryDto extends FinancePageQueryDto {
    @ApiPropertyOptional({
        description: 'Label search, e.g. "A1-3"',
        maxLength: 20,
    })
    @TrimString()
    @IsString()
    @MaxLength(20)
    @IsOptional()
    q?: string;

    @ApiPropertyOptional({ example: 'A1' })
    @Transform(({ value }: { value: unknown }) =>
        typeof value === 'string' ? value.trim().toUpperCase() : value
    )
    @IsString()
    @MaxLength(10)
    @IsOptional()
    building?: string;

    @ApiPropertyOptional({ example: 'phase-1' })
    @TrimString()
    @IsString()
    @MaxLength(20)
    @IsOptional()
    phase?: string;

    @ApiPropertyOptional({
        description:
            'true: only flats that owe money (balance > 0); false: only flats at zero or in credit',
    })
    @ToBoolean()
    @IsBoolean()
    @IsOptional()
    hasBalance?: boolean;

    @ApiPropertyOptional({
        description:
            'Only flats whose oldest open charge is at least this many days past due',
    })
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(36500)
    @IsOptional()
    overdueDays?: number;

    @ApiPropertyOptional({
        example: '2026-11-02',
        description: 'Figures as of this Cairo date (default today)',
    })
    @IsDateOnly()
    @IsOptional()
    asOf?: string;
}

/** `GET /finance/audit`. */
export class FinanceAuditQueryDto extends FinancePageQueryDto {
    @ApiPropertyOptional({ example: 'Charge' })
    @TrimString()
    @IsString()
    @MaxLength(40)
    @IsOptional()
    entity?: string;

    @ApiPropertyOptional()
    @TrimString()
    @IsString()
    @MaxLength(64)
    @IsOptional()
    entityId?: string;

    @ApiPropertyOptional({ enum: FINANCE_AUDIT_ACTIONS })
    @IsIn(FINANCE_AUDIT_ACTIONS)
    @IsOptional()
    action?: string;

    @ApiPropertyOptional({ description: 'Only actions by this user' })
    @IsString()
    @MaxLength(64)
    @IsOptional()
    actorId?: string;

    @ApiPropertyOptional({
        example: '2026-11-01',
        description: 'From this Cairo date (inclusive)',
    })
    @IsDateOnly()
    @IsOptional()
    from?: string;

    @ApiPropertyOptional({
        example: '2026-11-30',
        description: 'To this Cairo date (inclusive)',
    })
    @IsDateOnly()
    @IsOptional()
    to?: string;
}

/** `GET /finance/periods`: a month range, newest first (default the last 12 months). */
export class FinancePeriodsQueryDto {
    @ApiPropertyOptional({ example: '2026-01' })
    @IsPeriod()
    @IsOptional()
    from?: string;

    @ApiPropertyOptional({ example: '2026-12' })
    @IsPeriod()
    @IsOptional()
    to?: string;
}
