import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsUrl, Min } from 'class-validator';

export class ShopAddPhotoDto {
    @ApiProperty({
        description:
            'Public URL of the uploaded image (from POST /uploads/image)',
    })
    @IsUrl()
    @IsNotEmpty()
    url: string;

    @ApiPropertyOptional({
        default: 0,
        description: 'Display order (lower = first)',
    })
    @IsInt()
    @Min(0)
    @IsOptional()
    order?: number;
}
