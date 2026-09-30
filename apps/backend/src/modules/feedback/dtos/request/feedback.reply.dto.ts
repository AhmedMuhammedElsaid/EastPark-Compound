import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class FeedbackReplyDto {
    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    body: string;
}
