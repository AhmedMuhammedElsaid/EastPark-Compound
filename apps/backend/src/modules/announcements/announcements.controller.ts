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

import { AnnouncementCreateDto } from './dtos/request/announcement.create.dto';
import { AnnouncementQueryDto } from './dtos/request/announcement.query.dto';
import { CommentCreateDto } from './dtos/request/comment.create.dto';
import {
    AnnouncementDetailResponseDto,
    AnnouncementListResponseDto,
    AnnouncementResponseDto,
    CommentResponseDto,
} from './dtos/response/announcement.response.dto';
import { AnnouncementsService } from './announcements.service';

@ApiTags('announcements')
@Controller({ path: '/announcements', version: '1' })
export class AnnouncementsController {
    constructor(private readonly announcementsService: AnnouncementsService) {}

    @Get()
    @PublicRoute()
    @ApiOperation({ summary: 'List announcements (cursor pagination)' })
    list(
        @Query() query: AnnouncementQueryDto
    ): Promise<AnnouncementListResponseDto> {
        return this.announcementsService.findAll(query);
    }

    @Get(':id')
    @PublicRoute()
    @ApiOperation({ summary: 'Get announcement with comments' })
    findOne(@Param('id') id: string): Promise<AnnouncementDetailResponseDto> {
        return this.announcementsService.findOne(id);
    }

    @Post()
    @AllowedRoles([Role.ADMIN])
    @ApiBearerAuth('accessToken')
    @ApiOperation({ summary: 'Create announcement [ADMIN]' })
    create(
        @Body() dto: AnnouncementCreateDto
    ): Promise<AnnouncementResponseDto> {
        return this.announcementsService.create(dto);
    }

    @Post(':id/comments')
    @AllowedRoles([Role.RESIDENT, Role.MERCHANT, Role.ADMIN])
    @HttpCode(HttpStatus.CREATED)
    @ApiBearerAuth('accessToken')
    @ApiOperation({
        summary: 'Add comment to announcement [RESIDENT/MERCHANT/ADMIN]',
    })
    addComment(
        @Param('id') id: string,
        @Body() dto: CommentCreateDto,
        @AuthUser() actor: IAuthUser
    ): Promise<CommentResponseDto> {
        return this.announcementsService.addComment(id, dto, actor);
    }
}
