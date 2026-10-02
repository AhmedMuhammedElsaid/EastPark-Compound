import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentMethod } from '@prisma/client';
import { Type } from 'class-transformer';
import {
    ArrayMinSize,
    IsArray,
    IsEnum,
    IsInt,
    IsNotEmpty,
    IsOptional,
    IsString,
    Max,
    Min,
    ValidateNested,
} from 'class-validator';

export const ORDER_ITEM_MAX_QUANTITY = 99;

export class OrderItemDto {
    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    productId: string;

    @ApiProperty({ minimum: 1, maximum: ORDER_ITEM_MAX_QUANTITY })
    @IsInt()
    @Min(1)
    @Max(ORDER_ITEM_MAX_QUANTITY)
    quantity: number;
}

export class OrderCreateDto {
    @ApiProperty({ type: [OrderItemDto] })
    @IsArray()
    @ArrayMinSize(1)
    @ValidateNested({ each: true })
    @Type(() => OrderItemDto)
    items: OrderItemDto[];

    @ApiPropertyOptional({
        description: 'Free-text delivery notes (no time slots)',
    })
    @IsString()
    @IsOptional()
    notes?: string;

    @ApiProperty({
        description: 'Unit number for delivery (pre-filled from profile)',
    })
    @IsString()
    @IsNotEmpty()
    deliveryUnit: string;

    @ApiProperty({ enum: PaymentMethod, default: PaymentMethod.CASH })
    @IsEnum(PaymentMethod)
    paymentMethod: PaymentMethod;
}
