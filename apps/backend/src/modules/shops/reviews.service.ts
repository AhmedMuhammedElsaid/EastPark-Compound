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

    async findAll(shopId: string, query: ReviewQueryDto): Promise<ReviewListResponseDto> {
        const limit = query.limit ?? 20;

        const [rows, aggregate] = await Promise.all([
            this.db.review.findMany({
                where: { shopId },
                take: limit + 1,
                ...cursorArgs(query.cursor),
                orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
                include: { user: { select: { id: true, name: true } } },
            }),
            this.db.review.aggregate({
                where: { shopId },
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

    async upsert(shopId: string, userId: string, dto: ReviewCreateDto): Promise<ReviewResponseDto> {
        let review;
        try {
            review = await this.db.review.upsert({
                where: { userId_shopId: { userId, shopId } },
                create: { rating: dto.rating, comment: dto.comment, userId, shopId },
                update: { rating: dto.rating, comment: dto.comment },
                include: { user: { select: { id: true, name: true } } },
            });
        } catch (error) {
            // Unknown shopId: the FK rejects the insert — 404, not 500.
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

    async remove(shopId: string, userId: string): Promise<void> {
        const review = await this.db.review.findUnique({
            where: { userId_shopId: { userId, shopId } },
        });
        if (!review) throw new NotFoundException('review.error.notFound');

        await this.db.review.delete({ where: { userId_shopId: { userId, shopId } } });
    }
}
