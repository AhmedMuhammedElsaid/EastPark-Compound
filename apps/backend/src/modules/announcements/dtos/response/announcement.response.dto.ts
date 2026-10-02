import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AnnouncementCategory } from '@prisma/client';

export class CommentAuthorDto {
    /** Only present for the comment owner and admins */
    @ApiPropertyOptional() id?: string;
    /** First name only for guests; full name for authenticated users */
    @ApiProperty() name: string;
}

export class CommentResponseDto {
    @ApiProperty() id: string;
    @ApiProperty() body: string;
    /** Only present for the comment owner and admins */
    @ApiPropertyOptional() userId?: string;
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
