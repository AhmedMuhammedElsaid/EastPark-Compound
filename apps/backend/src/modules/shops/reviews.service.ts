import { Injectable, NotFoundException } from '@nestjs/common';

import {
    isPrismaError,
    PRISMA_FOREIGN_KEY_VIOLATION,
} from 'src/common/database/prisma-errors';
import { DatabaseService } from 'src/common/database/services/database.service';
import { cursorArgs, toCursorPage } from 'src/common/helper/pagination';

import { ReviewCreateDto } from './dtos/request/review.create.dto';
import { ReviewQueryDto } from './dtos/request/review.query.dto';
import { ReviewListResponseDto, ReviewResponseDto } from './dtos/response/review.response.dto';

@Injectable()
export class ReviewsService {
    constructor(private readonly db: DatabaseService) {}

    /**
     * Every review route is scoped to a shop: an unknown or soft-deleted shop
     * is a 404 (not an empty list, and its reviews cannot be changed).
     */
    private async assertLiveShop(shopId: string): Promise<void> {
        const shop = await this.db.shop.findUnique({
            where: { id: shopId },
            select: { deletedAt: true },
        });
        if (!shop || shop.deletedAt) throw new NotFoundException('shop.error.notFound');
    }

    async findAll(shopId: string, query: ReviewQueryDto): Promise<ReviewListResponseDto> {
        const limit = query.limit ?? 20;
        await this.assertLiveShop(shopId);

        const [rows, aggregate] = await Promise.all([
            // Soft-deleted reviews, and every review of a soft-deleted shop,
            // are hidden from the list and from the average.
            this.db.review.findMany({
                where: { shopId, deletedAt: null, shop: { deletedAt: null } },
                take: limit + 1,
                ...cursorArgs(query.cursor),
                orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
                include: { user: { select: { id: true, name: true } } },
            }),
            this.db.review.aggregate({
                where: { shopId, deletedAt: null, shop: { deletedAt: null } },
                _avg: { rating: true },
            }),
        ]);

        const { items, nextCursor } = toCursorPage(rows, limit);

        return {
            items: items.map((r) => ({
                id: r.id,
                rating: r.rating,
                comment: r.comment,
                user: r.user,
                createdAt: r.createdAt,
            })),
            nextCursor,
            averageRating: aggregate._avg.rating,
        };
    }

    /**
     * Create or update my review. A soft-deleted review of mine for this shop
     * is revived and overwritten (one row per user and shop), and counts as a
     * new review (fresh createdAt). A deleted shop cannot be reviewed.
     */
    async upsert(shopId: string, userId: string, dto: ReviewCreateDto): Promise<ReviewResponseDto> {
        await this.assertLiveShop(shopId);

        const existing = await this.db.review.findUnique({
            where: { userId_shopId: { userId, shopId } },
            select: { deletedAt: true },
        });
        const revive = existing?.deletedAt
            ? { deletedAt: null, deletedById: null, createdAt: new Date() }
            : {};

        let review;
        try {
            review = await this.db.review.upsert({
                where: { userId_shopId: { userId, shopId } },
                create: { rating: dto.rating, comment: dto.comment, userId, shopId },
                update: { rating: dto.rating, comment: dto.comment, ...revive },
                include: { user: { select: { id: true, name: true } } },
            });
        } catch (error) {
            // Shop removed meanwhile: the FK rejects the insert — 404, not 500.
            if (isPrismaError(error, PRISMA_FOREIGN_KEY_VIOLATION)) {
                throw new NotFoundException('shop.error.notFound');
            }
            throw error;
        }

        return {
            id: review.id,
            rating: review.rating,
            comment: review.comment,
            user: review.user,
            createdAt: review.createdAt,
        };
    }

    /** Soft delete by its author (not audited: the actor is a resident). */
    async remove(shopId: string, userId: string): Promise<void> {
        // A deleted shop's reviews are frozen with it (restorable together).
        await this.assertLiveShop(shopId);
        const review = await this.db.review.findUnique({
            where: { userId_shopId: { userId, shopId } },
        });
        if (!review || review.deletedAt) throw new NotFoundException('review.error.notFound');

        await this.db.review.update({
            where: { userId_shopId: { userId, shopId } },
            data: { deletedAt: new Date(), deletedById: userId },
        });
    }
}
