import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OrderStatus, PaymentMethod } from '@prisma/client';

export class OrderItemResponseDto {
    @ApiProperty() id: string;
    @ApiProperty() productId: string;
    @ApiProperty() productNameSnapshot: string;
    @ApiProperty() productNameArSnapshot: string;
    @ApiProperty() quantity: number;
    @ApiProperty() unitPrice: number;
    @ApiProperty({ description: 'unitPrice × quantity (EGP)' })
    lineTotal: number;
}

export class OrderShopSummaryDto {
    @ApiProperty() id: string;
    @ApiProperty() name: string;
    @ApiProperty() nameAr: string;
}

/** Merchant/admin responses only. Never carries phone or email. */
export class OrderResidentSummaryDto {
    @ApiProperty() id: string;
    @ApiProperty() name: string;
    @ApiPropertyOptional({ type: String, nullable: true })
    unitNumber: string | null;
}

export class OrderResponseDto {
    @ApiProperty() id: string;
    @ApiProperty({ enum: OrderStatus }) status: OrderStatus;
    @ApiProperty() totalAmount: number;
    @ApiPropertyOptional() notes?: string | null;
    @ApiProperty() deliveryUnit: string;
    @ApiProperty({ enum: PaymentMethod }) paymentMethod: PaymentMethod;
    @ApiProperty() isPaid: boolean;
    @ApiPropertyOptional({ description: 'Paymob order id (set at payment initiation)' })
    paymobOrderId?: string | null;
    @ApiPropertyOptional() cancelledAt?: Date | null;
    @ApiProperty() residentId: string;
    @ApiProperty() shopId: string;
    @ApiProperty({ type: OrderShopSummaryDto })
    shop: OrderShopSummaryDto;
    @ApiPropertyOptional({
        type: OrderResidentSummaryDto,
        description: 'Present for MERCHANT and ADMIN callers only',
    })
    resident?: OrderResidentSummaryDto;
    @ApiProperty({ type: [OrderItemResponseDto] })
    items: OrderItemResponseDto[];
    @ApiProperty() createdAt: Date;
    @ApiProperty() updatedAt: Date;
}

export class OrderListResponseDto {
    @ApiProperty({ type: [OrderResponseDto] }) items: OrderResponseDto[];
    @ApiPropertyOptional() nextCursor?: string;
}
