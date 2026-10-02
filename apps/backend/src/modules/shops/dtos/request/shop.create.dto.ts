import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ShopCategory } from '@prisma/client';
import { Type } from 'class-transformer';
import {
    IsEnum,
    IsInt,
    IsNotEmpty,
    IsOptional,
    IsPhoneNumber,
    IsString,
    Min,
    ValidateNested,
} from 'class-validator';

import { WorkingHoursDto } from './working-hours.dto';

export class ShopCreateDto {
    @ApiProperty({ example: 'The Corner Cafe' })
    @IsString()
    @IsNotEmpty()
    name: string;

    @ApiProperty({ example: 'كافيه الزاوية' })
    @IsString()
    @IsNotEmpty()
    nameAr: string;

    @ApiPropertyOptional({ example: 'Neighborhood cafe and bakery' })
    @IsString()
    @IsOptional()
    description?: string;

    @ApiPropertyOptional({ example: 'وصف المحل بالعربية' })
    @IsString()
    @IsOptional()
    descriptionAr?: string;

    @ApiProperty({ enum: ShopCategory, example: ShopCategory.CAFE_AND_FOOD })
    @IsEnum(ShopCategory)
    @IsNotEmpty()
    category: ShopCategory;

    @ApiPropertyOptional({ example: '+201012345678' })
    @IsPhoneNumber()
    @IsOptional()
    phone?: string;

    @ApiPropertyOptional({ example: '+201012345678' })
    @IsPhoneNumber()
    @IsOptional()
    whatsapp?: string;

    @ApiPropertyOptional({
        example: 25,
        description: 'Estimated delivery minutes',
    })
    @IsInt()
    @Min(1)
    @IsOptional()
    deliveryTime?: number;

    @ApiPropertyOptional({
        type: WorkingHoursDto,
        description: 'Working hours per day (mon..sun), HH:mm 24h',
    })
    @IsOptional()
    @ValidateNested()
    @Type(() => WorkingHoursDto)
    workingHours?: WorkingHoursDto;

    @ApiProperty({ description: 'Merchant user ID to assign the shop to' })
    @IsString()
    @IsNotEmpty()
    merchantId: string;
}
