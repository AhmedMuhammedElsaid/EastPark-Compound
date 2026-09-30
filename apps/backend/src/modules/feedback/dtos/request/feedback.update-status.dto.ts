import { ApiProperty } from '@nestjs/swagger';
import { FeedbackStatus } from '@prisma/client';
import { IsEnum, IsNotEmpty } from 'class-validator';

export class FeedbackUpdateStatusDto {
    @ApiProperty({ enum: FeedbackStatus })
    @IsEnum(FeedbackStatus)
    @IsNotEmpty()
    status: FeedbackStatus;
}
