import { ApiPropertyOptional } from '@nestjs/swagger';
import { ShopCategory } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ShopQueryDto {
    @ApiPropertyOptional({
        description: 'Cursor for pagination (last item id)',
    })
    @IsString()
    @IsOptional()
    cursor?: string;

    @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 50 })
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(50)
    @IsOptional()
    limit?: number = 20;

    @ApiPropertyOptional({ enum: ShopCategory })
    @IsEnum(ShopCategory)
    @IsOptional()
    category?: ShopCategory;

    @ApiPropertyOptional({ description: 'Search by name' })
    @IsString()
    @IsOptional()
    search?: string;
}
