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
    Min,
    ValidateNested,
} from 'class-validator';

export class OrderItemDto {
    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    productId: string;

    @ApiProperty({ minimum: 1 })
    @IsInt()
    @Min(1)
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
