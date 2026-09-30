import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AnnouncementCategory } from '@prisma/client';
import { Type } from 'class-transformer';
import {
    IsDate,
    IsEnum,
    IsNotEmpty,
    IsOptional,
    IsString,
    IsUrl,
} from 'class-validator';

export class AnnouncementCreateDto {
    @ApiProperty({ example: 'Community Meeting' })
    @IsString()
    @IsNotEmpty()
    title: string;

    @ApiProperty({ example: 'اجتماع المجتمع' })
    @IsString()
    @IsNotEmpty()
    titleAr: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    body: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    bodyAr: string;

    @ApiPropertyOptional({
        enum: AnnouncementCategory,
        default: AnnouncementCategory.GENERAL,
    })
    @IsEnum(AnnouncementCategory)
    @IsOptional()
    category?: AnnouncementCategory;

    @ApiPropertyOptional({ description: 'PDF URL from /uploads/pdf' })
    @IsUrl()
    @IsOptional()
    pdfUrl?: string;

    @ApiPropertyOptional({
        description: 'Publish date. Defaults to now if omitted.',
        example: '2025-06-01T00:00:00.000Z',
    })
    @Type(() => Date)
    @IsDate()
    @IsOptional()
    publishedAt?: Date;
}
