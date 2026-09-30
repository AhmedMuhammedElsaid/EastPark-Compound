import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class PollVoteDto {
    @ApiProperty({ description: 'PollOption ID to vote for' })
    @IsString()
    @IsNotEmpty()
    optionId: string;
}
