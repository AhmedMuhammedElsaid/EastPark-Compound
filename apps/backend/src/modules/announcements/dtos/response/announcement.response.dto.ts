import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AnnouncementCategory } from '@prisma/client';

export class CommentAuthorDto {
    @ApiProperty() id: string;
    @ApiProperty() name: string;
}

export class CommentResponseDto {
    @ApiProperty() id: string;
    @ApiProperty() body: string;
    @ApiProperty() userId: string;
    @ApiProperty({ type: () => CommentAuthorDto }) user: CommentAuthorDto;
    @ApiProperty() createdAt: Date;
}

export class AnnouncementResponseDto {
    @ApiProperty() id: string;
    @ApiProperty() title: string;
    @ApiProperty() titleAr: string;
    @ApiProperty() body: string;
    @ApiProperty() bodyAr: string;
    @ApiProperty({ enum: AnnouncementCategory }) category: AnnouncementCategory;
    @ApiPropertyOptional() pdfUrl?: string | null;
    @ApiProperty() publishedAt: Date;
    @ApiProperty() createdAt: Date;
}

export class AnnouncementDetailResponseDto extends AnnouncementResponseDto {
    @ApiProperty({ type: [CommentResponseDto] }) comments: CommentResponseDto[];
}

export class AnnouncementListResponseDto {
    @ApiProperty({ type: [AnnouncementResponseDto] })
    items: AnnouncementResponseDto[];
    @ApiPropertyOptional() nextCursor?: string;
}
