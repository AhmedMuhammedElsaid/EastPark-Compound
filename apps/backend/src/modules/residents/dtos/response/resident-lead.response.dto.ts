import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ResidentLeadStatus } from '@prisma/client';

export class ResidentLeadResponseDto {
    @ApiProperty() id: string;
    @ApiProperty() name: string;
    @ApiProperty() email: string;
    @ApiProperty() phone: string;
    @ApiProperty() building: string;
    @ApiProperty() floor: string;
    @ApiProperty() flatNumber: string;
    @ApiPropertyOptional() parking?: string | null;
    @ApiProperty({ enum: ResidentLeadStatus }) status: ResidentLeadStatus;
    @ApiPropertyOptional() notes?: string | null;
    @ApiPropertyOptional() userId?: string | null;
    @ApiProperty() createdAt: Date;
    @ApiProperty() updatedAt: Date;
}

export class ResidentLeadListResponseDto {
    @ApiProperty({ type: [ResidentLeadResponseDto] })
    items: ResidentLeadResponseDto[];
    @ApiPropertyOptional() nextCursor?: string;
}
