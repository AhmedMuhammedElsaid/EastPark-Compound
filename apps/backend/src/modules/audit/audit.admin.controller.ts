import { Controller, Get, HttpCode, HttpStatus, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';

import { AllowedRoles } from 'src/common/request/decorators/request.role.decorator';

import { AuditService } from './audit.service';
import { ActivityQueryDto } from './dtos/activity.query.dto';
import { ActivityListResponseDto } from './dtos/activity.response.dto';

@ApiTags('admin.activity')
@ApiBearerAuth('accessToken')
@Controller({ path: '/admin/activity', version: '1' })
export class AuditAdminController {
    constructor(private readonly auditService: AuditService) {}

    @Get()
    @AllowedRoles([Role.SUPER_ADMIN])
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Admin activity log, newest first [SUPER_ADMIN]' })
    list(@Query() query: ActivityQueryDto): Promise<ActivityListResponseDto> {
        return this.auditService.listActivity(query);
    }
}
