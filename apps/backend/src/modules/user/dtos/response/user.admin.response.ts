import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Role } from '@prisma/client';

/** Team & roles list item. Never carries passwordHash, pushToken or phone. */
export class AdminUserItemDto {
    @ApiProperty() id: string;
    @ApiProperty() name: string;
    @ApiProperty() email: string;
    @ApiProperty({ enum: Role }) role: Role;
    @ApiProperty({ type: String, nullable: true }) unitNumber: string | null;
    @ApiProperty() createdAt: Date;
}

export class AdminUserListResponseDto {
    @ApiProperty({ type: [AdminUserItemDto] }) items: AdminUserItemDto[];
    @ApiPropertyOptional() nextCursor?: string;
}
