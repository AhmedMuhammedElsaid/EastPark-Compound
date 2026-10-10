import { ApiPropertyOptional } from '@nestjs/swagger';
import {
    IsBoolean,
    IsNumber,
    IsOptional,
    IsString,
    IsUrl,
    Max,
    Min,
} from 'class-validator';

import { PRODUCT_MAX_PRICE } from './product.create.dto';

export class ProductUpdateDto {
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

    @ApiPropertyOptional({ minimum: 0.01, maximum: PRODUCT_MAX_PRICE })
    @IsNumber({ maxDecimalPlaces: 2 })
    @Min(0.01)
    @Max(PRODUCT_MAX_PRICE)
    @IsOptional()
    price?: number;

    @ApiPropertyOptional({ description: 'Image URL from /uploads/image' })
    @IsUrl()
    @IsOptional()
    imageUrl?: string;

    @ApiPropertyOptional()
    @IsBoolean()
    @IsOptional()
    isAvailable?: boolean;
}
