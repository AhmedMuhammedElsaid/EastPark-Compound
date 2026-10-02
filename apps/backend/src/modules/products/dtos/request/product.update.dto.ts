import { ApiPropertyOptional } from '@nestjs/swagger';
import {
    IsBoolean,
    IsNumber,
    IsOptional,
    IsString,
    IsUrl,
    Min,
} from 'class-validator';

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

    @ApiPropertyOptional()
    @IsNumber({ maxDecimalPlaces: 2 })
    @Min(0.01)
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
