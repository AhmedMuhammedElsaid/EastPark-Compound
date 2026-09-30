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

import { GovernanceQueryDto } from '../dtos/request/governance.query.dto';
import { PollCreateDto } from '../dtos/request/poll.create.dto';
import { PollVoteDto } from '../dtos/request/poll.vote.dto';
import {
    PollListResponseDto,
    PollResponseDto,
} from '../dtos/response/poll.response.dto';
import { PollsService } from '../services/polls.service';

@ApiTags('governance.polls')
@Controller({ path: '/polls', version: '1' })
export class PollsController {
    constructor(private readonly pollsService: PollsService) {}

    @Get()
    @PublicRoute()
    @ApiOperation({ summary: 'List polls' })
    list(
        @Query() query: GovernanceQueryDto,
        @AuthUser() actor: IAuthUser
    ): Promise<PollListResponseDto> {
        return this.pollsService.findAll(query, actor);
    }

    @Get(':id')
    @PublicRoute()
    @ApiOperation({ summary: 'Get poll by id' })
    findOne(
        @Param('id') id: string,
        @AuthUser() actor: IAuthUser
    ): Promise<PollResponseDto> {
        return this.pollsService.findOne(id, actor);
    }

    @Post()
    @AllowedRoles([Role.ADMIN])
    @ApiBearerAuth('accessToken')
    @ApiOperation({ summary: 'Create poll with options [ADMIN]' })
    create(@Body() dto: PollCreateDto): Promise<PollResponseDto> {
        return this.pollsService.create(dto);
    }

    @Post(':id/vote')
    @AllowedRoles([Role.RESIDENT])
    @HttpCode(HttpStatus.OK)
    @ApiBearerAuth('accessToken')
    @ApiOperation({ summary: 'Vote on poll (once per resident) [RESIDENT]' })
    vote(
        @Param('id') id: string,
        @Body() dto: PollVoteDto,
        @AuthUser() actor: IAuthUser
    ): Promise<{ message: string }> {
        return this.pollsService.vote(id, dto, actor);
    }
}
