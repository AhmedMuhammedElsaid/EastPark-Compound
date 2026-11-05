import {
    Body,
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

import { ResidentLeadUnitUpdateDto } from './dtos/request/resident-lead.unit.update.dto';
import { ResidentLeadQueryDto } from './dtos/request/resident-lead.query.dto';
import {
    ResidentLeadListResponseDto,
    ResidentLeadResponseDto,
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

    @Patch('leads/:id')
    @AllowedRoles([Role.ADMIN])
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary:
            'Correct the unit of an open (PENDING/INVITED) lead [ADMIN] (400 unknown flat, 409 reserved or not editable)',
    })
    @ApiOkResponse({ type: ResidentLeadResponseDto })
    updateUnit(
        @Param('id') id: string,
        @Body() dto: ResidentLeadUnitUpdateDto,
        @AuthUser() actor: IAuthUser,
    ): Promise<ResidentLeadResponseDto> {
        return this.residentsService.updateUnit(id, dto, actor);
    }

    @Patch('leads/:id/reject')
    @AllowedRoles([Role.ADMIN])
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Reject a resident lead [ADMIN]' })
    reject(
        @Param('id') id: string,
        @AuthUser() actor: IAuthUser,
    ): Promise<{ message: string }> {
        return this.residentsService.reject(id, actor);
    }
}
