import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Role } from '@prisma/client';

import { DatabaseService } from 'src/common/database/services/database.service';
import { AuditService } from 'src/modules/audit/audit.service';
import { MerchantService } from 'src/modules/merchant/merchant.service';
import { NotificationsService } from 'src/modules/notifications/notifications.service';
import { OrdersGateway } from 'src/modules/orders/orders.gateway';
import { OrdersService } from 'src/modules/orders/orders.service';
import { ProductsService } from 'src/modules/products/products.service';
import { ReviewsService } from 'src/modules/shops/reviews.service';
import { SavedShopsService } from 'src/modules/shops/saved-shops.service';
import { ShopsService } from 'src/modules/shops/shops.service';

const admin = { userId: 'admin-1', role: Role.ADMIN };
const merchant = { userId: 'merchant-1', role: Role.MERCHANT };
const resident = { userId: 'resident-1', role: Role.RESIDENT };
const audit = { record: jest.fn() };
const asAudit = audit as unknown as AuditService;

beforeEach(() => jest.clearAllMocks());

describe('shops: soft-deleted shops, photos and reviews are hidden', () => {
    const db = {
        shop: { findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
        shopPhoto: { findUnique: jest.fn(), update: jest.fn(), delete: jest.fn() },
        review: { groupBy: jest.fn(), aggregate: jest.fn() },
    };
    const service = new ShopsService(db as unknown as DatabaseService, asAudit);
    const liveInclude = {
        photos: { where: { deletedAt: null }, orderBy: { order: 'asc' } },
        _count: { select: { reviews: { where: { deletedAt: null } } } },
    };

    it('list filters deleted shops, deleted photos, deleted reviews (count and average)', async () => {
        db.shop.findMany.mockResolvedValue([]);
        db.review.groupBy.mockResolvedValue([]);
        await service.findAll({ limit: 20 });
        const args = db.shop.findMany.mock.calls[0][0];
        expect(args.where).toEqual({ deletedAt: null });
        expect(args.include).toEqual(liveInclude);
        expect(db.review.groupBy.mock.calls[0][0].where).toEqual({
            shopId: { in: [] },
            deletedAt: null,
        });
    });

    it('search also excludes deleted shops', async () => {
        db.shop.findMany.mockResolvedValue([]);
        db.review.groupBy.mockResolvedValue([]);
        await service.findAll({ search: 'caf' });
        expect(db.shop.findMany.mock.calls[0][0].where).toEqual(
            expect.objectContaining({ deletedAt: null, OR: expect.any(Array) })
        );
    });

    it('detail of a deleted shop is a 404; the average ignores deleted reviews', async () => {
        db.shop.findUnique.mockResolvedValue({
            id: 's1',
            deletedAt: new Date(),
            photos: [],
            _count: { reviews: 0 },
        });
        db.review.aggregate.mockResolvedValue({ _avg: { rating: null } });
        await expect(service.findOne('s1')).rejects.toBeInstanceOf(
            NotFoundException
        );
        expect(db.review.aggregate).toHaveBeenCalledWith({
            where: { shopId: 's1', deletedAt: null },
            _avg: { rating: true },
        });
        expect(db.shop.findUnique.mock.calls[0][0].include).toEqual(
            liveInclude
        );
    });

    it('updating a deleted shop is a 404', async () => {
        db.shop.findUnique.mockResolvedValue({
            merchantId: 'merchant-1',
            deletedAt: new Date(),
        });
        await expect(service.update('s1', {}, merchant)).rejects.toBeInstanceOf(
            NotFoundException
        );
        expect(db.shop.update).not.toHaveBeenCalled();
    });

    it('adding a photo to a deleted shop is a 404', async () => {
        db.shop.findUnique.mockResolvedValue({
            merchantId: 'merchant-1',
            name: 'Cafe',
            deletedAt: new Date(),
        });
        await expect(
            service.addPhoto('s1', 'https://x/y.jpg', 0, admin)
        ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('photo delete is soft: the row stays, deletedAt/deletedById set, audited', async () => {
        db.shopPhoto.findUnique.mockResolvedValue({
            id: 'p1',
            shopId: 's1',
            deletedAt: null,
            shop: { merchantId: 'merchant-1', name: 'Cafe', deletedAt: null },
        });
        await service.removePhoto('s1', 'p1', merchant);
        expect(db.shopPhoto.delete).not.toHaveBeenCalled();
        expect(db.shopPhoto.update).toHaveBeenCalledWith({
            where: { id: 'p1' },
            data: { deletedAt: expect.any(Date), deletedById: 'merchant-1' },
        });
        expect(audit.record).toHaveBeenCalledWith(
            merchant,
            'SHOP_PHOTO_DELETED',
            'Shop',
            's1',
            { label: 'Cafe' }
        );
    });

    it('deleting an already deleted photo, or a photo of a deleted shop, is a 404', async () => {
        db.shopPhoto.findUnique.mockResolvedValueOnce({
            id: 'p1',
            shopId: 's1',
            deletedAt: new Date(),
            shop: { merchantId: 'merchant-1', name: 'Cafe', deletedAt: null },
        });
        await expect(
            service.removePhoto('s1', 'p1', admin)
        ).rejects.toBeInstanceOf(NotFoundException);
        db.shopPhoto.findUnique.mockResolvedValueOnce({
            id: 'p1',
            shopId: 's1',
            deletedAt: null,
            shop: { merchantId: 'merchant-1', name: 'Cafe', deletedAt: new Date() },
        });
        await expect(
            service.removePhoto('s1', 'p1', admin)
        ).rejects.toBeInstanceOf(NotFoundException);
        expect(db.shopPhoto.update).not.toHaveBeenCalled();
    });
});

describe('shops: create requires a live merchant owner', () => {
    const db = {
        user: { findUnique: jest.fn() },
        shop: { create: jest.fn() },
    };
    const service = new ShopsService(db as unknown as DatabaseService, asAudit);
    const dto = {
        name: 'Cafe',
        nameAr: 'مقهى',
        category: 'CAFE_AND_FOOD',
        merchantId: 'merchant-1',
    } as never;

    it.each([
        ['an unknown user', null],
        ['a deleted merchant', { role: Role.MERCHANT, deletedAt: new Date() }],
        ['a resident', { role: Role.RESIDENT, deletedAt: null }],
        ['an admin', { role: Role.ADMIN, deletedAt: null }],
    ])('owner %s is a 400 merchantInvalid, nothing created', async (_, user) => {
        db.user.findUnique.mockResolvedValue(user);
        await expect(service.create(dto, admin)).rejects.toThrow(
            new BadRequestException('shop.error.merchantInvalid')
        );
        expect(db.user.findUnique).toHaveBeenCalledWith({
            where: { id: 'merchant-1' },
            select: { role: true, deletedAt: true },
        });
        expect(db.shop.create).not.toHaveBeenCalled();
        expect(audit.record).not.toHaveBeenCalled();
    });

    it('a live merchant owner creates the shop', async () => {
        db.user.findUnique.mockResolvedValue({ role: Role.MERCHANT, deletedAt: null });
        db.shop.create.mockResolvedValue({
            id: 's1',
            name: 'Cafe',
            photos: [],
            _count: { reviews: 0 },
        });
        const shop = await service.create(dto, admin);
        expect(db.shop.create.mock.calls[0][0].data.merchantId).toBe('merchant-1');
        expect(shop.id).toBe('s1');
        expect(audit.record).toHaveBeenCalledWith(admin, 'SHOP_CREATED', 'Shop', 's1', {
            label: 'Cafe',
        });
    });

    it('update never changes the owner, even when merchantId is sent', async () => {
        const updateDb = {
            shop: {
                findUnique: jest.fn().mockResolvedValue({ merchantId: 'merchant-1', deletedAt: null }),
                update: jest.fn().mockResolvedValue({ id: 's1', name: 'Cafe', photos: [], _count: { reviews: 0 } }),
            },
            review: { aggregate: jest.fn().mockResolvedValue({ _avg: { rating: null } }) },
        };
        const updater = new ShopsService(updateDb as unknown as DatabaseService, asAudit);
        await updater.update('s1', { name: 'Cafe', merchantId: 'resident-1' } as never, admin);
        expect(updateDb.shop.update.mock.calls[0][0].data).not.toHaveProperty('merchantId');
    });
});

describe('reviews: soft delete and revive', () => {
    const db = {
        shop: { findUnique: jest.fn() },
        review: {
            findMany: jest.fn(),
            aggregate: jest.fn(),
            findUnique: jest.fn(),
            upsert: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
        },
    };
    const service = new ReviewsService(db as unknown as DatabaseService);
    const saved = {
        id: 'r1',
        rating: 4,
        comment: 'ok',
        createdAt: new Date(),
        user: { id: 'resident-1', name: 'Sara' },
    };

    it('list and average skip deleted reviews and reviews of deleted shops', async () => {
        db.review.findMany.mockResolvedValue([]);
        db.review.aggregate.mockResolvedValue({ _avg: { rating: null } });
        await service.findAll('s1', {});
        const live = { shopId: 's1', deletedAt: null, shop: { deletedAt: null } };
        expect(db.review.findMany.mock.calls[0][0].where).toEqual(live);
        expect(db.review.aggregate.mock.calls[0][0].where).toEqual(live);
    });

    it('delete by its author is soft (row kept, deletedById = author, not audited)', async () => {
        db.review.findUnique.mockResolvedValue({ id: 'r1', deletedAt: null });
        await service.remove('s1', 'resident-1');
        expect(db.review.delete).not.toHaveBeenCalled();
        expect(db.review.update).toHaveBeenCalledWith({
            where: { userId_shopId: { userId: 'resident-1', shopId: 's1' } },
            data: { deletedAt: expect.any(Date), deletedById: 'resident-1' },
        });
    });

    it('deleting an already deleted review is a 404', async () => {
        db.review.findUnique.mockResolvedValue({ id: 'r1', deletedAt: new Date() });
        await expect(service.remove('s1', 'resident-1')).rejects.toThrow(
            'review.error.notFound'
        );
        expect(db.review.update).not.toHaveBeenCalled();
    });

    it('re-reviewing after a soft delete revives the same row with a fresh createdAt', async () => {
        db.shop.findUnique.mockResolvedValue({ deletedAt: null });
        db.review.findUnique.mockResolvedValue({ deletedAt: new Date('2026-01-01') });
        db.review.upsert.mockResolvedValue(saved);
        await service.upsert('s1', 'resident-1', { rating: 4, comment: 'ok' });
        const args = db.review.upsert.mock.calls[0][0];
        expect(args.where).toEqual({
            userId_shopId: { userId: 'resident-1', shopId: 's1' },
        });
        expect(args.update).toEqual({
            rating: 4,
            comment: 'ok',
            deletedAt: null,
            deletedById: null,
            createdAt: expect.any(Date),
        });
    });

    it('updating a live review keeps its createdAt', async () => {
        db.shop.findUnique.mockResolvedValue({ deletedAt: null });
        db.review.findUnique.mockResolvedValue({ deletedAt: null });
        db.review.upsert.mockResolvedValue(saved);
        await service.upsert('s1', 'resident-1', { rating: 5 });
        expect(db.review.upsert.mock.calls[0][0].update).toEqual({
            rating: 5,
            comment: undefined,
        });
    });

    it('a deleted shop cannot be reviewed', async () => {
        db.shop.findUnique.mockResolvedValue({ deletedAt: new Date() });
        await expect(
            service.upsert('s1', 'resident-1', { rating: 5 })
        ).rejects.toThrow('shop.error.notFound');
        expect(db.review.upsert).not.toHaveBeenCalled();
    });
});

describe('saved shops: deleted shops hidden, cannot be bookmarked', () => {
    const db = {
        shop: { findUnique: jest.fn() },
        savedShop: { upsert: jest.fn(), findMany: jest.fn() },
    };
    const service = new SavedShopsService(db as unknown as DatabaseService);

    it('bookmarking a deleted shop is a 404', async () => {
        db.shop.findUnique.mockResolvedValue({ deletedAt: new Date() });
        await expect(
            service.saveShop('s1', 'resident-1')
        ).rejects.toBeInstanceOf(NotFoundException);
        expect(db.savedShop.upsert).not.toHaveBeenCalled();
    });

    it('the bookmark list hides deleted shops and deleted photos', async () => {
        db.savedShop.findMany.mockResolvedValue([]);
        await service.findSavedShops('resident-1', {});
        const args = db.savedShop.findMany.mock.calls[0][0];
        expect(args.where).toEqual({
            userId: 'resident-1',
            shop: { deletedAt: null },
        });
        expect(args.include.shop.include.photos.where).toEqual({
            deletedAt: null,
        });
    });
});

describe('products: soft delete keeps isDeleted in sync, deleted shops hide products', () => {
    const db = {
        shop: { findUnique: jest.fn() },
        product: {
            findMany: jest.fn(),
            findFirst: jest.fn(),
            update: jest.fn(),
            create: jest.fn(),
        },
    };
    const service = new ProductsService(db as unknown as DatabaseService, asAudit);

    it('delete sets isDeleted + deletedAt + deletedById and leaves isAvailable alone', async () => {
        db.shop.findUnique.mockResolvedValue({ merchantId: 'merchant-1', deletedAt: null });
        db.product.findFirst.mockResolvedValue({ id: 'p1', name: 'Latte', price: 10 });
        await service.remove('s1', 'p1', merchant);
        expect(db.product.update).toHaveBeenCalledWith({
            where: { id: 'p1' },
            data: {
                isDeleted: true,
                deletedAt: expect.any(Date),
                deletedById: 'merchant-1',
            },
        });
    });

    it('list and detail exclude products of a deleted shop', async () => {
        db.product.findMany.mockResolvedValue([]);
        await service.findAll('s1', {});
        expect(db.product.findMany.mock.calls[0][0].where).toEqual(
            expect.objectContaining({
                shopId: 's1',
                isDeleted: false,
                shop: { deletedAt: null },
            })
        );
        db.product.findFirst.mockResolvedValue(null);
        await expect(service.findOne('s1', 'p1')).rejects.toBeInstanceOf(
            NotFoundException
        );
        expect(db.product.findFirst).toHaveBeenCalledWith({
            where: { id: 'p1', shopId: 's1', isDeleted: false, shop: { deletedAt: null } },
        });
    });

    it('creating a product in a deleted shop is a 404', async () => {
        db.shop.findUnique.mockResolvedValue({ merchantId: 'merchant-1', deletedAt: new Date() });
        await expect(
            service.create('s1', { name: 'x', nameAr: 'x', price: 1 }, admin)
        ).rejects.toThrow('shop.error.notFound');
        expect(db.product.create).not.toHaveBeenCalled();
    });
});

describe('merchant module: a deleted shop is invisible to its merchant', () => {
    it('resolves only a live shop', async () => {
        const db = { shop: { findFirst: jest.fn().mockResolvedValue(null) } };
        const service = new MerchantService(
            db as unknown as DatabaseService,
            {} as ShopsService,
            {} as ProductsService,
            {} as OrdersService
        );
        await expect(service.getMyShop(merchant)).rejects.toBeInstanceOf(
            NotFoundException
        );
        expect(db.shop.findFirst.mock.calls[0][0].where).toEqual({
            merchantId: 'merchant-1',
            deletedAt: null,
        });
    });
});

describe('orders: a deleted shop or product cannot be ordered', () => {
    const db = {
        product: { findMany: jest.fn() },
        shop: { findUnique: jest.fn() },
        order: { create: jest.fn() },
    };
    const service = new OrdersService(
        db as unknown as DatabaseService,
        {} as OrdersGateway,
        {} as NotificationsService,
        { get: jest.fn() } as unknown as ConfigService,
        asAudit
    );
    const dto = { items: [{ productId: 'p1', quantity: 1 }], deliveryUnit: 'A-1-2' };

    it('only live products of live shops are orderable', async () => {
        db.product.findMany.mockResolvedValue([]);
        await expect(service.create(dto, resident)).rejects.toThrow(
            'order.error.someProductsUnavailable'
        );
        expect(db.product.findMany.mock.calls[0][0].where).toEqual({
            id: { in: ['p1'] },
            isDeleted: false,
            isAvailable: true,
            shop: { deletedAt: null },
        });
    });

    it('a shop deleted between the two reads is a 404, no order created', async () => {
        db.product.findMany.mockResolvedValue([
            { id: 'p1', shopId: 's1', price: 10, name: 'x', nameAr: 'x' },
        ]);
        db.shop.findUnique.mockResolvedValue({ isOpen: true, deletedAt: new Date() });
        await expect(service.create(dto, resident)).rejects.toThrow(
            'shop.error.notFound'
        );
        expect(db.order.create).not.toHaveBeenCalled();
    });
});
