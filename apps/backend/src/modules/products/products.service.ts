import {
    ForbiddenException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { Role } from '@prisma/client';

import { DatabaseService } from 'src/common/database/services/database.service';
import { IAuthUser } from 'src/common/request/interfaces/request.interface';

import { ProductCreateDto } from './dtos/request/product.create.dto';
import { ProductQueryDto } from './dtos/request/product.query.dto';
import { ProductUpdateDto } from './dtos/request/product.update.dto';
import {
    ProductListResponseDto,
    ProductResponseDto,
} from './dtos/response/product.response.dto';

@Injectable()
export class ProductsService {
    constructor(private readonly db: DatabaseService) {}

    private async assertShopOwnership(
        shopId: string,
        actor: IAuthUser
    ): Promise<void> {
        if (actor.role === Role.MERCHANT) {
            const shop = await this.db.shop.findUnique({
                where: { id: shopId },
            });
            if (!shop) throw new NotFoundException('shop.error.notFound');
            if (shop.merchantId !== actor.userId) {
                throw new ForbiddenException('product.error.forbidden');
            }
        }
    }

    async create(
        shopId: string,
        dto: ProductCreateDto,
        actor: IAuthUser
    ): Promise<ProductResponseDto> {
        await this.assertShopOwnership(shopId, actor);

        return this.db.product.create({
            data: { ...dto, shopId, isDeleted: false },
        });
    }

    async findAll(
        shopId: string,
        query: ProductQueryDto
    ): Promise<ProductListResponseDto> {
        const limit = query.limit ?? 20;

        const items = await this.db.product.findMany({
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
            ...(query.cursor ? { skip: 1, cursor: { id: query.cursor } } : {}),
            orderBy: { createdAt: 'asc' },
        });

        let nextCursor: string | undefined;
        if (items.length > limit) {
            const last = items.pop();
            nextCursor = last?.id;
        }

        return { items, nextCursor };
    }

    async findOne(shopId: string, id: string): Promise<ProductResponseDto> {
        const product = await this.db.product.findFirst({
            where: { id, shopId, isDeleted: false },
        });
        if (!product) throw new NotFoundException('product.error.notFound');
        return product;
    }

    async update(
        shopId: string,
        id: string,
        dto: ProductUpdateDto,
        actor: IAuthUser
    ): Promise<ProductResponseDto> {
        await this.assertShopOwnership(shopId, actor);
        await this.findOne(shopId, id);

        return this.db.product.update({
            where: { id },
            data: dto,
        });
    }

    async remove(shopId: string, id: string, actor: IAuthUser): Promise<void> {
        await this.assertShopOwnership(shopId, actor);
        await this.findOne(shopId, id);

        // Soft delete — preserves OrderItem FKs
        await this.db.product.update({
            where: { id },
            data: { isDeleted: true, isAvailable: false },
        });
    }
}
