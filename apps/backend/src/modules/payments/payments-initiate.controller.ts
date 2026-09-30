import {
    Controller, HttpCode, HttpStatus, Param, Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';

import { AllowedRoles } from 'src/common/request/decorators/request.role.decorator';
import { AuthUser } from 'src/common/request/decorators/request.user.decorator';
import { IAuthUser } from 'src/common/request/interfaces/request.interface';

import { PaymentsService } from './payments.service';

@ApiTags('payments')
@ApiBearerAuth('accessToken')
@Controller({ path: '/orders', version: '1' })
export class PaymentsInitiateController {
    constructor(private readonly paymentsService: PaymentsService) {}

    @Post(':id/pay/paymob')
    @AllowedRoles([Role.RESIDENT])
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Initiate Paymob payment for an order [RESIDENT]' })
    async initiatePaymob(
        @Param('id') id: string,
        @AuthUser() actor: IAuthUser,
    ): Promise<{ paymentKey: string; iframeUrl: string }> {
        return this.paymentsService.initiatePayment(id, actor.userId);
    }
}
