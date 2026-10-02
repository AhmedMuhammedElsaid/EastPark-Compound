import { ApiPropertyOptional } from '@nestjs/swagger';
import { ShopCategory } from '@prisma/client';
import { Type } from 'class-transformer';
import {
    IsBoolean,
    IsEnum,
    IsInt,
    IsOptional,
    IsPhoneNumber,
    IsString,
    Min,
    ValidateNested,
} from 'class-validator';

import { WorkingHoursDto } from './working-hours.dto';

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
        type: WorkingHoursDto,
        description: 'Working hours per day (mon..sun), HH:mm 24h',
        example: { mon: { open: '09:00', close: '22:00', closed: false } },
    })
    @IsOptional()
    @ValidateNested()
    @Type(() => WorkingHoursDto)
    workingHours?: WorkingHoursDto;
}
