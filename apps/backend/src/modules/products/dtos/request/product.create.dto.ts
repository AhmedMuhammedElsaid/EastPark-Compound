import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
    IsBoolean,
    IsNotEmpty,
    IsNumber,
    IsOptional,
    IsString,
    IsUrl,
    Max,
    Min,
} from 'class-validator';

/**
 * Business cap on a product price (EGP). Far below the Decimal(10,2) column
 * maximum (99,999,999.99), so an absurd value is a 400, never a Prisma error.
 */
export const PRODUCT_MAX_PRICE = 100_000;

export class ProductCreateDto {
    @ApiProperty({ example: 'Cappuccino' })
    @IsString()
    @IsNotEmpty()
    name: string;

    @ApiProperty({ example: 'كابتشينو' })
    @IsString()
    @IsNotEmpty()
    nameAr: string;

    @ApiPropertyOptional({ example: 'Freshly brewed espresso with milk' })
    @IsString()
    @IsOptional()
    description?: string;

    @ApiPropertyOptional({ example: 'وصف المنتج بالعربية' })
    @IsString()
    @IsOptional()
    descriptionAr?: string;

    @ApiProperty({
        example: 35.5,
        description: 'Price in EGP',
        minimum: 0.01,
        maximum: PRODUCT_MAX_PRICE,
    })
    @IsNumber({ maxDecimalPlaces: 2 })
    @Min(0.01)
    @Max(PRODUCT_MAX_PRICE)
    price: number;

    @ApiPropertyOptional({ description: 'Image URL from /uploads/image' })
    @IsUrl()
    @IsOptional()
    imageUrl?: string;

    @ApiPropertyOptional({ default: true })
    @IsBoolean()
    @IsOptional()
    isAvailable?: boolean;
}
