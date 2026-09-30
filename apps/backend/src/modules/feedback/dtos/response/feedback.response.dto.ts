import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FeedbackCategory, FeedbackStatus } from '@prisma/client';

export class FeedbackReplyResponseDto {
    @ApiProperty() id: string;
    @ApiProperty() body: string;
    @ApiProperty() authorId: string;
    @ApiProperty() createdAt: Date;
}

export class FeedbackResponseDto {
    @ApiProperty() id: string;
    @ApiProperty({ enum: FeedbackCategory }) category: FeedbackCategory;
    @ApiProperty() body: string;
    @ApiProperty() isAnonymous: boolean;
    @ApiProperty({ enum: FeedbackStatus }) status: FeedbackStatus;
    @ApiProperty({ type: [String] }) attachments: string[];
    /** Null when anonymous and viewed by non-admin */
    @ApiPropertyOptional() userId?: string | null;
    @ApiProperty() createdAt: Date;
    @ApiProperty() updatedAt: Date;
}

export class FeedbackDetailResponseDto extends FeedbackResponseDto {
    @ApiProperty({ type: [FeedbackReplyResponseDto] })
    replies: FeedbackReplyResponseDto[];
}

export class FeedbackListResponseDto {
    @ApiProperty({ type: [FeedbackResponseDto] }) items: FeedbackResponseDto[];
    @ApiPropertyOptional() nextCursor?: string;
}
