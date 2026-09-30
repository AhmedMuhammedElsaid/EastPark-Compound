import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUrl } from 'class-validator';

export class CandidateCreateDto {
    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    name: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    nameAr: string;

    @ApiPropertyOptional()
    @IsString()
    @IsOptional()
    statement?: string;

    @ApiPropertyOptional()
    @IsString()
    @IsOptional()
    statementAr?: string;

    @ApiPropertyOptional({ description: 'Photo URL from /uploads/image' })
    @IsUrl()
    @IsOptional()
    photoUrl?: string;
}
