import { ApiPropertyOptional } from '@nestjs/swagger';
import { ResidentLeadStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

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
}
