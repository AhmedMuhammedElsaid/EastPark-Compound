import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class SavedShopQueryDto {
    @ApiPropertyOptional()
    @IsString()
    @IsOptional()
    cursor?: string;

    @ApiPropertyOptional({ minimum: 1, maximum: 50 })
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(50)
    @IsOptional()
    limit?: number;
}
