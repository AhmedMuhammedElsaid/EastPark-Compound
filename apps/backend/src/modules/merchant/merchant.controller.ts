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

import { AllowedRoles } from 'src/common/request/decorators/request.role.decorator';
import { AuthUser } from 'src/common/request/decorators/request.user.decorator';
import { IAuthUser } from 'src/common/request/interfaces/request.interface';
import { OrderQueryDto } from 'src/modules/orders/dtos/request/order.query.dto';
import { OrderUpdateStatusDto } from 'src/modules/orders/dtos/request/order.update-status.dto';
import {
    OrderListResponseDto,
    OrderResponseDto,
} from 'src/modules/orders/dtos/response/order.response.dto';
import { ProductCreateDto } from 'src/modules/products/dtos/request/product.create.dto';
import { ProductQueryDto } from 'src/modules/products/dtos/request/product.query.dto';
import { ProductUpdateDto } from 'src/modules/products/dtos/request/product.update.dto';
import {
    ProductListResponseDto,
    ProductResponseDto,
} from 'src/modules/products/dtos/response/product.response.dto';
import { ShopUpdateDto } from 'src/modules/shops/dtos/request/shop.update.dto';
import { ShopResponseDto } from 'src/modules/shops/dtos/response/shop.response.dto';

import { MerchantService } from './merchant.service';

/**
 * Merchant self-service surface. Every route resolves the caller's own shop
 * from their JWT, so the mobile app never needs to know its shopId. All routes
 * are MERCHANT-only.
 */
@ApiTags('merchant')
@ApiBearerAuth('accessToken')
@AllowedRoles([Role.MERCHANT])
@Controller({ path: '/merchant', version: '1' })
export class MerchantController {
    constructor(private readonly merchantService: MerchantService) {}

    // ── Shop ────────────────────────────────────────────────────────────────

    @Get('shop')
    @ApiOperation({ summary: 'Get my shop [MERCHANT]' })
    getMyShop(@AuthUser() actor: IAuthUser): Promise<ShopResponseDto> {
        return this.merchantService.getMyShop(actor);
    }

    @Patch('shop')
    @ApiOperation({ summary: 'Update my shop [MERCHANT]' })
    updateMyShop(
        @AuthUser() actor: IAuthUser,
        @Body() dto: ShopUpdateDto
    ): Promise<ShopResponseDto> {
        return this.merchantService.updateMyShop(actor, dto);
    }

    // ── Products ──────────────────────────────────────────────────────────────

    @Get('products')
    @ApiOperation({ summary: 'List my products [MERCHANT]' })
    listProducts(
        @AuthUser() actor: IAuthUser,
        @Query() query: ProductQueryDto
    ): Promise<ProductListResponseDto> {
        return this.merchantService.listProducts(actor, query);
    }

    @Post('products')
    @ApiOperation({ summary: 'Create a product in my shop [MERCHANT]' })
    createProduct(
        @AuthUser() actor: IAuthUser,
        @Body() dto: ProductCreateDto
    ): Promise<ProductResponseDto> {
        return this.merchantService.createProduct(actor, dto);
    }

    @Patch('products/:id')
    @ApiOperation({ summary: 'Update a product in my shop [MERCHANT]' })
    updateProduct(
        @AuthUser() actor: IAuthUser,
        @Param('id') id: string,
        @Body() dto: ProductUpdateDto
    ): Promise<ProductResponseDto> {
        return this.merchantService.updateProduct(actor, id, dto);
    }

    @Delete('products/:id')
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Soft-delete a product in my shop [MERCHANT]' })
    deleteProduct(
        @AuthUser() actor: IAuthUser,
        @Param('id') id: string
    ): Promise<void> {
        return this.merchantService.deleteProduct(actor, id);
    }

    // ── Orders ────────────────────────────────────────────────────────────────

    @Get('orders')
    @ApiOperation({ summary: 'List incoming orders for my shop [MERCHANT]' })
    listOrders(
        @AuthUser() actor: IAuthUser,
        @Query() query: OrderQueryDto
    ): Promise<OrderListResponseDto> {
        return this.merchantService.listOrders(actor, query);
    }

    @Get('orders/:id')
    @ApiOperation({ summary: 'Get one of my shop orders [MERCHANT]' })
    getOrder(
        @AuthUser() actor: IAuthUser,
        @Param('id') id: string
    ): Promise<OrderResponseDto> {
        return this.merchantService.getOrder(actor, id);
    }

    @Patch('orders/:id/status')
    @ApiOperation({ summary: 'Update status of one of my shop orders [MERCHANT]' })
    updateOrderStatus(
        @AuthUser() actor: IAuthUser,
        @Param('id') id: string,
        @Body() dto: OrderUpdateStatusDto
    ): Promise<OrderResponseDto> {
        return this.merchantService.updateOrderStatus(actor, id, dto);
    }
}
