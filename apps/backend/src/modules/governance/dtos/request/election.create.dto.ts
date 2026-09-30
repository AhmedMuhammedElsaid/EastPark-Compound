import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ElectionVisibilityMode } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsDate, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ElectionCreateDto {
    @ApiProperty({ example: 'Board of Directors Election 2025' })
    @IsString()
    @IsNotEmpty()
    title: string;

    @ApiProperty({ example: 'انتخابات مجلس الإدارة 2025' })
    @IsString()
    @IsNotEmpty()
    titleAr: string;

    @ApiPropertyOptional()
    @IsString()
    @IsOptional()
    description?: string;

    @ApiPropertyOptional()
    @IsString()
    @IsOptional()
    descriptionAr?: string;

    @ApiProperty({ description: 'Election expiry ISO 8601 date' })
    @Type(() => Date)
    @IsDate()
    expiresAt: Date;

    @ApiPropertyOptional({ enum: ElectionVisibilityMode, default: ElectionVisibilityMode.SEALED_UNTIL_DEADLINE })
    @IsEnum(ElectionVisibilityMode)
    @IsOptional()
    visibilityMode?: ElectionVisibilityMode;
}
