import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { ShopResponseDto } from './shop.response.dto';

export class SavedShopResponseDto {
    @ApiProperty() userId: string;
    @ApiProperty() shopId: string;
    @ApiProperty({ type: ShopResponseDto }) shop: ShopResponseDto;
}

export class SavedShopListResponseDto {
    @ApiProperty({ type: [SavedShopResponseDto] }) items: SavedShopResponseDto[];
    @ApiPropertyOptional() nextCursor?: string;
}
