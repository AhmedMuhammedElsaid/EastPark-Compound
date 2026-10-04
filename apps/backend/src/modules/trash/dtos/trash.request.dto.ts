import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
    IsIn,
    IsInt,
    IsNotEmpty,
    IsOptional,
    IsString,
    Max,
    Min,
} from 'class-validator';

/** Every kind of record the recycle bin can list and restore. */
export const TRASH_TYPES = [
    'USER',
    'SHOP',
    'SHOP_PHOTO',
    'PRODUCT',
    'REVIEW',
] as const;
export type TrashType = (typeof TRASH_TYPES)[number];

export class TrashQueryDto {
    @ApiProperty({ enum: TRASH_TYPES })
    @IsIn(TRASH_TYPES)
    type: TrashType;

    @ApiPropertyOptional()
    @IsString()
    @IsOptional()
    cursor?: string;

    @ApiPropertyOptional({ default: 20 })
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(50)
    @IsOptional()
    limit?: number = 20;
}

export class TrashRestoreParamsDto {
    @ApiProperty({ enum: TRASH_TYPES })
    @IsIn(TRASH_TYPES)
    type: TrashType;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    id: string;
}
