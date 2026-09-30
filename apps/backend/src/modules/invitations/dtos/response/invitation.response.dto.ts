import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Role } from '@prisma/client';

export class InvitationResponseDto {
    @ApiProperty() id: string;
    @ApiProperty() email: string;
    @ApiProperty({ enum: Role }) role: Role;
    @ApiProperty() expiresAt: Date;
    @ApiPropertyOptional() usedAt?: Date | null;
    @ApiProperty() createdAt: Date;
    // token is NEVER exposed
}

export class InvitationListResponseDto {
    @ApiProperty({ type: [InvitationResponseDto] }) items: InvitationResponseDto[];
    @ApiPropertyOptional() nextCursor?: string;
}
