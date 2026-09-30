import { Injectable, NotFoundException } from '@nestjs/common';

import { DatabaseService } from 'src/common/database/services/database.service';

import { ReviewCreateDto } from './dtos/request/review.create.dto';
import { ReviewQueryDto } from './dtos/request/review.query.dto';
import { ReviewListResponseDto, ReviewResponseDto } from './dtos/response/review.response.dto';

@Injectable()
export class ReviewsService {
    constructor(private readonly db: DatabaseService) {}

    async findAll(shopId: string, query: ReviewQueryDto): Promise<ReviewListResponseDto> {
        const limit = query.limit ?? 20;

        const [items, aggregate] = await Promise.all([
            this.db.review.findMany({
                where: { shopId },
                take: limit + 1,
                ...(query.cursor ? { skip: 1, cursor: { id: query.cursor } } : {}),
                orderBy: { createdAt: 'desc' },
                include: { user: { select: { id: true, name: true } } },
            }),
            this.db.review.aggregate({
                where: { shopId },
                _avg: { rating: true },
            }),
        ]);

        let nextCursor: string | undefined;
        if (items.length > limit) {
            const last = items.pop();
            nextCursor = last?.id;
        }

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
        const review = await this.db.review.upsert({
            where: { userId_shopId: { userId, shopId } },
            create: { rating: dto.rating, comment: dto.comment, userId, shopId },
            update: { rating: dto.rating, comment: dto.comment },
            include: { user: { select: { id: true, name: true } } },
        });

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
