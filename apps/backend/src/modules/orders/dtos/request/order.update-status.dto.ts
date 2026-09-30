import { ApiProperty } from '@nestjs/swagger';
import { OrderStatus } from '@prisma/client';
import { IsEnum, IsNotEmpty } from 'class-validator';

export class OrderUpdateStatusDto {
    @ApiProperty({
        enum: [
            OrderStatus.CONFIRMED,
            OrderStatus.PREPARING,
            OrderStatus.READY,
            OrderStatus.ON_THE_WAY,
            OrderStatus.DELIVERED,
            OrderStatus.CANCELLED,
        ],
        description: 'New order status (merchant/admin only)',
    })
    @IsEnum(OrderStatus)
    @IsNotEmpty()
    status: OrderStatus;
}
