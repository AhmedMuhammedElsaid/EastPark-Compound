import { Controller, Delete, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';

import { AllowedRoles } from 'src/common/request/decorators/request.role.decorator';
import { AuthUser } from 'src/common/request/decorators/request.user.decorator';
import { IAuthUser } from 'src/common/request/interfaces/request.interface';

import { SavedShopsService } from './saved-shops.service';

@ApiTags('shops')
@ApiBearerAuth('accessToken')
@Controller({ path: '/shops/:id/save', version: '1' })
export class SavedShopsController {
    constructor(private readonly savedShopsService: SavedShopsService) {}

    @Post()
    @AllowedRoles([Role.RESIDENT])
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Save a shop [RESIDENT]' })
    async save(@Param('id') shopId: string, @AuthUser() actor: IAuthUser): Promise<void> {
        await this.savedShopsService.saveShop(shopId, actor.userId);
    }

    @Delete()
    @AllowedRoles([Role.RESIDENT])
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Unsave a shop [RESIDENT]' })
    async unsave(@Param('id') shopId: string, @AuthUser() actor: IAuthUser): Promise<void> {
        await this.savedShopsService.unsaveShop(shopId, actor.userId);
    }
}
