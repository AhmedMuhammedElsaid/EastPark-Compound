import {
    Body,
    Controller,
    Delete,
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

import { PublicRoute } from 'src/common/request/decorators/request.public.decorator';
import { AllowedRoles } from 'src/common/request/decorators/request.role.decorator';
import { AuthUser } from 'src/common/request/decorators/request.user.decorator';
import { IAuthUser } from 'src/common/request/interfaces/request.interface';

import { ShopAddPhotoDto } from './dtos/request/shop.add-photo.dto';
import { ShopCreateDto } from './dtos/request/shop.create.dto';
import { ShopQueryDto } from './dtos/request/shop.query.dto';
import { ShopUpdateDto } from './dtos/request/shop.update.dto';
import {
    ShopListResponseDto,
    ShopResponseDto,
} from './dtos/response/shop.response.dto';
import { ShopsService } from './shops.service';

@ApiTags('shops')
@Controller({ path: '/shops', version: '1' })
export class ShopsController {
    constructor(private readonly shopsService: ShopsService) {}

    // ── Public ────────────────────────────────────────────────────────────────

    @Get()
    @PublicRoute()
    @ApiOperation({ summary: 'List shops (cursor pagination)' })
    list(@Query() query: ShopQueryDto): Promise<ShopListResponseDto> {
        return this.shopsService.findAll(query);
    }

    @Get(':id')
    @PublicRoute()
    @ApiOperation({ summary: 'Get shop by id' })
    findOne(@Param('id') id: string): Promise<ShopResponseDto> {
        return this.shopsService.findOne(id);
    }

    // ── Admin-only ────────────────────────────────────────────────────────────

    @Post()
    @AllowedRoles([Role.ADMIN])
    @ApiBearerAuth('accessToken')
    @ApiOperation({ summary: 'Create shop [ADMIN]' })
    create(@Body() dto: ShopCreateDto): Promise<ShopResponseDto> {
        return this.shopsService.create(dto);
    }

    @Delete(':id')
    @AllowedRoles([Role.ADMIN])
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiBearerAuth('accessToken')
    @ApiOperation({ summary: 'Delete shop [ADMIN]' })
    remove(@Param('id') id: string): Promise<void> {
        return this.shopsService.remove(id);
    }

    // ── Merchant + Admin ──────────────────────────────────────────────────────

    @Patch(':id')
    @AllowedRoles([Role.MERCHANT, Role.ADMIN])
    @ApiBearerAuth('accessToken')
    @ApiOperation({ summary: 'Update shop [MERCHANT(own)/ADMIN]' })
    update(
        @Param('id') id: string,
        @Body() dto: ShopUpdateDto,
        @AuthUser() actor: IAuthUser
    ): Promise<ShopResponseDto> {
        return this.shopsService.update(id, dto, actor);
    }

    /** Photo URL must be obtained first via POST /uploads/image */
    @Post(':id/photos')
    @AllowedRoles([Role.MERCHANT, Role.ADMIN])
    @ApiBearerAuth('accessToken')
    @ApiOperation({
        summary: 'Add photo to shop (URL from /uploads/image) [MERCHANT(own)/ADMIN]',
    })
    addPhoto(
        @Param('id') id: string,
        @Body() dto: ShopAddPhotoDto,
        @AuthUser() actor: IAuthUser
    ): Promise<ShopResponseDto> {
        return this.shopsService.addPhoto(id, dto.url, dto.order ?? 0, actor);
    }

    @Delete(':id/photos/:photoId')
    @AllowedRoles([Role.MERCHANT, Role.ADMIN])
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiBearerAuth('accessToken')
    @ApiOperation({ summary: 'Delete shop photo [MERCHANT(own)/ADMIN]' })
    removePhoto(
        @Param('id') id: string,
        @Param('photoId') photoId: string,
        @AuthUser() actor: IAuthUser
    ): Promise<void> {
        return this.shopsService.removePhoto(id, photoId, actor);
    }
}
