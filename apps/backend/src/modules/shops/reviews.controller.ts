import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';

import { PublicRoute } from 'src/common/request/decorators/request.public.decorator';
import { AllowedRoles } from 'src/common/request/decorators/request.role.decorator';
import { AuthUser } from 'src/common/request/decorators/request.user.decorator';
import { IAuthUser } from 'src/common/request/interfaces/request.interface';

import { ReviewCreateDto } from './dtos/request/review.create.dto';
import { ReviewQueryDto } from './dtos/request/review.query.dto';
import { ReviewListResponseDto, ReviewResponseDto } from './dtos/response/review.response.dto';
import { ReviewsService } from './reviews.service';

@ApiTags('shops')
@Controller({ path: '/shops/:shopId/reviews', version: '1' })
export class ReviewsController {
    constructor(private readonly reviewsService: ReviewsService) {}

    @Get()
    @PublicRoute()
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'List reviews for a shop (public)' })
    findAll(
        @Param('shopId') shopId: string,
        @Query() query: ReviewQueryDto,
    ): Promise<ReviewListResponseDto> {
        return this.reviewsService.findAll(shopId, query);
    }

    @Post()
    @ApiBearerAuth('accessToken')
    @AllowedRoles([Role.RESIDENT])
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Create or update my review for a shop [RESIDENT]' })
    upsert(
        @Param('shopId') shopId: string,
        @Body() dto: ReviewCreateDto,
        @AuthUser() actor: IAuthUser,
    ): Promise<ReviewResponseDto> {
        return this.reviewsService.upsert(shopId, actor.userId, dto);
    }

    @Delete()
    @ApiBearerAuth('accessToken')
    @AllowedRoles([Role.RESIDENT])
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Delete my review for a shop [RESIDENT]' })
    async remove(
        @Param('shopId') shopId: string,
        @AuthUser() actor: IAuthUser,
    ): Promise<void> {
        await this.reviewsService.remove(shopId, actor.userId);
    }
}
