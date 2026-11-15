import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';

import { AllowedRoles } from 'src/common/request/decorators/request.role.decorator';

import { FinanceDashboardQueryDto } from './dtos/request/finance-query.dto';
import { FinanceDashboardDto } from './dtos/response/finance-dashboard.response.dto';
import { FinanceDashboardService } from './finance-dashboard.service';

// Finance desk: ACCOUNTANT + ADMIN (SUPER_ADMIN satisfies ADMIN in the guard).
// Nothing here is published to residents (slice 9 rule 4).
@ApiTags('finance')
@ApiBearerAuth('accessToken')
@Controller({ path: '/finance/dashboard', version: '1' })
export class FinanceDashboardController {
    constructor(private readonly dashboard: FinanceDashboardService) {}

    @Get()
    @AllowedRoles([Role.ACCOUNTANT, Role.ADMIN])
    @ApiOperation({
        summary:
            'Finance dashboard figures as of a Cairo date (money as decimal strings) [ACCOUNTANT, ADMIN]',
    })
    get(
        @Query() query: FinanceDashboardQueryDto
    ): Promise<FinanceDashboardDto> {
        return this.dashboard.dashboard(query);
    }
}
