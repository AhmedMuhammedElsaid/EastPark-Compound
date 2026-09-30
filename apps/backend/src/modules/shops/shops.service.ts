import {
    ForbiddenException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { Role } from '@prisma/client';

import { DatabaseService } from 'src/common/database/services/database.service';
import { IAuthUser } from 'src/common/request/interfaces/request.interface';

import { ShopCreateDto } from './dtos/request/shop.create.dto';
import { ShopQueryDto } from './dtos/request/shop.query.dto';
import { ShopUpdateDto } from './dtos/request/shop.update.dto';
import {
    ShopListResponseDto,
    ShopResponseDto,
} from './dtos/response/shop.response.dto';

@Injectable()
export class ShopsService {
    constructor(private readonly db: DatabaseService) {}

    async create(dto: ShopCreateDto): Promise<ShopResponseDto> {
        const shop = await this.db.shop.create({
            data: {
                name: dto.name,
                nameAr: dto.nameAr,
                description: dto.description,
                descriptionAr: dto.descriptionAr,
                category: dto.category,
                phone: dto.phone,
                whatsapp: dto.whatsapp,
                deliveryTime: dto.deliveryTime,
                merchantId: dto.merchantId,
            },
            include: {
                photos: { orderBy: { order: 'asc' } },
                _count: { select: { reviews: true } },
            },
        });
        return {
            ...shop,
            photos: shop.photos.map((photo, i) => ({ ...photo, isPrimary: i === 0 })),
            reviewCount: shop._count.reviews,
            averageRating: null,
        };
    }

    async findAll(query: ShopQueryDto): Promise<ShopListResponseDto> {
        const limit = query.limit ?? 20;

        const items = await this.db.shop.findMany({
            where: {
                ...(query.category ? { category: query.category } : {}),
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
            orderBy: { createdAt: 'desc' },
            include: {
                photos: { orderBy: { order: 'asc' } },
                _count: { select: { reviews: true } },
            },
        });

        let nextCursor: string | undefined;
        if (items.length > limit) {
            const last = items.pop();
            nextCursor = last?.id;
        }

        // Batch-fetch average ratings for all shops in one query
        const shopIds = items.map(s => s.id);
        const ratingRows = await this.db.review.groupBy({
            by: ['shopId'],
            where: { shopId: { in: shopIds } },
            _avg: { rating: true },
        });
        const ratingMap = new Map(ratingRows.map(r => [r.shopId, r._avg.rating]));

        return {
            items: items.map((shop) => ({
                ...shop,
                photos: shop.photos.map((photo, i) => ({ ...photo, isPrimary: i === 0 })),
                reviewCount: shop._count.reviews,
                averageRating: ratingMap.get(shop.id) ?? null,
            })),
            nextCursor,
        };
    }

    async findOne(id: string): Promise<ShopResponseDto> {
        const [shop, aggregate] = await Promise.all([
            this.db.shop.findUnique({
                where: { id },
                include: {
                    photos: { orderBy: { order: 'asc' } },
                    _count: { select: { reviews: true } },
                },
            }),
            this.db.review.aggregate({
                where: { shopId: id },
                _avg: { rating: true },
            }),
        ]);
        if (!shop) throw new NotFoundException('shop.error.notFound');
        return {
            ...shop,
            photos: shop.photos.map((photo, i) => ({ ...photo, isPrimary: i === 0 })),
            reviewCount: shop._count.reviews,
            averageRating: aggregate._avg.rating,
        };
    }

    async update(
        id: string,
        dto: ShopUpdateDto,
        actor: IAuthUser
    ): Promise<ShopResponseDto> {
        const shop = await this.db.shop.findUnique({ where: { id } });
        if (!shop) throw new NotFoundException('shop.error.notFound');

        // Merchants can only update their own shop
        if (actor.role === Role.MERCHANT && shop.merchantId !== actor.userId) {
            throw new ForbiddenException('shop.error.forbidden');
        }

        const updated = await this.db.shop.update({
            where: { id },
            data: {
                name: dto.name,
                nameAr: dto.nameAr,
                description: dto.description,
                descriptionAr: dto.descriptionAr,
                category: dto.category,
                phone: dto.phone,
                whatsapp: dto.whatsapp,
                deliveryTime: dto.deliveryTime,
                isOpen: dto.isOpen,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                workingHours: dto.workingHours as any,
            },
            include: {
                photos: { orderBy: { order: 'asc' } },
                _count: { select: { reviews: true } },
            },
        });
        const aggregate = await this.db.review.aggregate({
            where: { shopId: id },
            _avg: { rating: true },
        });
        return {
            ...updated,
            photos: updated.photos.map((photo, i) => ({ ...photo, isPrimary: i === 0 })),
            reviewCount: updated._count.reviews,
            averageRating: aggregate._avg.rating,
        };
    }

    async remove(id: string): Promise<void> {
        const shop = await this.db.shop.findUnique({ where: { id } });
        if (!shop) throw new NotFoundException('shop.error.notFound');
        await this.db.shop.delete({ where: { id } });
    }

    async addPhoto(
        shopId: string,
        url: string,
        order: number,
        actor: IAuthUser
    ): Promise<ShopResponseDto> {
        const shop = await this.db.shop.findUnique({ where: { id: shopId } });
        if (!shop) throw new NotFoundException('shop.error.notFound');
        if (actor.role === Role.MERCHANT && shop.merchantId !== actor.userId) {
            throw new ForbiddenException('shop.error.forbidden');
        }

        await this.db.shopPhoto.create({ data: { shopId, url, order } });

        return this.findOne(shopId);
    }

    async removePhoto(shopId: string, photoId: string, actor: IAuthUser): Promise<void> {
        const photo = await this.db.shopPhoto.findUnique({
            where: { id: photoId },
            include: { shop: { select: { merchantId: true } } },
        });
        if (!photo || photo.shopId !== shopId) {
            throw new NotFoundException('shop.error.photoNotFound');
        }
        if (actor.role === Role.MERCHANT && photo.shop.merchantId !== actor.userId) {
            throw new ForbiddenException('shop.error.forbidden');
        }
        await this.db.shopPhoto.delete({ where: { id: photoId } });
    }
}
