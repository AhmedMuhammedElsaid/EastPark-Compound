import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ReviewUserDto {
    @ApiProperty() id: string;
    @ApiProperty() name: string;
}

export class ReviewResponseDto {
    @ApiProperty() id: string;
    @ApiProperty() rating: number;
    @ApiPropertyOptional() comment?: string | null;
    @ApiProperty({ type: ReviewUserDto }) user: ReviewUserDto;
    @ApiProperty() createdAt: Date;
}

export class ReviewListResponseDto {
    @ApiProperty({ type: [ReviewResponseDto] }) items: ReviewResponseDto[];
    @ApiPropertyOptional() nextCursor?: string;
    @ApiPropertyOptional() averageRating?: number | null;
}
