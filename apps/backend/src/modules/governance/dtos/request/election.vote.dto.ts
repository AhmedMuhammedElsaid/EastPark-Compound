import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class ElectionVoteDto {
    @ApiProperty({ description: 'Candidate ID to vote for' })
    @IsString()
    @IsNotEmpty()
    candidateId: string;
}
