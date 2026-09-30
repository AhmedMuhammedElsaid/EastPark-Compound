import { ApiPropertyOptional } from '@nestjs/swagger';
import { ShopCategory } from '@prisma/client';
import {
    IsBoolean,
    IsEnum,
    IsInt,
    IsOptional,
    IsPhoneNumber,
    IsString,
    Min,
} from 'class-validator';

export class ShopUpdateDto {
    @ApiPropertyOptional()
    @IsString()
    @IsOptional()
    name?: string;

    @ApiPropertyOptional()
    @IsString()
    @IsOptional()
    nameAr?: string;

    @ApiPropertyOptional()
    @IsString()
    @IsOptional()
    description?: string;

    @ApiPropertyOptional()
    @IsString()
    @IsOptional()
    descriptionAr?: string;

    @ApiPropertyOptional({ enum: ShopCategory })
    @IsEnum(ShopCategory)
    @IsOptional()
    category?: ShopCategory;

    @ApiPropertyOptional()
    @IsPhoneNumber()
    @IsOptional()
    phone?: string;

    @ApiPropertyOptional()
    @IsPhoneNumber()
    @IsOptional()
    whatsapp?: string;

    @ApiPropertyOptional()
    @IsInt()
    @Min(1)
    @IsOptional()
    deliveryTime?: number;

    @ApiPropertyOptional({
        description: 'Manual emergency open/close override',
    })
    @IsBoolean()
    @IsOptional()
    isOpen?: boolean;

    @ApiPropertyOptional({
        description: 'Working hours JSON per day',
        example: { mon: { open: '09:00', close: '22:00', closed: false } },
    })
    @IsOptional()
    workingHours?: Record<string, unknown>;
}
