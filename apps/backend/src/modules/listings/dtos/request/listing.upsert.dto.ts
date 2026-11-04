import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ListingType } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
    ArrayUnique,
    IsArray,
    IsBoolean,
    IsEnum,
    IsInt,
    IsNotEmpty,
    IsNumber,
    IsOptional,
    IsString,
    IsUrl,
    Matches,
    Max,
    MaxLength,
    Min,
} from 'class-validator';

import { LISTING_LIMITS } from '../../listing.constants';

const trim = ({ value }: { value: unknown }): unknown =>
    typeof value === 'string' ? value.trim() : value;

/**
 * Create AND edit body (PATCH is a complete replacement, not a partial update),
 * so both share these validators. Flat rules mirror `ResidentLeadCreateDto`.
 */
export class ListingUpsertDto {
    @ApiProperty({ enum: ListingType })
    @IsEnum(ListingType)
    type: ListingType;

    @ApiProperty({
        example: 'A1',
        description: 'Typed by hand, trimmed and upper-cased, 1-10 chars',
    })
    @Transform(({ value }) =>
        typeof value === 'string' ? value.trim().toUpperCase() : value
    )
    @IsString()
    @IsNotEmpty()
    @MaxLength(LISTING_LIMITS.buildingMax)
    building: string;

    @ApiProperty({ example: '3', description: '"G" (ground) or "1".."11"' })
    @IsString()
    @IsNotEmpty()
    @Matches(/^(G|[1-9]|1[01])$/, {
        message: 'floor must be "G" or a number from 1 to 11',
    })
    floor: string;

    @ApiProperty({ example: '2', description: '"1".."5"' })
    @IsString()
    @IsNotEmpty()
    @Matches(/^[1-5]$/, { message: 'flatNumber must be a number from 1 to 5' })
    flatNumber: string;

    @ApiProperty({
        example: 2500000,
        description:
            'EGP, > 0, max 1,000,000,000, max 2 decimals. SALE = total price, RENT = per month',
    })
    @IsNumber({ allowNaN: false, allowInfinity: false, maxDecimalPlaces: 2 })
    @Min(0.01)
    @Max(LISTING_LIMITS.priceMax)
    price: number;

    @ApiProperty({ example: 140, minimum: 20, maximum: 1000 })
    @IsInt()
    @Min(LISTING_LIMITS.areaMin)
    @Max(LISTING_LIMITS.areaMax)
    areaSqm: number;

    @ApiProperty({ example: 3, minimum: 0, maximum: 10 })
    @IsInt()
    @Min(0)
    @Max(10)
    bedrooms: number;

    @ApiProperty({ example: 2, minimum: 1, maximum: 10 })
    @IsInt()
    @Min(1)
    @Max(10)
    bathrooms: number;

    @ApiProperty()
    @IsBoolean()
    furnished: boolean;

    @ApiPropertyOptional({ maxLength: LISTING_LIMITS.descriptionMax, nullable: true })
    @Transform(trim)
    @IsOptional()
    @IsString()
    @MaxLength(LISTING_LIMITS.descriptionMax)
    description?: string;

    @ApiProperty({
        example: '01012345678',
        description: 'Egyptian mobile — "01xxxxxxxxx" or "+201xxxxxxxxx"',
    })
    @Transform(({ value }) =>
        typeof value === 'string' ? value.replace(/[\s()-]/g, '') : value
    )
    @IsString()
    @IsNotEmpty()
    @Matches(/^(?:\+?20|0)1[0125]\d{8}$/, {
        message:
            'contactPhone must be a valid Egyptian mobile number, e.g. 01012345678',
    })
    contactPhone: string;

    @ApiProperty({
        type: [String],
        minItems: 1,
        maxItems: LISTING_LIMITS.photosMax,
        description:
            'Stored image URLs from POST /uploads/image?purpose=listing. Order = display order; [0] is the cover.',
    })
    // The 0 / >8 case is a dedicated 400 (`listing.error.photosRequired`) raised
    // by the service, so only the element shape is validated here.
    @IsArray()
    @ArrayUnique()
    @IsString({ each: true })
    @IsUrl({ require_tld: false, protocols: ['http', 'https'] }, { each: true })
    @MaxLength(2048, { each: true })
    photos: string[];
}
