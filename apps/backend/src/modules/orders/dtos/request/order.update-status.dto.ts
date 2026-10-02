import { ApiProperty } from '@nestjs/swagger';
import { OrderStatus } from '@prisma/client';
import { IsIn, IsNotEmpty } from 'class-validator';

// PLACED is the initial state only — it can never be set via this endpoint.
export const ORDER_UPDATABLE_STATUSES = [
    OrderStatus.CONFIRMED,
    OrderStatus.PREPARING,
    OrderStatus.READY,
    OrderStatus.ON_THE_WAY,
    OrderStatus.DELIVERED,
    OrderStatus.CANCELLED,
] as const;

export class OrderUpdateStatusDto {
    @ApiProperty({
        enum: [...ORDER_UPDATABLE_STATUSES],
        description:
            'New order status (merchant/admin only). Forward one step at a time: ' +
            'PLACED→CONFIRMED→PREPARING→READY→ON_THE_WAY→DELIVERED; CANCELLED ' +
            'allowed before DELIVERED and never for a paid order (409).',
    })
    @IsIn([...ORDER_UPDATABLE_STATUSES])
    @IsNotEmpty()
    status: OrderStatus;
}
