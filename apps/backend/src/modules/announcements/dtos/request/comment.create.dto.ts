import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CommentCreateDto {
    @ApiProperty({ maxLength: 1000 })
    @IsString()
    @IsNotEmpty()
    @MaxLength(1000)
    body: string;
}
