import { Controller, Get, HttpCode, HttpStatus, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';

import { AllowedRoles } from 'src/common/request/decorators/request.role.decorator';
import { AuthUser } from 'src/common/request/decorators/request.user.decorator';
import { IAuthUser } from 'src/common/request/interfaces/request.interface';
import { SavedShopQueryDto } from 'src/modules/shops/dtos/request/saved-shop.query.dto';
import { SavedShopListResponseDto } from 'src/modules/shops/dtos/response/saved-shop.response.dto';
import { SavedShopsService } from 'src/modules/shops/saved-shops.service';

@ApiTags('users')
@ApiBearerAuth('accessToken')
@Controller({ path: '/users/me/saved-shops', version: '1' })
export class UserSavedShopsController {
    constructor(private readonly savedShopsService: SavedShopsService) {}

    @Get()
    @AllowedRoles([Role.RESIDENT])
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Get my saved shops [RESIDENT]' })
    findAll(
        @AuthUser() actor: IAuthUser,
        @Query() query: SavedShopQueryDto,
    ): Promise<SavedShopListResponseDto> {
        return this.savedShopsService.findSavedShops(actor.userId, query);
    }
}
