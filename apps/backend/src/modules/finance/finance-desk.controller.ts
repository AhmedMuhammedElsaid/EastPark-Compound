import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';

import { AllowedRoles } from 'src/common/request/decorators/request.role.decorator';

import {
    FinanceAuditQueryDto,
    FinancePeriodsQueryDto,
} from './dtos/request/finance-query.dto';
import {
    FinanceAuditPageDto,
    FinancePeriodListDto,
    FinanceSettingListDto,
} from './dtos/response/finance.response.dto';
import { FinanceDeskService } from './finance-desk.service';

// Finance desk reads: ACCOUNTANT + ADMIN (SUPER_ADMIN satisfies ADMIN). The
// writes (close/reopen, settings PUT) are ADMIN / SUPER_ADMIN and arrive later.
@ApiTags('finance')
@ApiBearerAuth('accessToken')
@Controller({ path: '/finance', version: '1' })
export class FinanceDeskController {
    constructor(private readonly desk: FinanceDeskService) {}

    @Get('audit')
    @AllowedRoles([Role.ACCOUNTANT, Role.ADMIN])
    @ApiOperation({
        summary:
            'Finance audit trail, newest first (cursor-paginated) [ACCOUNTANT, ADMIN]',
    })
    audit(@Query() query: FinanceAuditQueryDto): Promise<FinanceAuditPageDto> {
        return this.desk.audit(query);
    }

    @Get('periods')
    @AllowedRoles([Role.ACCOUNTANT, Role.ADMIN])
    @ApiOperation({
        summary: 'Fiscal period status per month [ACCOUNTANT, ADMIN]',
    })
    periods(
        @Query() query: FinancePeriodsQueryDto
    ): Promise<FinancePeriodListDto> {
        return this.desk.periods(query);
    }

    @Get('settings')
    @AllowedRoles([Role.ACCOUNTANT, Role.ADMIN])
    @ApiOperation({ summary: 'Finance settings [ACCOUNTANT, ADMIN]' })
    settings(): Promise<FinanceSettingListDto> {
        return this.desk.settings();
    }
}
