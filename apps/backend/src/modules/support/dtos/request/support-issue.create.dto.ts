import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
    IsEmail,
    IsEnum,
    IsNotEmpty,
    IsOptional,
    IsString,
    IsUrl,
    Length,
    MaxLength,
} from 'class-validator';

export enum SupportIssueCategory {
    ACCESS = 'ACCESS',
    ACCOUNT = 'ACCOUNT',
    BUG = 'BUG',
    SUGGESTION = 'SUGGESTION',
    OTHER = 'OTHER',
}

export class SupportIssueCreateDto {
    @ApiProperty({ example: 'Ahmed Hassan' })
    @IsString()
    @IsNotEmpty()
    @Length(2, 100)
    name: string;

    @ApiProperty({ example: 'ahmed@example.com' })
    @IsEmail()
    @MaxLength(254)
    email: string;

    @ApiProperty({ enum: SupportIssueCategory, example: 'BUG' })
    @IsEnum(SupportIssueCategory)
    category: SupportIssueCategory;

    @ApiProperty({ example: 'Unable to open my orders' })
    @IsString()
    @IsNotEmpty()
    @Length(5, 120)
    subject: string;

    @ApiProperty({ example: 'The orders page remains empty after signing in.' })
    @IsString()
    @IsNotEmpty()
    @Length(20, 4000)
    message: string;

    @ApiPropertyOptional({ example: 'https://eastpark-web-app.vercel.app/orders' })
    @IsOptional()
    @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
    @MaxLength(500)
    pageUrl?: string;
}