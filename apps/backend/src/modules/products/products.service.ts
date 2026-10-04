import {
    ForbiddenException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { Product, Role } from '@prisma/client';

import { DatabaseService } from 'src/common/database/services/database.service';
import { cursorArgs, toCursorPage } from 'src/common/helper/pagination';
import { toMoneyNumber } from 'src/common/helper/money';
import { IAuthUser } from 'src/common/request/interfaces/request.interface';
import { AuditService } from 'src/modules/audit/audit.service';

import { ProductCreateDto } from './dtos/request/product.create.dto';
import { ProductQueryDto } from './dtos/request/product.query.dto';
import { ProductUpdateDto } from './dtos/request/product.update.dto';
import {
    ProductListResponseDto,
    ProductResponseDto,
} from './dtos/response/product.response.dto';

/** Prisma row → API shape: Decimal price leaves the service as a number. */
export function toProductResponse(product: Product): ProductResponseDto {
    return { ...product, price: toMoneyNumber(product.price) };
}

@Injectable()
export class ProductsService {
    constructor(
        private readonly db: DatabaseService,
        private readonly audit: AuditService
    ) {}

    /**
     * The shop must exist for every role (an ADMIN creating a product in an
     * unknown shop would otherwise hit the FK and surface a 500); a MERCHANT
     * must also own it.
     */
    private async assertShopOwnership(
        shopId: string,
        actor: IAuthUser
    ): Promise<void> {
        const shop = await this.db.shop.findUnique({
            where: { id: shopId },
            select: { merchantId: true },
        });
        if (!shop) throw new NotFoundException('shop.error.notFound');
        if (actor.role === Role.MERCHANT && shop.merchantId !== actor.userId) {
            throw new ForbiddenException('product.error.forbidden');
        }
    }

    async create(
        shopId: string,
        dto: ProductCreateDto,
        actor: IAuthUser
    ): Promise<ProductResponseDto> {
        await this.assertShopOwnership(shopId, actor);

        const product = await this.db.product.create({
            data: { ...dto, shopId, isDeleted: false },
        });
        await this.audit.record(actor, 'PRODUCT_CREATED', 'Product', product.id, {
            label: product.name,
        });
        return toProductResponse(product);
    }

    async findAll(
        shopId: string,
        query: ProductQueryDto
    ): Promise<ProductListResponseDto> {
        const limit = query.limit ?? 20;

        const rows = await this.db.product.findMany({
            where: {
                shopId,
                isDeleted: false,
                ...(query.isAvailable !== undefined
                    ? { isAvailable: query.isAvailable }
                    : {}),
                ...(query.search
                    ? {
                          OR: [
                              {
                                  name: {
                                      contains: query.search,
                                      mode: 'insensitive',
                                  },
                              },
                              {
                                  nameAr: {
                                      contains: query.search,
                                      mode: 'insensitive',
                                  },
                              },
                          ],
                      }
                    : {}),
            },
            take: limit + 1,
            ...cursorArgs(query.cursor),
            orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        });

        const { items, nextCursor } = toCursorPage(rows, limit);

        return { items: items.map(toProductResponse), nextCursor };
    }

    async findOne(shopId: string, id: string): Promise<ProductResponseDto> {
        const product = await this.db.product.findFirst({
            where: { id, shopId, isDeleted: false },
        });
        if (!product) throw new NotFoundException('product.error.notFound');
        return toProductResponse(product);
    }

    async update(
        shopId: string,
        id: string,
        dto: ProductUpdateDto,
        actor: IAuthUser
    ): Promise<ProductResponseDto> {
        await this.assertShopOwnership(shopId, actor);
        await this.findOne(shopId, id);

        const product = await this.db.product.update({
            where: { id },
            data: dto,
        });
        await this.audit.record(actor, 'PRODUCT_UPDATED', 'Product', id, {
            label: product.name,
        });
        return toProductResponse(product);
    }

    async remove(shopId: string, id: string, actor: IAuthUser): Promise<void> {
        await this.assertShopOwnership(shopId, actor);
        const existing = await this.findOne(shopId, id);

        // Soft delete — preserves OrderItem FKs
        await this.db.product.update({
            where: { id },
            data: { isDeleted: true, isAvailable: false },
        });
        await this.audit.record(actor, 'PRODUCT_DELETED', 'Product', id, {
            label: existing.name,
        });
    }
}
