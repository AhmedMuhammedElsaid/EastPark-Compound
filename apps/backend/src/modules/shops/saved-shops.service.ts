import { Injectable, NotFoundException } from '@nestjs/common';

import { DatabaseService } from 'src/common/database/services/database.service';

import { SavedShopQueryDto } from './dtos/request/saved-shop.query.dto';
import { SavedShopListResponseDto } from './dtos/response/saved-shop.response.dto';

@Injectable()
export class SavedShopsService {
    constructor(private readonly db: DatabaseService) {}

    async saveShop(shopId: string, userId: string): Promise<void> {
        await this.db.savedShop.upsert({
            where: { userId_shopId: { userId, shopId } },
            create: { userId, shopId },
            update: {},
        });
    }

    async unsaveShop(shopId: string, userId: string): Promise<void> {
        const saved = await this.db.savedShop.findUnique({
            where: { userId_shopId: { userId, shopId } },
        });
        if (!saved) throw new NotFoundException('savedShop.error.notFound');
        await this.db.savedShop.delete({ where: { userId_shopId: { userId, shopId } } });
    }

    async findSavedShops(userId: string, query: SavedShopQueryDto): Promise<SavedShopListResponseDto> {
        const limit = query.limit ?? 20;

        const items = await this.db.savedShop.findMany({
            where: { userId },
            take: limit + 1,
            ...(query.cursor
                ? { skip: 1, cursor: { userId_shopId: { userId, shopId: query.cursor } } }
                : {}),
            orderBy: { shopId: 'desc' },
            include: { shop: { include: { photos: { orderBy: { order: 'asc' } } } } },
        });

        let nextCursor: string | undefined;
        if (items.length > limit) {
            const last = items.pop();
            nextCursor = last?.shopId;
        }

        return {
            items: items.map((s) => ({
                userId: s.userId,
                shopId: s.shopId,
                shop: s.shop as any,
            })),
            nextCursor,
        };
    }
}
