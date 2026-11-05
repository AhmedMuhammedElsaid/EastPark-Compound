import {
    Body,
    Controller,
    HttpCode,
    HttpStatus,
    Param,
    Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';

import { DocResponse } from 'src/common/doc/decorators/doc.response.decorator';
import { AllowedRoles } from 'src/common/request/decorators/request.role.decorator';
import { AuthUser } from 'src/common/request/decorators/request.user.decorator';
import { IAuthUser } from 'src/common/request/interfaces/request.interface';

import {
    FinanceChargeCreateDto,
    FinanceVoidDto,
} from './dtos/request/finance-charge.dto';
import { FinanceChargeDto } from './dtos/response/finance.response.dto';
import { FinanceChargesService } from './finance-charges.service';

// Finance desk: ACCOUNTANT + ADMIN (SUPER_ADMIN satisfies ADMIN in the guard).
@ApiTags('finance/charges')
@ApiBearerAuth('accessToken')
@Controller({ path: '/finance/charges', version: '1' })
export class FinanceChargesController {
    constructor(private readonly charges: FinanceChargesService) {}

    @Post()
    @AllowedRoles([Role.ACCOUNTANT, Role.ADMIN])
    @HttpCode(HttpStatus.CREATED)
    @DocResponse({
        httpStatus: HttpStatus.CREATED,
        messageKey: 'finance.success.chargeCreated',
    })
    @ApiOperation({ summary: 'Post a charge to a flat [ACCOUNTANT, ADMIN]' })
    create(
        @Body() dto: FinanceChargeCreateDto,
        @AuthUser() actor: IAuthUser
    ): Promise<FinanceChargeDto> {
        return this.charges.create(dto, actor);
    }

    @Post(':id/void')
    @AllowedRoles([Role.ACCOUNTANT, Role.ADMIN])
    @HttpCode(HttpStatus.OK)
    @DocResponse({
        httpStatus: HttpStatus.OK,
        messageKey: 'finance.success.chargeVoided',
    })
    @ApiOperation({
        summary:
            'Void a charge with a reason. ACCOUNTANT: own entry, same Cairo day; ADMIN: any. Period must be open [ACCOUNTANT, ADMIN]',
    })
    void(
        @Param('id') id: string,
        @Body() dto: FinanceVoidDto,
        @AuthUser() actor: IAuthUser
    ): Promise<FinanceChargeDto> {
        return this.charges.void(id, dto.reason, actor);
    }
}
