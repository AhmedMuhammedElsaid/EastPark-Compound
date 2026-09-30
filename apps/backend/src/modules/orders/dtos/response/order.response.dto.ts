import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OrderStatus, PaymentMethod } from '@prisma/client';

export class OrderItemResponseDto {
    @ApiProperty() id: string;
    @ApiProperty() productId: string;
    @ApiProperty() productNameSnapshot: string;
    @ApiProperty() productNameArSnapshot: string;
    @ApiProperty() quantity: number;
    @ApiProperty() unitPrice: number;
}

export class OrderResponseDto {
    @ApiProperty() id: string;
    @ApiProperty({ enum: OrderStatus }) status: OrderStatus;
    @ApiProperty() totalAmount: number;
    @ApiPropertyOptional() notes?: string | null;
    @ApiProperty() deliveryUnit: string;
    @ApiProperty({ enum: PaymentMethod }) paymentMethod: PaymentMethod;
    @ApiProperty() isPaid: boolean;
    @ApiPropertyOptional() paymobOrderId?: string | null;
    @ApiPropertyOptional() cancelledAt?: Date | null;
    @ApiProperty() residentId: string;
    @ApiProperty() shopId: string;
    @ApiProperty({ type: [OrderItemResponseDto] })
    items: OrderItemResponseDto[];
    @ApiProperty() createdAt: Date;
    @ApiProperty() updatedAt: Date;
}

export class OrderListResponseDto {
    @ApiProperty({ type: [OrderResponseDto] }) items: OrderResponseDto[];
    @ApiPropertyOptional() nextCursor?: string;
}
