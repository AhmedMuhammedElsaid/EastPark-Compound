import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Role } from '@prisma/client';

import { ResidentUnitDto } from 'src/modules/units/dtos/resident-unit.dto';

/** Team & roles list item. Never carries passwordHash, pushToken or phone. */
export class AdminUserItemDto {
    @ApiProperty() id: string;
    @ApiProperty() name: string;
    @ApiProperty() email: string;
    @ApiProperty({ enum: Role }) role: Role;
    @ApiProperty({ type: String, nullable: true }) unitNumber: string | null;
    @ApiProperty() createdAt: Date;
}

/** List item: also every flat the account owns, oldest first. */
export class AdminUserListItemDto extends AdminUserItemDto {
    @ApiProperty({ type: [ResidentUnitDto] }) units: ResidentUnitDto[];
}

export class AdminUserListResponseDto {
    @ApiProperty({ type: [AdminUserListItemDto] })
    items: AdminUserListItemDto[];
    @ApiPropertyOptional() nextCursor?: string;
}

/** The merchant's live shop (the one the merchant dashboard serves). */
export class AdminMerchantShopDto {
    @ApiProperty() id: string;
    @ApiProperty() name: string;
    @ApiProperty() nameAr: string;
}

/** Merchant picker item: id, name and email only (no phone, unit or tokens). */
export class AdminMerchantItemDto {
    @ApiProperty() id: string;
    @ApiProperty() name: string;
    @ApiProperty() email: string;
    @ApiProperty({ type: AdminMerchantShopDto, nullable: true })
    shop: AdminMerchantShopDto | null;
}

export class AdminMerchantListResponseDto {
    @ApiProperty({ type: [AdminMerchantItemDto] })
    items: AdminMerchantItemDto[];
    @ApiPropertyOptional() nextCursor?: string;
}
