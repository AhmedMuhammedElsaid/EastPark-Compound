import { ApiProperty } from '@nestjs/swagger';

export class ReportResponseDto {
    @ApiProperty() id: string;
    @ApiProperty() title: string;
    @ApiProperty() titleAr: string;
    @ApiProperty() pdfUrl: string;
    @ApiProperty() publishedAt: Date;
    @ApiProperty() createdAt: Date;
}

export class ReportListResponseDto {
    @ApiProperty({ type: [ReportResponseDto] }) items: ReportResponseDto[];
    @ApiProperty() nextCursor?: string;
}
