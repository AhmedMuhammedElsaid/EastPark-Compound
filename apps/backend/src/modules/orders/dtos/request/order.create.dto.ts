import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentMethod } from '@prisma/client';
import { Type } from 'class-transformer';
import {
    ArrayMaxSize,
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
/** Distinct products per order. */
export const ORDER_MAX_ITEMS = 50;
/**
 * Cap on the server-computed order total (EGP). The per-field caps alone allow
 * 50 x 99 x 100,000 = 495M, above the Decimal(10,2) column maximum
 * (99,999,999.99), so the service checks the total before the write.
 */
export const ORDER_MAX_TOTAL = 1_000_000;

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
    @ApiProperty({ type: [OrderItemDto], maxItems: ORDER_MAX_ITEMS })
    @IsArray()
    @ArrayMinSize(1)
    @ArrayMaxSize(ORDER_MAX_ITEMS)
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
