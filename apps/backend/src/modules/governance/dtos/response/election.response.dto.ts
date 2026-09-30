import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ElectionVisibilityMode } from '@prisma/client';

export class CandidateResponseDto {
    @ApiProperty() id: string;
    @ApiProperty() name: string;
    @ApiProperty() nameAr: string;
    @ApiPropertyOptional() statement?: string | null;
    @ApiPropertyOptional() statementAr?: string | null;
    @ApiPropertyOptional() photoUrl?: string | null;
    @ApiPropertyOptional({ description: 'Vote count — only shown when results are visible' })
    voteCount?: number;
}

export class ElectionResponseDto {
    @ApiProperty() id: string;
    @ApiProperty() title: string;
    @ApiProperty() titleAr: string;
    @ApiPropertyOptional() description?: string | null;
    @ApiPropertyOptional() descriptionAr?: string | null;
    @ApiProperty() expiresAt: Date;
    @ApiProperty() resultsOpen: boolean;
    @ApiProperty({ enum: ElectionVisibilityMode }) visibilityMode: ElectionVisibilityMode;
    @ApiProperty() createdAt: Date;
    @ApiProperty({ type: [CandidateResponseDto] }) candidates: CandidateResponseDto[];
    @ApiPropertyOptional() myVoteCandidateId?: string | null;
}

export class ElectionListResponseDto {
    @ApiProperty({ type: [ElectionResponseDto] }) items: ElectionResponseDto[];
    @ApiPropertyOptional() nextCursor?: string;
}
