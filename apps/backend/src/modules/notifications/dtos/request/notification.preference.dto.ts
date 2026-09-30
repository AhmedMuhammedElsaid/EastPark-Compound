import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class UpdateNotificationPreferenceDto {
    @ApiProperty()
    @IsBoolean()
    enabled: boolean;
}
