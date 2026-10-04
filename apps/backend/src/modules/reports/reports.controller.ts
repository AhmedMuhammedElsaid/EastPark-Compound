import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';

import { PublicRoute } from 'src/common/request/decorators/request.public.decorator';
import { AllowedRoles } from 'src/common/request/decorators/request.role.decorator';
import { AuthUser } from 'src/common/request/decorators/request.user.decorator';
import { IAuthUser } from 'src/common/request/interfaces/request.interface';

import { ReportCreateDto } from './dtos/request/report.create.dto';
import { ReportQueryDto } from './dtos/request/report.query.dto';
import {
    ReportListResponseDto,
    ReportResponseDto,
} from './dtos/response/report.response.dto';
import { ReportsService } from './reports.service';

@ApiTags('reports')
@Controller({ path: '/reports', version: '1' })
export class ReportsController {
    constructor(private readonly reportsService: ReportsService) {}

    @Get()
    @PublicRoute()
    @ApiOperation({ summary: 'List official compound reports' })
    list(@Query() query: ReportQueryDto): Promise<ReportListResponseDto> {
        return this.reportsService.findAll(query);
    }

    @Get(':id')
    @PublicRoute()
    @ApiOperation({ summary: 'Get report by id' })
    findOne(@Param('id') id: string): Promise<ReportResponseDto> {
        return this.reportsService.findOne(id);
    }

    @Post()
    @AllowedRoles([Role.ADMIN])
    @ApiBearerAuth('accessToken')
    @ApiOperation({ summary: 'Create report [ADMIN]' })
    create(
        @Body() dto: ReportCreateDto,
        @AuthUser() actor: IAuthUser
    ): Promise<ReportResponseDto> {
        return this.reportsService.create(dto, actor);
    }
}
