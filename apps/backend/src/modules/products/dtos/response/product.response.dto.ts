import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ProductResponseDto {
    @ApiProperty() id: string;
    @ApiProperty() name: string;
    @ApiProperty() nameAr: string;
    @ApiPropertyOptional() description?: string | null;
    @ApiPropertyOptional() descriptionAr?: string | null;
    @ApiProperty() price: number;
    @ApiPropertyOptional() imageUrl?: string | null;
    @ApiProperty() isAvailable: boolean;
    @ApiProperty() shopId: string;
    @ApiProperty() createdAt: Date;
    @ApiProperty() updatedAt: Date;
}

export class ProductListResponseDto {
    @ApiProperty({ type: [ProductResponseDto] }) items: ProductResponseDto[];
    @ApiPropertyOptional() nextCursor?: string;
}
