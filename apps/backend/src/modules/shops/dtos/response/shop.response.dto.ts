import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ShopCategory } from '@prisma/client';

export class ShopPhotoResponseDto {
    @ApiProperty() id: string;
    @ApiProperty() url: string;
    @ApiProperty() order: number;
    @ApiProperty() isPrimary: boolean;
}

export class ShopResponseDto {
    @ApiProperty() id: string;
    @ApiProperty() name: string;
    @ApiProperty() nameAr: string;
    @ApiPropertyOptional() description?: string | null;
    @ApiPropertyOptional() descriptionAr?: string | null;
    @ApiProperty({ enum: ShopCategory }) category: ShopCategory;
    @ApiProperty({ type: [ShopPhotoResponseDto] })
    photos: ShopPhotoResponseDto[];
    @ApiPropertyOptional() workingHours?: unknown;
    @ApiProperty() isOpen: boolean;
    @ApiPropertyOptional() phone?: string | null;
    @ApiPropertyOptional() whatsapp?: string | null;
    @ApiPropertyOptional() deliveryTime?: number | null;
    @ApiProperty() merchantId: string;
    @ApiProperty() createdAt: Date;
    @ApiProperty() updatedAt: Date;
    @ApiProperty({ description: 'Number of reviews' }) reviewCount: number;
    @ApiPropertyOptional({ description: 'Average rating (1–5) or null if no reviews' }) averageRating?: number | null;
}

export class ShopListResponseDto {
    @ApiProperty({ type: [ShopResponseDto] }) items: ShopResponseDto[];
    @ApiPropertyOptional({ description: 'Pass as cursor for next page' })
    nextCursor?: string;
}
