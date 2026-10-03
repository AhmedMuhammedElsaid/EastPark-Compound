import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
    IsBoolean,
    IsInt,
    IsOptional,
    IsString,
    Max,
    Min,
} from 'class-validator';

import { ToBoolean } from 'src/common/helper/transforms/to-boolean.transform';

export class ProductQueryDto {
    @ApiPropertyOptional()
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

    @ApiPropertyOptional()
    @IsString()
    @IsOptional()
    search?: string;

    @ApiPropertyOptional({ description: 'Filter by availability' })
    @ToBoolean()
    @IsBoolean()
    @IsOptional()
    isAvailable?: boolean;
}
