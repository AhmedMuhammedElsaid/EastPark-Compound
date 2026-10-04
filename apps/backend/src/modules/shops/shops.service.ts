import {
    BadRequestException,
    ForbiddenException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';

import { DatabaseService } from 'src/common/database/services/database.service';
import { cursorArgs, toCursorPage } from 'src/common/helper/pagination';
import { IAuthUser } from 'src/common/request/interfaces/request.interface';
import { AuditService } from 'src/modules/audit/audit.service';

import { ShopCreateDto } from './dtos/request/shop.create.dto';
import { ShopQueryDto } from './dtos/request/shop.query.dto';
import { ShopUpdateDto } from './dtos/request/shop.update.dto';
import {
    ShopListResponseDto,
    ShopResponseDto,
} from './dtos/response/shop.response.dto';

/**
 * Shop include used by every read: only live (non-deleted) photos, and a review
 * count that ignores soft-deleted reviews.
 */
export const LIVE_SHOP_INCLUDE = {
    photos: { where: { deletedAt: null }, orderBy: { order: 'asc' } },
    _count: { select: { reviews: { where: { deletedAt: null } } } },
} satisfies Prisma.ShopInclude;

/** Serialise a validated DTO instance into plain JSON for a Prisma Json column */
function toJson(value: object | undefined): Prisma.InputJsonValue | undefined {
    return value === undefined
        ? undefined
        : (JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue);
}

@Injectable()
export class ShopsService {
    constructor(
        private readonly db: DatabaseService,
        private readonly audit: AuditService
    ) {}

    async create(dto: ShopCreateDto, actor?: IAuthUser): Promise<ShopResponseDto> {
        // The owner must be a live MERCHANT: the merchant module only serves
        // that role, and a deleted or non-merchant owner leaves nobody able to
        // run the shop.
        const merchant = await this.db.user.findUnique({
            where: { id: dto.merchantId },
            select: { role: true, deletedAt: true },
        });
        if (!merchant || merchant.deletedAt || merchant.role !== Role.MERCHANT)
            throw new BadRequestException('shop.error.merchantInvalid');

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
                workingHours: toJson(dto.workingHours),
            },
            include: LIVE_SHOP_INCLUDE,
        });
        await this.audit.record(actor, 'SHOP_CREATED', 'Shop', shop.id, {
            label: shop.name,
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

        const rows = await this.db.shop.findMany({
            where: {
                deletedAt: null,
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
            ...cursorArgs(query.cursor),
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            include: LIVE_SHOP_INCLUDE,
        });

        const { items, nextCursor } = toCursorPage(rows, limit);

        // Batch-fetch average ratings for all shops in one query
        const shopIds = items.map(s => s.id);
        const ratingRows = await this.db.review.groupBy({
            by: ['shopId'],
            where: { shopId: { in: shopIds }, deletedAt: null },
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
                include: LIVE_SHOP_INCLUDE,
            }),
            this.db.review.aggregate({
                where: { shopId: id, deletedAt: null },
                _avg: { rating: true },
            }),
        ]);
        if (!shop || shop.deletedAt)
            throw new NotFoundException('shop.error.notFound');
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
        const shop = await this.db.shop.findUnique({
            where: { id },
            select: { merchantId: true, deletedAt: true },
        });
        if (!shop || shop.deletedAt)
            throw new NotFoundException('shop.error.notFound');

        // Merchants can only update their own shop
        if (actor.role === Role.MERCHANT && shop.merchantId !== actor.userId) {
            throw new ForbiddenException('shop.error.forbidden');
        }

        const [updated, aggregate] = await Promise.all([
            this.db.shop.update({
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
                    workingHours: toJson(dto.workingHours),
                },
                include: LIVE_SHOP_INCLUDE,
            }),
            this.db.review.aggregate({
                where: { shopId: id, deletedAt: null },
                _avg: { rating: true },
            }),
        ]);
        await this.audit.record(actor, 'SHOP_UPDATED', 'Shop', id, {
            label: updated.name,
        });
        return {
            ...updated,
            photos: updated.photos.map((photo, i) => ({ ...photo, isPrimary: i === 0 })),
            reviewCount: updated._count.reviews,
            averageRating: aggregate._avg.rating,
        };
    }

    /**
     * Soft delete: the shop disappears from the directory, search, detail,
     * ordering and the merchant module, but the row and everything attached
     * to it (products, photos, reviews, bookmarks, order history) stay, so the
     * SUPER_ADMIN can restore it from the recycle bin. Children are not
     * touched; they are hidden with their shop.
     */
    async remove(id: string, actor?: IAuthUser): Promise<void> {
        const shop = await this.db.shop.findUnique({
            where: { id },
            select: { id: true, name: true, deletedAt: true },
        });
        if (!shop || shop.deletedAt)
            throw new NotFoundException('shop.error.notFound');

        await this.db.shop.update({
            where: { id },
            data: { deletedAt: new Date(), deletedById: actor?.userId ?? null },
        });

        await this.audit.record(actor, 'SHOP_DELETED', 'Shop', id, {
            label: shop.name,
        });
    }

    async addPhoto(
        shopId: string,
        url: string,
        order: number,
        actor: IAuthUser
    ): Promise<ShopResponseDto> {
        const shop = await this.db.shop.findUnique({
            where: { id: shopId },
            select: { merchantId: true, name: true, deletedAt: true },
        });
        if (!shop || shop.deletedAt)
            throw new NotFoundException('shop.error.notFound');
        if (actor.role === Role.MERCHANT && shop.merchantId !== actor.userId) {
            throw new ForbiddenException('shop.error.forbidden');
        }

        await this.db.shopPhoto.create({ data: { shopId, url, order } });
        await this.audit.record(actor, 'SHOP_PHOTO_ADDED', 'Shop', shopId, {
            label: shop.name,
        });

        return this.findOne(shopId);
    }

    async removePhoto(shopId: string, photoId: string, actor: IAuthUser): Promise<void> {
        const photo = await this.db.shopPhoto.findUnique({
            where: { id: photoId },
            include: {
                shop: {
                    select: { merchantId: true, name: true, deletedAt: true },
                },
            },
        });
        if (
            !photo ||
            photo.shopId !== shopId ||
            photo.deletedAt ||
            photo.shop.deletedAt
        ) {
            throw new NotFoundException('shop.error.photoNotFound');
        }
        if (actor.role === Role.MERCHANT && photo.shop.merchantId !== actor.userId) {
            throw new ForbiddenException('shop.error.forbidden');
        }
        // Soft delete: restorable from the recycle bin.
        await this.db.shopPhoto.update({
            where: { id: photoId },
            data: { deletedAt: new Date(), deletedById: actor.userId },
        });
        await this.audit.record(actor, 'SHOP_PHOTO_DELETED', 'Shop', shopId, {
            label: photo.shop.name,
        });
    }
}
