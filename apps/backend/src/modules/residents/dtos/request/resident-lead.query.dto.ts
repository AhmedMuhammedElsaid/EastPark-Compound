import { ApiPropertyOptional } from '@nestjs/swagger';
import { ResidentLeadStatus } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
    IsEnum,
    IsInt,
    IsOptional,
    IsString,
    Max,
    MaxLength,
    Min,
} from 'class-validator';

export class ResidentLeadQueryDto {
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

    @ApiPropertyOptional({ enum: ResidentLeadStatus })
    @IsEnum(ResidentLeadStatus)
    @IsOptional()
    status?: ResidentLeadStatus;

    @ApiPropertyOptional({
        description:
            'Trimmed, case-insensitive search on name, email, phone, building, floor or flat number, or a full unit label "building-floor-flat" (e.g. A1-1-4). Empty = no filter.',
        maxLength: 100,
    })
    @Transform(({ value }: { value: unknown }) =>
        typeof value === 'string' ? value.trim() : value
    )
    @IsString()
    @MaxLength(100)
    @IsOptional()
    q?: string;
}
