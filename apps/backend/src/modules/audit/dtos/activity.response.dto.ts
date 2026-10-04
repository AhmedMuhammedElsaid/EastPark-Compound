import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Role } from '@prisma/client';

export class ActivityActorDto {
    @ApiProperty() id: string;
    @ApiProperty() name: string;
    @ApiProperty() email: string;
    @ApiProperty({ enum: Role }) role: Role;
}

export class ActivityItemDto {
    @ApiProperty() id: string;
    @ApiProperty({ example: 'LEAD_APPROVED' }) action: string;
    @ApiProperty({ example: 'ResidentLead' }) entity: string;
    @ApiProperty({ type: String, nullable: true }) entityId: string | null;
    @ApiProperty({
        type: Object,
        nullable: true,
        example: { label: 'Sara Ali — B2/3/12', email: 'sara@example.com' },
    })
    meta: Record<string, unknown> | null;
    @ApiProperty() createdAt: Date;
    @ApiProperty({ type: ActivityActorDto }) actor: ActivityActorDto;
}

export class ActivityListResponseDto {
    @ApiProperty({ type: [ActivityItemDto] }) items: ActivityItemDto[];
    @ApiPropertyOptional() nextCursor?: string;
}
