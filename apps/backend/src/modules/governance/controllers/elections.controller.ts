import {
    Body,
    Controller,
    Get,
    HttpCode,
    HttpStatus,
    Param,
    Post,
    Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';

import { PublicRoute } from 'src/common/request/decorators/request.public.decorator';
import { AllowedRoles } from 'src/common/request/decorators/request.role.decorator';
import { AuthUser } from 'src/common/request/decorators/request.user.decorator';
import { IAuthUser } from 'src/common/request/interfaces/request.interface';

import { CandidateCreateDto } from '../dtos/request/candidate.create.dto';
import { ElectionCreateDto } from '../dtos/request/election.create.dto';
import { ElectionVoteDto } from '../dtos/request/election.vote.dto';
import { GovernanceQueryDto } from '../dtos/request/governance.query.dto';
import {
    CandidateResponseDto,
    ElectionListResponseDto,
    ElectionResponseDto,
} from '../dtos/response/election.response.dto';
import { ElectionsService } from '../services/elections.service';

@ApiTags('governance.elections')
@Controller({ path: '/elections', version: '1' })
export class ElectionsController {
    constructor(private readonly electionsService: ElectionsService) {}

    @Get()
    @PublicRoute()
    @ApiOperation({ summary: 'List elections' })
    list(
        @Query() query: GovernanceQueryDto,
        @AuthUser() actor: IAuthUser
    ): Promise<ElectionListResponseDto> {
        return this.electionsService.findAll(query, actor);
    }

    @Get(':id')
    @PublicRoute()
    @ApiOperation({ summary: 'Get election by id' })
    findOne(
        @Param('id') id: string,
        @AuthUser() actor: IAuthUser
    ): Promise<ElectionResponseDto> {
        return this.electionsService.findOne(id, actor);
    }

    @Post()
    @AllowedRoles([Role.ADMIN])
    @ApiBearerAuth('accessToken')
    @ApiOperation({ summary: 'Create election [ADMIN]' })
    create(@Body() dto: ElectionCreateDto): Promise<ElectionResponseDto> {
        return this.electionsService.create(dto);
    }

    @Post(':id/candidates')
    @AllowedRoles([Role.ADMIN])
    @HttpCode(HttpStatus.CREATED)
    @ApiBearerAuth('accessToken')
    @ApiOperation({ summary: 'Add candidate to election [ADMIN]' })
    addCandidate(
        @Param('id') id: string,
        @Body() dto: CandidateCreateDto
    ): Promise<CandidateResponseDto> {
        return this.electionsService.addCandidate(id, dto);
    }

    @Post(':id/vote')
    @AllowedRoles([Role.RESIDENT])
    @HttpCode(HttpStatus.OK)
    @ApiBearerAuth('accessToken')
    @ApiOperation({
        summary: 'Vote for candidate (once per resident) [RESIDENT]',
    })
    vote(
        @Param('id') id: string,
        @Body() dto: ElectionVoteDto,
        @AuthUser() actor: IAuthUser
    ): Promise<{ message: string }> {
        return this.electionsService.vote(id, dto, actor);
    }
}
