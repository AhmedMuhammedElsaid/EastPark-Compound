import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { PublicRoute } from 'src/common/request/decorators/request.public.decorator';

import { ResidentLeadCreateDto } from './dtos/request/resident-lead.create.dto';
import { ResidentLeadResponseDto } from './dtos/response/resident-lead.response.dto';
import { ResidentsService } from './residents.service';

@ApiTags('residents')
@Controller({ path: '/residents', version: '1' })
export class ResidentsController {
    constructor(private readonly residentsService: ResidentsService) {}

    @Post('leads')
    @PublicRoute()
    @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 req/min/IP — public unauthenticated write
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Submit a resident lead (public)' })
    create(
        @Body() dto: ResidentLeadCreateDto
    ): Promise<ResidentLeadResponseDto> {
        return this.residentsService.create(dto);
    }
}
