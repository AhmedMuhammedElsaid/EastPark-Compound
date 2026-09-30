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

import { ProductCreateDto } from './dtos/request/product.create.dto';
import { ProductQueryDto } from './dtos/request/product.query.dto';
import { ProductUpdateDto } from './dtos/request/product.update.dto';
import {
    ProductListResponseDto,
    ProductResponseDto,
} from './dtos/response/product.response.dto';
import { ProductsService } from './products.service';

@ApiTags('products')
@Controller({ path: '/shops/:shopId/products', version: '1' })
export class ProductsController {
    constructor(private readonly productsService: ProductsService) {}

    @Get()
    @PublicRoute()
    @ApiOperation({ summary: 'List products for a shop' })
    list(
        @Param('shopId') shopId: string,
        @Query() query: ProductQueryDto
    ): Promise<ProductListResponseDto> {
        return this.productsService.findAll(shopId, query);
    }

    @Get(':id')
    @PublicRoute()
    @ApiOperation({ summary: 'Get product by id' })
    findOne(
        @Param('shopId') shopId: string,
        @Param('id') id: string
    ): Promise<ProductResponseDto> {
        return this.productsService.findOne(shopId, id);
    }

    @Post()
    @AllowedRoles([Role.MERCHANT, Role.ADMIN])
    @ApiBearerAuth('accessToken')
    @ApiOperation({ summary: 'Create product [MERCHANT(own shop)/ADMIN]' })
    create(
        @Param('shopId') shopId: string,
        @Body() dto: ProductCreateDto,
        @AuthUser() actor: IAuthUser
    ): Promise<ProductResponseDto> {
        return this.productsService.create(shopId, dto, actor);
    }

    @Patch(':id')
    @AllowedRoles([Role.MERCHANT, Role.ADMIN])
    @ApiBearerAuth('accessToken')
    @ApiOperation({ summary: 'Update product [MERCHANT(own shop)/ADMIN]' })
    update(
        @Param('shopId') shopId: string,
        @Param('id') id: string,
        @Body() dto: ProductUpdateDto,
        @AuthUser() actor: IAuthUser
    ): Promise<ProductResponseDto> {
        return this.productsService.update(shopId, id, dto, actor);
    }

    @Delete(':id')
    @AllowedRoles([Role.MERCHANT, Role.ADMIN])
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiBearerAuth('accessToken')
    @ApiOperation({ summary: 'Soft-delete product [MERCHANT(own shop)/ADMIN]' })
    remove(
        @Param('shopId') shopId: string,
        @Param('id') id: string,
        @AuthUser() actor: IAuthUser
    ): Promise<void> {
        return this.productsService.remove(shopId, id, actor);
    }
}
