import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
    ArrayMinSize,
    IsArray,
    IsDate,
    IsNotEmpty,
    IsString,
    ValidateNested,
} from 'class-validator';

export class PollOptionDto {
    @ApiProperty({ example: 'Yes' })
    @IsString()
    @IsNotEmpty()
    label: string;

    @ApiProperty({ example: 'نعم' })
    @IsString()
    @IsNotEmpty()
    labelAr: string;
}

export class PollCreateDto {
    @ApiProperty({ example: 'Do you support the new parking rules?' })
    @IsString()
    @IsNotEmpty()
    question: string;

    @ApiProperty({ example: 'هل تدعم قواعد وقوف السيارات الجديدة؟' })
    @IsString()
    @IsNotEmpty()
    questionAr: string;

    @ApiProperty({ description: 'Poll expiry ISO 8601 date' })
    @Type(() => Date)
    @IsDate()
    expiresAt: Date;

    @ApiProperty({ type: [PollOptionDto], minItems: 2 })
    @IsArray()
    @ArrayMinSize(2)
    @ValidateNested({ each: true })
    @Type(() => PollOptionDto)
    options: PollOptionDto[];
}
