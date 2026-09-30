import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ReviewCreateDto {
    @ApiProperty({ minimum: 1, maximum: 5 })
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(5)
    rating: number;

    @ApiPropertyOptional()
    @IsString()
    @IsOptional()
    comment?: string;
}
