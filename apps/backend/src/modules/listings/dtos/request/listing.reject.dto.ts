import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, Length } from 'class-validator';

export class ListingRejectDto {
    @ApiProperty({ minLength: 3, maxLength: 500, example: 'Photos are blurry' })
    @Transform(({ value }: { value: unknown }) =>
        typeof value === 'string' ? value.trim() : value
    )
    @IsString()
    @Length(3, 500)
    reason: string;
}
