import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MaritalStatus, ResidentLeadStatus } from '@prisma/client';

export class ResidentLeadResponseDto {
    @ApiProperty() id: string;
    @ApiProperty() name: string;
    @ApiProperty() email: string;
    @ApiProperty() phone: string;
    @ApiProperty() building: string;
    @ApiProperty() floor: string;
    @ApiProperty() flatNumber: string;
    @ApiPropertyOptional() parking?: string | null;
    @ApiPropertyOptional() jobTitle?: string | null;
    @ApiPropertyOptional({ enum: MaritalStatus })
    maritalStatus?: MaritalStatus | null;
    @ApiPropertyOptional() nationalId?: string | null;
    @ApiPropertyOptional() passportNumber?: string | null;
    @ApiProperty({ enum: ResidentLeadStatus }) status: ResidentLeadStatus;
    @ApiPropertyOptional() notes?: string | null;
    @ApiPropertyOptional() userId?: string | null;
    @ApiPropertyOptional({
        description:
            'Admin list only: a live account already uses this email, so approving adds the flat to it (no invitation).',
    })
    hasAccount?: boolean;
    @ApiProperty() createdAt: Date;
    @ApiProperty() updatedAt: Date;
}

export class ResidentLeadListResponseDto {
    @ApiProperty({ type: [ResidentLeadResponseDto] })
    items: ResidentLeadResponseDto[];
    @ApiPropertyOptional() nextCursor?: string;
}

/** Lead counts per status for the admin summary cards. */
export class ResidentLeadStatsResponseDto {
    @ApiProperty() PENDING: number;
    @ApiProperty() INVITED: number;
    @ApiProperty() CONVERTED: number;
    @ApiProperty() REJECTED: number;
    @ApiProperty() total: number;
}
