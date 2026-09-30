import {
    Body,
    Controller,
    Get,
    HttpCode,
    HttpStatus,
    Param,
    ParseEnumPipe,
    Patch,
    Put,
    Query,
} from '@nestjs/common';
import {
    ApiBearerAuth,
    ApiOperation,
    ApiParam,
    ApiTags,
} from '@nestjs/swagger';
import { NotificationType, Role } from '@prisma/client';

import { AllowedRoles } from 'src/common/request/decorators/request.role.decorator';
import { AuthUser } from 'src/common/request/decorators/request.user.decorator';
import { IAuthUser } from 'src/common/request/interfaces/request.interface';

import { UpdateNotificationPreferenceDto } from './dtos/request/notification.preference.dto';
import { NotificationPreferenceResponseDto } from './dtos/response/notification.preference.response.dto';
import { NotificationQueryDto } from './dtos/request/notification.query.dto';
import { NotificationListResponseDto } from './dtos/response/notification.response.dto';
import { NotificationsService } from './notifications.service';

@ApiTags('notifications')
@ApiBearerAuth('accessToken')
@Controller({ path: '/notifications', version: '1' })
export class NotificationsController {
    constructor(private readonly notificationsService: NotificationsService) {}

    @Get()
    @AllowedRoles([Role.RESIDENT, Role.MERCHANT, Role.ADMIN])
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Get my in-app notification feed (cursor-paginated)',
    })
    async findAll(
        @Query() query: NotificationQueryDto,
        @AuthUser() actor: IAuthUser
    ): Promise<NotificationListResponseDto> {
        return this.notificationsService.findAll(actor, query);
    }

    @Patch('read-all')
    @AllowedRoles([Role.RESIDENT, Role.MERCHANT, Role.ADMIN])
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Mark all notifications as read' })
    async markAllRead(
        @AuthUser() actor: IAuthUser
    ): Promise<{ count: number }> {
        return this.notificationsService.markAllRead(actor);
    }

    @Get('preferences')
    @AllowedRoles([Role.RESIDENT, Role.MERCHANT, Role.ADMIN])
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Get my notification preferences' })
    async getPreferences(
        @AuthUser() actor: IAuthUser
    ): Promise<NotificationPreferenceResponseDto[]> {
        return this.notificationsService.getPreferences(actor.userId);
    }

    @Put('preferences/:type')
    @AllowedRoles([Role.RESIDENT, Role.MERCHANT, Role.ADMIN])
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Update a notification preference' })
    @ApiParam({
        name: 'type',
        enum: NotificationType,
        enumName: 'NotificationType',
    })
    async updatePreference(
        @Param('type', new ParseEnumPipe(NotificationType))
        type: NotificationType,
        @Body() dto: UpdateNotificationPreferenceDto,
        @AuthUser() actor: IAuthUser
    ): Promise<NotificationPreferenceResponseDto> {
        return this.notificationsService.updatePreference(
            actor.userId,
            type,
            dto.enabled
        );
    }

    @Patch(':id/read')
    @AllowedRoles([Role.RESIDENT, Role.MERCHANT, Role.ADMIN])
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Mark a single notification as read' })
    async markRead(
        @Param('id') id: string,
        @AuthUser() actor: IAuthUser
    ): Promise<void> {
        await this.notificationsService.markRead(id, actor);
    }
}
