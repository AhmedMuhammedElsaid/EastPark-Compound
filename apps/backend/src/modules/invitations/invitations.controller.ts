import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';

import { AllowedRoles } from 'src/common/request/decorators/request.role.decorator';
import { AuthUser } from 'src/common/request/decorators/request.user.decorator';
import { IAuthUser } from 'src/common/request/interfaces/request.interface';

import { InvitationCreateDto } from './dtos/request/invitation.create.dto';
import { InvitationQueryDto } from './dtos/request/invitation.query.dto';
import {
    InvitationListResponseDto,
    InvitationResponseDto,
} from './dtos/response/invitation.response.dto';
import { InvitationsService } from './invitations.service';

@ApiTags('admin/invitations')
@ApiBearerAuth('accessToken')
@Controller({ path: '/admin/invitations', version: '1' })
export class InvitationsController {
    constructor(private readonly invitationsService: InvitationsService) {}

    @Post()
    @AllowedRoles([Role.ADMIN])
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Send an invitation to a merchant or admin [ADMIN]' })
    create(
        @Body() dto: InvitationCreateDto,
        @AuthUser() actor: IAuthUser,
    ): Promise<InvitationResponseDto> {
        return this.invitationsService.create(dto, actor);
    }

    @Get()
    @AllowedRoles([Role.ADMIN])
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'List all invitations (cursor-paginated) [ADMIN]' })
    findAll(@Query() query: InvitationQueryDto): Promise<InvitationListResponseDto> {
        return this.invitationsService.findAll(query);
    }
}
