import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { PublicRoute } from 'src/common/request/decorators/request.public.decorator';

import { SupportIssueCreateDto } from './dtos/request/support-issue.create.dto';
import { SupportService } from './support.service';

@ApiTags('support')
@Controller({ path: '/support', version: '1' })
export class SupportController {
    constructor(private readonly supportService: SupportService) {}

    @Post('issues')
    @PublicRoute()
    @Throttle({ default: { limit: 3, ttl: 60000 } })
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Submit an app support issue (public)' })
    async createIssue(@Body() dto: SupportIssueCreateDto): Promise<void> {
        await this.supportService.createIssue(dto);
    }
}