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

import { DocResponse } from 'src/common/doc/decorators/doc.response.decorator';
import { AllowedRoles } from 'src/common/request/decorators/request.role.decorator';
import { AuthUser } from 'src/common/request/decorators/request.user.decorator';
import { IAuthUser } from 'src/common/request/interfaces/request.interface';

import {
    ListingBrowseQueryDto,
    ListingMineQueryDto,
} from './dtos/request/listing.query.dto';
import { ListingUpsertDto } from './dtos/request/listing.upsert.dto';
import {
    ListingDto,
    ListingPageDto,
    MyListingDto,
    MyListingPageDto,
} from './dtos/response/listing.response.dto';
import { ListingsService } from './listings.service';

const BROWSE_ROLES = [Role.RESIDENT, Role.ADMIN, Role.SUPER_ADMIN];

@ApiTags('listings')
@ApiBearerAuth('accessToken')
@Controller({ path: '/listings', version: '1' })
export class ListingsController {
    constructor(private readonly listings: ListingsService) {}

    @Get()
    @AllowedRoles(BROWSE_ROLES)
    @ApiOperation({
        summary:
            'Browse approved, unexpired flat listings (cursor-paginated) [RESIDENT/ADMIN]',
    })
    browse(@Query() query: ListingBrowseQueryDto): Promise<ListingPageDto> {
        return this.listings.browse(query);
    }

    // Registered BEFORE `:id`, or "mine" would be read as a listing id.
    @Get('mine')
    @AllowedRoles([Role.RESIDENT])
    @ApiOperation({ summary: 'My listings, every status [RESIDENT]' })
    mine(
        @AuthUser() actor: IAuthUser,
        @Query() query: ListingMineQueryDto
    ): Promise<MyListingPageDto> {
        return this.listings.mine(actor, query);
    }

    @Get(':id')
    @AllowedRoles(BROWSE_ROLES)
    @ApiOperation({
        summary:
            'Listing detail: approved ones for everyone, the owner sees any status [RESIDENT/ADMIN]',
    })
    findOne(
        @Param('id') id: string,
        @AuthUser() actor: IAuthUser
    ): Promise<ListingDto | MyListingDto> {
        return this.listings.findOne(id, actor);
    }

    @Post()
    @AllowedRoles([Role.RESIDENT])
    @HttpCode(HttpStatus.CREATED)
    @DocResponse({
        httpStatus: HttpStatus.CREATED,
        messageKey: 'listing.success.created',
    })
    @ApiOperation({
        summary: 'Create a listing, PENDING review (5 per hour) [RESIDENT]',
    })
    create(
        @Body() dto: ListingUpsertDto,
        @AuthUser() actor: IAuthUser
    ): Promise<MyListingDto> {
        return this.listings.create(dto, actor);
    }

    @Patch(':id')
    @AllowedRoles([Role.RESIDENT])
    @HttpCode(HttpStatus.OK)
    @DocResponse({
        httpStatus: HttpStatus.OK,
        messageKey: 'listing.success.updated',
    })
    @ApiOperation({
        summary:
            'Replace a listing (back to PENDING, writes a revision) [RESIDENT owner]',
    })
    update(
        @Param('id') id: string,
        @Body() dto: ListingUpsertDto,
        @AuthUser() actor: IAuthUser
    ): Promise<MyListingDto> {
        return this.listings.update(id, dto, actor);
    }

    @Post(':id/renew')
    @AllowedRoles([Role.RESIDENT])
    @HttpCode(HttpStatus.OK)
    @DocResponse({
        httpStatus: HttpStatus.OK,
        messageKey: 'listing.success.renewed',
    })
    @ApiOperation({ summary: 'Renew an APPROVED listing for 60 days [RESIDENT owner]' })
    renew(
        @Param('id') id: string,
        @AuthUser() actor: IAuthUser
    ): Promise<MyListingDto> {
        return this.listings.renew(id, actor);
    }

    @Post(':id/close')
    @AllowedRoles([Role.RESIDENT])
    @HttpCode(HttpStatus.OK)
    @DocResponse({
        httpStatus: HttpStatus.OK,
        messageKey: 'listing.success.closed',
    })
    @ApiOperation({
        summary:
            'Mark an APPROVED listing sold (SALE) or rented (RENT) [RESIDENT owner]',
    })
    close(
        @Param('id') id: string,
        @AuthUser() actor: IAuthUser
    ): Promise<MyListingDto> {
        return this.listings.close(id, actor);
    }

    @Post(':id/withdraw')
    @AllowedRoles([Role.RESIDENT])
    @HttpCode(HttpStatus.OK)
    @DocResponse({
        httpStatus: HttpStatus.OK,
        messageKey: 'listing.success.withdrawn',
    })
    @ApiOperation({
        summary: 'Withdraw a PENDING / APPROVED / REJECTED listing [RESIDENT owner]',
    })
    withdraw(
        @Param('id') id: string,
        @AuthUser() actor: IAuthUser
    ): Promise<MyListingDto> {
        return this.listings.withdraw(id, actor);
    }
}
