import { Injectable, NotFoundException } from '@nestjs/common';

import {
    isPrismaError,
    PRISMA_FOREIGN_KEY_VIOLATION,
} from 'src/common/database/prisma-errors';
import { DatabaseService } from 'src/common/database/services/database.service';
import { toCursorPage } from 'src/common/helper/pagination';

import { SavedShopQueryDto } from './dtos/request/saved-shop.query.dto';
import { SavedShopListResponseDto } from './dtos/response/saved-shop.response.dto';

@Injectable()
export class SavedShopsService {
    constructor(private readonly db: DatabaseService) {}

    async saveShop(shopId: string, userId: string): Promise<void> {
        // A soft-deleted shop still satisfies the FK: refuse it explicitly.
        const shop = await this.db.shop.findUnique({
            where: { id: shopId },
            select: { deletedAt: true },
        });
        if (!shop || shop.deletedAt) throw new NotFoundException('shop.error.notFound');

        try {
            await this.db.savedShop.upsert({
                where: { userId_shopId: { userId, shopId } },
                create: { userId, shopId },
                update: {},
            });
        } catch (error) {
            // Unknown shopId: the FK rejects the insert — 404, not 500.
            if (isPrismaError(error, PRISMA_FOREIGN_KEY_VIOLATION)) {
                throw new NotFoundException('shop.error.notFound');
            }
            throw error;
        }
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

        // Bookmarks of soft-deleted shops are kept but hidden (they come back
        // if the shop is restored).
        const rows = await this.db.savedShop.findMany({
            where: { userId, shop: { deletedAt: null } },
            take: limit + 1,
            ...(query.cursor
                ? { skip: 1, cursor: { userId_shopId: { userId, shopId: query.cursor } } }
                : {}),
            orderBy: { shopId: 'desc' },
            include: {
                shop: {
                    include: {
                        photos: { where: { deletedAt: null }, orderBy: { order: 'asc' } },
                    },
                },
            },
        });

        const { items, nextCursor } = toCursorPage(rows, limit, s => s.shopId);

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
