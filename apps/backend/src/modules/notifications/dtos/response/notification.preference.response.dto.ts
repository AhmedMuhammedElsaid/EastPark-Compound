import { ApiProperty } from '@nestjs/swagger';
import { NotificationType } from '@prisma/client';

export class NotificationPreferenceResponseDto {
    @ApiProperty({ enum: NotificationType })
    type: NotificationType;

    @ApiProperty()
    enabled: boolean;
}
