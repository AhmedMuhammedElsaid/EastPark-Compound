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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';

import { AllowedRoles } from 'src/common/request/decorators/request.role.decorator';
import { AuthUser } from 'src/common/request/decorators/request.user.decorator';
import { IAuthUser } from 'src/common/request/interfaces/request.interface';

import { FeedbackCreateDto } from './dtos/request/feedback.create.dto';
import { FeedbackQueryDto } from './dtos/request/feedback.query.dto';
import { FeedbackReplyDto } from './dtos/request/feedback.reply.dto';
import { FeedbackUpdateStatusDto } from './dtos/request/feedback.update-status.dto';
import {
    FeedbackDetailResponseDto,
    FeedbackListResponseDto,
    FeedbackReplyResponseDto,
    FeedbackResponseDto,
} from './dtos/response/feedback.response.dto';
import { FeedbackService } from './feedback.service';

@ApiTags('feedback')
@ApiBearerAuth('accessToken')
@Controller({ path: '/feedback', version: '1' })
export class FeedbackController {
    constructor(private readonly feedbackService: FeedbackService) {}

    @Post()
    @AllowedRoles([Role.RESIDENT, Role.MERCHANT])
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Submit feedback [RESIDENT/MERCHANT]' })
    create(
        @Body() dto: FeedbackCreateDto,
        @AuthUser() actor: IAuthUser
    ): Promise<FeedbackResponseDto> {
        return this.feedbackService.create(dto, actor);
    }

    @Get()
    @AllowedRoles([Role.RESIDENT, Role.MERCHANT, Role.ADMIN])
    @ApiOperation({
        summary: 'List feedback [RESIDENT/MERCHANT=own, ADMIN=all]',
    })
    list(
        @Query() query: FeedbackQueryDto,
        @AuthUser() actor: IAuthUser
    ): Promise<FeedbackListResponseDto> {
        return this.feedbackService.findAll(query, actor);
    }

    @Get(':id')
    @AllowedRoles([Role.RESIDENT, Role.MERCHANT, Role.ADMIN])
    @ApiOperation({
        summary:
            'Get feedback detail with replies [RESIDENT/MERCHANT=own, ADMIN=all]',
    })
    findOne(
        @Param('id') id: string,
        @AuthUser() actor: IAuthUser
    ): Promise<FeedbackDetailResponseDto> {
        return this.feedbackService.findOne(id, actor);
    }

    @Post(':id/replies')
    @AllowedRoles([Role.ADMIN])
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Reply to feedback [ADMIN]' })
    addReply(
        @Param('id') id: string,
        @Body() dto: FeedbackReplyDto,
        @AuthUser() actor: IAuthUser
    ): Promise<FeedbackReplyResponseDto> {
        return this.feedbackService.addReply(id, dto, actor);
    }

    @Patch(':id/status')
    @AllowedRoles([Role.ADMIN])
    @ApiOperation({ summary: 'Update feedback status [ADMIN]' })
    updateStatus(
        @Param('id') id: string,
        @Body() dto: FeedbackUpdateStatusDto
    ): Promise<FeedbackResponseDto> {
        return this.feedbackService.updateStatus(id, dto);
    }
}
