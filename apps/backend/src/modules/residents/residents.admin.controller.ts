import {
    Controller,
    Get,
    HttpCode,
    HttpStatus,
    Param,
    Patch,
    Post,
    Query,
} from '@nestjs/common';
import {
    ApiBearerAuth,
    ApiOkResponse,
    ApiOperation,
    ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';

import { AllowedRoles } from 'src/common/request/decorators/request.role.decorator';
import { AuthUser } from 'src/common/request/decorators/request.user.decorator';
import { IAuthUser } from 'src/common/request/interfaces/request.interface';

import { ResidentLeadQueryDto } from './dtos/request/resident-lead.query.dto';
import {
    ResidentLeadListResponseDto,
    ResidentLeadStatsResponseDto,
} from './dtos/response/resident-lead.response.dto';
import { ResidentsService } from './residents.service';

@ApiTags('admin/residents')
@ApiBearerAuth('accessToken')
@Controller({ path: '/admin/residents', version: '1' })
export class ResidentsAdminController {
    constructor(private readonly residentsService: ResidentsService) {}

    @Get('leads')
    @AllowedRoles([Role.ADMIN])
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'List resident leads (cursor-paginated) [ADMIN]' })
    findAll(
        @Query() query: ResidentLeadQueryDto,
    ): Promise<ResidentLeadListResponseDto> {
        return this.residentsService.findAll(query);
    }

    @Get('leads/stats')
    @AllowedRoles([Role.ADMIN])
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Resident lead counts per status [ADMIN]' })
    @ApiOkResponse({ type: ResidentLeadStatsResponseDto })
    stats(): Promise<ResidentLeadStatsResponseDto> {
        return this.residentsService.stats();
    }

    @Post('leads/:id/invite')
    @AllowedRoles([Role.ADMIN])
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Invite a resident lead to register [ADMIN]' })
    invite(
        @Param('id') id: string,
        @AuthUser() actor: IAuthUser,
    ): Promise<{ message: string }> {
        return this.residentsService.invite(id, actor);
    }

    @Patch('leads/:id/reject')
    @AllowedRoles([Role.ADMIN])
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Reject a resident lead [ADMIN]' })
    reject(@Param('id') id: string): Promise<{ message: string }> {
        return this.residentsService.reject(id);
    }
}
