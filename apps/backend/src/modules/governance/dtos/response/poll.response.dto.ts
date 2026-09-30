import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PollOptionResponseDto {
    @ApiProperty() id: string;
    @ApiProperty() label: string;
    @ApiProperty() labelAr: string;
    @ApiPropertyOptional({
        description: 'Vote count — only shown when poll has expired',
    })
    voteCount?: number;
}

export class PollResponseDto {
    @ApiProperty() id: string;
    @ApiProperty() question: string;
    @ApiProperty() questionAr: string;
    @ApiProperty() expiresAt: Date;
    @ApiProperty() createdAt: Date;
    @ApiProperty({ type: [PollOptionResponseDto] })
    options: PollOptionResponseDto[];
    @ApiPropertyOptional({
        description: 'Your voted option ID (authenticated users)',
    })
    myVoteOptionId?: string | null;
}

export class PollListResponseDto {
    @ApiProperty({ type: [PollResponseDto] }) items: PollResponseDto[];
    @ApiPropertyOptional() nextCursor?: string;
}
