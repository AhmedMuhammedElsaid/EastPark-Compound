import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { PublicRoute } from 'src/common/request/decorators/request.public.decorator';

import { PaymentsService, PaymobWebhookPayload } from './payments.service';

@ApiTags('payments')
@Controller({ path: '/webhooks', version: '1' })
export class PaymentsController {
    constructor(private readonly paymentsService: PaymentsService) {}

    @Post('paymob')
    @PublicRoute()
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Paymob payment webhook (HMAC-SHA512 verified)' })
    async paymobWebhook(
        @Body() payload: PaymobWebhookPayload
    ): Promise<{ received: true }> {
        await this.paymentsService.handleWebhook(payload);
        return { received: true };
    }
}
