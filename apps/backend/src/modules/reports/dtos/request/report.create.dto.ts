import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsNotEmpty, IsOptional, IsString, IsUrl } from 'class-validator';

export class ReportCreateDto {
    @ApiProperty({ example: 'Q1 2025 Financial Report' })
    @IsString()
    @IsNotEmpty()
    title: string;

    @ApiProperty({ example: 'تقرير مالي الربع الأول 2025' })
    @IsString()
    @IsNotEmpty()
    titleAr: string;

    @ApiProperty({ description: 'PDF URL from /uploads/pdf' })
    @IsUrl()
    @IsNotEmpty()
    pdfUrl: string;

    @ApiPropertyOptional({
        description: 'Publish date. Defaults to now if omitted.',
        example: '2025-06-01T00:00:00.000Z',
    })
    @Type(() => Date)
    @IsDate()
    @IsOptional()
    publishedAt?: Date;
}
