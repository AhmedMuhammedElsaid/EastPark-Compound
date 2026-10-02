import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsOptional, Matches, ValidateNested } from 'class-validator';

const HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/;

export class WorkingHoursDayDto {
    @ApiProperty({ example: '09:00', description: 'HH:mm (24h)' })
    @Matches(HH_MM, { message: 'open must be HH:mm (24h)' })
    open: string;

    @ApiProperty({ example: '22:00', description: 'HH:mm (24h)' })
    @Matches(HH_MM, { message: 'close must be HH:mm (24h)' })
    close: string;

    @ApiProperty({ example: false })
    @IsBoolean()
    closed: boolean;
}

export class WorkingHoursDto {
    @ApiPropertyOptional({ type: WorkingHoursDayDto })
    @IsOptional()
    @ValidateNested()
    @Type(() => WorkingHoursDayDto)
    mon?: WorkingHoursDayDto;

    @ApiPropertyOptional({ type: WorkingHoursDayDto })
    @IsOptional()
    @ValidateNested()
    @Type(() => WorkingHoursDayDto)
    tue?: WorkingHoursDayDto;

    @ApiPropertyOptional({ type: WorkingHoursDayDto })
    @IsOptional()
    @ValidateNested()
    @Type(() => WorkingHoursDayDto)
    wed?: WorkingHoursDayDto;

    @ApiPropertyOptional({ type: WorkingHoursDayDto })
    @IsOptional()
    @ValidateNested()
    @Type(() => WorkingHoursDayDto)
    thu?: WorkingHoursDayDto;

    @ApiPropertyOptional({ type: WorkingHoursDayDto })
    @IsOptional()
    @ValidateNested()
    @Type(() => WorkingHoursDayDto)
    fri?: WorkingHoursDayDto;

    @ApiPropertyOptional({ type: WorkingHoursDayDto })
    @IsOptional()
    @ValidateNested()
    @Type(() => WorkingHoursDayDto)
    sat?: WorkingHoursDayDto;

    @ApiPropertyOptional({ type: WorkingHoursDayDto })
    @IsOptional()
    @ValidateNested()
    @Type(() => WorkingHoursDayDto)
    sun?: WorkingHoursDayDto;
}
