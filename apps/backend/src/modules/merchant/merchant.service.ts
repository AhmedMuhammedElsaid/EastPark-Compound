import { Injectable, NotFoundException } from '@nestjs/common';

import { DatabaseService } from 'src/common/database/services/database.service';
import { IAuthUser } from 'src/common/request/interfaces/request.interface';
import { OrderQueryDto } from 'src/modules/orders/dtos/request/order.query.dto';
import { OrderUpdateStatusDto } from 'src/modules/orders/dtos/request/order.update-status.dto';
import {
    OrderListResponseDto,
    OrderResponseDto,
} from 'src/modules/orders/dtos/response/order.response.dto';
import { OrdersService } from 'src/modules/orders/orders.service';
import { ProductCreateDto } from 'src/modules/products/dtos/request/product.create.dto';
import { ProductQueryDto } from 'src/modules/products/dtos/request/product.query.dto';
import { ProductUpdateDto } from 'src/modules/products/dtos/request/product.update.dto';
import {
    ProductListResponseDto,
    ProductResponseDto,
} from 'src/modules/products/dtos/response/product.response.dto';
import { ProductsService } from 'src/modules/products/products.service';
import { ShopUpdateDto } from 'src/modules/shops/dtos/request/shop.update.dto';
import { ShopResponseDto } from 'src/modules/shops/dtos/response/shop.response.dto';
import { ShopsService } from 'src/modules/shops/shops.service';

/**
 * Merchant-scoped facade. Resolves the caller's own shop from their JWT
 * (there is no shopId in the token, and merchants only ever act on their own
 * shop) and delegates to the existing shops/products/orders services. This is
 * what lets the mobile app call `/merchant/*` without first discovering a
 * shopId — solving the FE-1 / B-7 gap.
 */
@Injectable()
export class MerchantService {
    constructor(
        private readonly db: DatabaseService,
        private readonly shopsService: ShopsService,
        private readonly productsService: ProductsService,
        private readonly ordersService: OrdersService
    ) {}

    /** Resolve the merchant's own shop id from the JWT actor. */
    private async resolveShopId(actor: IAuthUser): Promise<string> {
        const shop = await this.db.shop.findFirst({
            where: { merchantId: actor.userId },
            orderBy: { createdAt: 'asc' },
            select: { id: true },
        });
        if (!shop) throw new NotFoundException('shop.error.notFound');
        return shop.id;
    }

    // ── Shop ────────────────────────────────────────────────────────────────

    async getMyShop(actor: IAuthUser): Promise<ShopResponseDto> {
        const shopId = await this.resolveShopId(actor);
        return this.shopsService.findOne(shopId);
    }

    async updateMyShop(
        actor: IAuthUser,
        dto: ShopUpdateDto
    ): Promise<ShopResponseDto> {
        const shopId = await this.resolveShopId(actor);
        return this.shopsService.update(shopId, dto, actor);
    }

    // ── Products ──────────────────────────────────────────────────────────────

    async listProducts(
        actor: IAuthUser,
        query: ProductQueryDto
    ): Promise<ProductListResponseDto> {
        const shopId = await this.resolveShopId(actor);
        return this.productsService.findAll(shopId, query);
    }

    async createProduct(
        actor: IAuthUser,
        dto: ProductCreateDto
    ): Promise<ProductResponseDto> {
        const shopId = await this.resolveShopId(actor);
        return this.productsService.create(shopId, dto, actor);
    }

    async updateProduct(
        actor: IAuthUser,
        productId: string,
        dto: ProductUpdateDto
    ): Promise<ProductResponseDto> {
        const shopId = await this.resolveShopId(actor);
        return this.productsService.update(shopId, productId, dto, actor);
    }

    async deleteProduct(actor: IAuthUser, productId: string): Promise<void> {
        const shopId = await this.resolveShopId(actor);
        return this.productsService.remove(shopId, productId, actor);
    }

    // ── Orders ────────────────────────────────────────────────────────────────

    async listOrders(
        actor: IAuthUser,
        query: OrderQueryDto
    ): Promise<OrderListResponseDto> {
        // OrdersService already scopes to the merchant's shops by actor role.
        return this.ordersService.findAll(query, actor);
    }

    async getOrder(actor: IAuthUser, orderId: string): Promise<OrderResponseDto> {
        return this.ordersService.findOne(orderId, actor);
    }

    async updateOrderStatus(
        actor: IAuthUser,
        orderId: string,
        dto: OrderUpdateStatusDto
    ): Promise<OrderResponseDto> {
        return this.ordersService.updateStatus(orderId, dto, actor);
    }
}
