import { Controller, Get, VERSION_NEUTRAL } from '@nestjs/common';

import { PublicRoute } from 'src/common/request/decorators/request.public.decorator';

@Controller({
    version: VERSION_NEUTRAL,
    path: '/',
})
export class RootController {
    @Get()
    @PublicRoute()
    public getStatus() {
        return {
            service: 'EastPark API',
            status: 'ok',
            health: '/health',
        };
    }
}