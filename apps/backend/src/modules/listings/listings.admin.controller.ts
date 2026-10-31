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

import { DocResponse } from 'src/common/doc/decorators/doc.response.decorator';
import { AllowedRoles } from 'src/common/request/decorators/request.role.decorator';
import { AuthUser } from 'src/common/request/decorators/request.user.decorator';
import { IAuthUser } from 'src/common/request/interfaces/request.interface';

import { ListingRejectDto } from './dtos/request/listing.reject.dto';
import {
    ListingAdminQueryDto,
    ListingRevisionsQueryDto,
} from './dtos/request/listing.query.dto';
import {
    AdminListingDto,
    AdminListingPageDto,
    ListingRevisionPageDto,
    ListingStatsDto,
} from './dtos/response/listing.response.dto';
import { ListingsAdminService } from './listings.admin.service';

// SUPER_ADMIN satisfies ADMIN in the roles guard.
@ApiTags('admin/listings')
@ApiBearerAuth('accessToken')
@Controller({ path: '/admin/listings', version: '1' })
export class ListingsAdminController {
    constructor(private readonly listings: ListingsAdminService) {}

    @Get()
    @AllowedRoles([Role.ADMIN])
    @ApiOperation({ summary: 'List flat listings (cursor-paginated) [ADMIN]' })
    findAll(@Query() query: ListingAdminQueryDto): Promise<AdminListingPageDto> {
        return this.listings.findAll(query);
    }

    // `stats` is a static segment: keep it above every `:id` route.
    @Get('stats')
    @AllowedRoles([Role.ADMIN])
    @ApiOperation({ summary: 'Listing counts per status [ADMIN]' })
    stats(): Promise<ListingStatsDto> {
        return this.listings.stats();
    }

    @Get(':id')
    @AllowedRoles([Role.ADMIN])
    @ApiOperation({ summary: 'Listing detail with owner contact [ADMIN]' })
    findOne(@Param('id') id: string): Promise<AdminListingDto> {
        return this.listings.findOne(id);
    }

    @Get(':id/revisions')
    @AllowedRoles([Role.ADMIN])
    @ApiOperation({ summary: 'Edit history of a listing, newest first [ADMIN]' })
    revisions(
        @Param('id') id: string,
        @Query() query: ListingRevisionsQueryDto
    ): Promise<ListingRevisionPageDto> {
        return this.listings.revisions(id, query);
    }

    @Post(':id/approve')
    @AllowedRoles([Role.ADMIN])
    @HttpCode(HttpStatus.OK)
    @DocResponse({
        httpStatus: HttpStatus.OK,
        messageKey: 'listing.success.approved',
    })
    @ApiOperation({ summary: 'Approve a PENDING listing [ADMIN]' })
    approve(
        @Param('id') id: string,
        @AuthUser() actor: IAuthUser
    ): Promise<AdminListingDto> {
        return this.listings.approve(id, actor);
    }

    @Post(':id/reject')
    @AllowedRoles([Role.ADMIN])
    @HttpCode(HttpStatus.OK)
    @DocResponse({
        httpStatus: HttpStatus.OK,
        messageKey: 'listing.success.rejected',
    })
    @ApiOperation({
        summary: 'Reject a PENDING listing or take down an APPROVED one [ADMIN]',
    })
    reject(
        @Param('id') id: string,
        @Body() dto: ListingRejectDto,
        @AuthUser() actor: IAuthUser
    ): Promise<AdminListingDto> {
        return this.listings.reject(id, dto.reason, actor);
    }
}
