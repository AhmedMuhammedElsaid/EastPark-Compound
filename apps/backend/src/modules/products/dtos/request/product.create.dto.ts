import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
    IsBoolean,
    IsNotEmpty,
    IsNumber,
    IsOptional,
    IsString,
    IsUrl,
    Min,
} from 'class-validator';

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

    @ApiProperty({ example: 35.5, description: 'Price in EGP' })
    @IsNumber()
    @Min(0)
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
