import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';

import { AllowedRoles } from 'src/common/request/decorators/request.role.decorator';

import {
    FinanceAsOfQueryDto,
    FinanceFlatsQueryDto,
} from './dtos/request/finance-query.dto';
import {
    FinanceFlatDetailDto,
    FinanceFlatPageDto,
    FinanceOwnershipListDto,
} from './dtos/response/finance.response.dto';
import { FinanceFlatsService } from './finance-flats.service';

// Finance desk: ACCOUNTANT + ADMIN (SUPER_ADMIN satisfies ADMIN in the guard).
@ApiTags('finance/flats')
@ApiBearerAuth('accessToken')
@Controller({ path: '/finance/flats', version: '1' })
export class FinanceFlatsController {
    constructor(private readonly flats: FinanceFlatsService) {}

    @Get()
    @AllowedRoles([Role.ACCOUNTANT, Role.ADMIN])
    @ApiOperation({
        summary:
            'Flats with balance, credit and arrears (cursor-paginated) [ACCOUNTANT, ADMIN]',
    })
    list(@Query() query: FinanceFlatsQueryDto): Promise<FinanceFlatPageDto> {
        return this.flats.list(query);
    }

    @Get(':id')
    @AllowedRoles([Role.ACCOUNTANT, Role.ADMIN])
    @ApiOperation({
        summary:
            'Flat totals, owner contact and open charges [ACCOUNTANT, ADMIN]',
    })
    detail(
        @Param('id') id: string,
        @Query() query: FinanceAsOfQueryDto
    ): Promise<FinanceFlatDetailDto> {
        return this.flats.detail(id, query.asOf);
    }

    @Get(':id/ownership')
    @AllowedRoles([Role.ACCOUNTANT, Role.ADMIN])
    @ApiOperation({
        summary: 'Ownership history of a flat [ACCOUNTANT, ADMIN]',
    })
    ownership(@Param('id') id: string): Promise<FinanceOwnershipListDto> {
        return this.flats.ownership(id);
    }
}
