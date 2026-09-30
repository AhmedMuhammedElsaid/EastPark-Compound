import { ApiPropertyOptional } from '@nestjs/swagger';
import { AnnouncementCategory } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class AnnouncementQueryDto {
    @ApiPropertyOptional()
    @IsString()
    @IsOptional()
    cursor?: string;

    @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 50 })
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(50)
    @IsOptional()
    limit?: number = 20;

    @ApiPropertyOptional({ enum: AnnouncementCategory })
    @IsEnum(AnnouncementCategory)
    @IsOptional()
    category?: AnnouncementCategory;
}
