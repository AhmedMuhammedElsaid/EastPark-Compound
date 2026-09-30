import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FeedbackCategory } from '@prisma/client';
import {
    ArrayMaxSize,
    IsArray,
    IsBoolean,
    IsEnum,
    IsNotEmpty,
    IsOptional,
    IsString,
    IsUrl,
} from 'class-validator';

export class FeedbackCreateDto {
    @ApiProperty({ enum: FeedbackCategory })
    @IsEnum(FeedbackCategory)
    @IsNotEmpty()
    category: FeedbackCategory;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    body: string;

    @ApiPropertyOptional({ default: false, description: 'Submit anonymously' })
    @IsBoolean()
    @IsOptional()
    isAnonymous?: boolean;

    @ApiPropertyOptional({
        type: [String],
        description: 'Image URLs from /uploads/image (max 3)',
    })
    @IsArray()
    @IsUrl({}, { each: true })
    @ArrayMaxSize(3)
    @IsOptional()
    attachments?: string[];
}
