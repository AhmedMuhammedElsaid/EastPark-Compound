import { ApiPropertyOptional } from '@nestjs/swagger';
import { ListingStatus, ListingType } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
    IsEnum,
    IsInt,
    IsOptional,
    IsString,
    Max,
    MaxLength,
    Min,
} from 'class-validator';

class ListingPageQueryDto {
    @ApiPropertyOptional()
    @IsString()
    @IsOptional()
    cursor?: string;

    @ApiPropertyOptional({ default: 20, maximum: 50 })
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(50)
    @IsOptional()
    limit?: number = 20;
}

/** `GET /listings` — browse (APPROVED, unexpired only). */
export class ListingBrowseQueryDto extends ListingPageQueryDto {
    @ApiPropertyOptional({ enum: ListingType })
    @IsEnum(ListingType)
    @IsOptional()
    type?: ListingType;
}

/** `GET /listings/mine` — the caller's own listings, every status. */
export class ListingMineQueryDto extends ListingPageQueryDto {
    @ApiPropertyOptional({ enum: ListingStatus })
    @IsEnum(ListingStatus)
    @IsOptional()
    status?: ListingStatus;
}

/** `GET /admin/listings`. */
export class ListingAdminQueryDto extends ListingPageQueryDto {
    @ApiPropertyOptional({ enum: ListingStatus })
    @IsEnum(ListingStatus)
    @IsOptional()
    status?: ListingStatus;

    @ApiPropertyOptional({ enum: ListingType })
    @IsEnum(ListingType)
    @IsOptional()
    type?: ListingType;

    @ApiPropertyOptional({
        description:
            'Trimmed, case-insensitive search on the unit label (building-floor-flat), building or owner name.',
        maxLength: 100,
    })
    @Transform(({ value }: { value: unknown }) =>
        typeof value === 'string' ? value.trim() : value
    )
    @IsString()
    @MaxLength(100)
    @IsOptional()
    q?: string;
}

/** Cursor + limit only (admin revisions list). */
export class ListingRevisionsQueryDto extends ListingPageQueryDto {}
