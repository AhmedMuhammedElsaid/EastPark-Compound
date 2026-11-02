import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export const ACTIVITY_SCOPES = ['admin', 'finance', 'all'] as const;
export type ActivityScope = (typeof ACTIVITY_SCOPES)[number];

export class ActivityQueryDto {
    @ApiPropertyOptional()
    @IsString()
    @IsOptional()
    cursor?: string;

    @ApiPropertyOptional({ default: 20 })
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(50)
    @IsOptional()
    limit?: number = 20;

    @ApiPropertyOptional({ description: 'Only actions by this user' })
    @IsString()
    @IsOptional()
    actorId?: string;

    @ApiPropertyOptional({
        enum: ACTIVITY_SCOPES,
        default: 'admin',
        description:
            'admin (default): admin and governance events only; finance: finance actions only; all: both',
    })
    @IsIn(ACTIVITY_SCOPES)
    @IsOptional()
    scope?: ActivityScope;
}
