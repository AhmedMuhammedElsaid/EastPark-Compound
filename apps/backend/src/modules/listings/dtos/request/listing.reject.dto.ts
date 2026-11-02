import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsISO8601, IsOptional, IsString, Length } from 'class-validator';

export class ListingRejectDto {
    @ApiProperty({ minLength: 3, maxLength: 500, example: 'Photos are blurry' })
    @Transform(({ value }: { value: unknown }) =>
        typeof value === 'string' ? value.trim() : value
    )
    @IsString()
    @Length(3, 500)
    reason: string;

    @ApiPropertyOptional({
        example: '2026-11-02T10:00:00.000Z',
        description:
            'updatedAt of the listing as loaded; a newer edit gives 409 listing.error.changedSinceLoaded',
    })
    @IsOptional()
    @IsISO8601()
    expectedUpdatedAt?: string;
}
