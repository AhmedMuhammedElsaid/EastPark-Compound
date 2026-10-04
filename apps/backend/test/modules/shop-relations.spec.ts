import {
    ForbiddenException,
    NotFoundException,
} from '@nestjs/common';
import { Role } from '@prisma/client';

import { DatabaseService } from 'src/common/database/services/database.service';
import { AuditService } from 'src/modules/audit/audit.service';
import { ProductsService } from 'src/modules/products/products.service';
import { ReviewsService } from 'src/modules/shops/reviews.service';
import { SavedShopsService } from 'src/modules/shops/saved-shops.service';

const fkViolation = { code: 'P2003' };
const admin = { userId: 'admin-1', role: Role.ADMIN };
const merchant = { userId: 'merchant-1', role: Role.MERCHANT };

const audit = { record: jest.fn() } as unknown as AuditService;

describe('unknown shop ids return 404 instead of a foreign-key 500', () => {
    const db = {
        review: { upsert: jest.fn(), findUnique: jest.fn() },
        savedShop: { upsert: jest.fn() },
        shop: { findUnique: jest.fn() },
        product: { create: jest.fn() },
    };
    const asDb = db as unknown as DatabaseService;

    beforeEach(() => jest.clearAllMocks());

    it('review upsert on a missing shop', async () => {
        db.shop.findUnique.mockResolvedValue(null);
        await expect(
            new ReviewsService(asDb).upsert('nope', 'user-1', { rating: 5 })
        ).rejects.toBeInstanceOf(NotFoundException);
        expect(db.review.upsert).not.toHaveBeenCalled();
    });

    it('review upsert when the shop vanishes before the insert (FK)', async () => {
        db.shop.findUnique.mockResolvedValue({ deletedAt: null });
        db.review.findUnique.mockResolvedValue(null);
        db.review.upsert.mockRejectedValue(fkViolation);
        await expect(
            new ReviewsService(asDb).upsert('nope', 'user-1', { rating: 5 })
        ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('saving a missing shop', async () => {
        db.shop.findUnique.mockResolvedValue({ deletedAt: null });
        db.savedShop.upsert.mockRejectedValue(fkViolation);
        await expect(
            new SavedShopsService(asDb).saveShop('nope', 'user-1')
        ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('admin creating a product in a missing shop', async () => {
        db.shop.findUnique.mockResolvedValue(null);
        await expect(
            new ProductsService(asDb, audit).create(
                'nope',
                { name: 'x', nameAr: 'x', price: 1 },
                admin
            )
        ).rejects.toBeInstanceOf(NotFoundException);
        expect(db.product.create).not.toHaveBeenCalled();
    });

    it('merchant creating a product in someone else’s shop', async () => {
        db.shop.findUnique.mockResolvedValue({ merchantId: 'other' });
        await expect(
            new ProductsService(asDb, audit).create(
                'shop-1',
                { name: 'x', nameAr: 'x', price: 1 },
                merchant
            )
        ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('other errors still propagate', async () => {
        db.shop.findUnique.mockResolvedValue({ deletedAt: null });
        db.review.findUnique.mockResolvedValue(null);
        db.review.upsert.mockRejectedValue(new Error('db down'));
        await expect(
            new ReviewsService(asDb).upsert('shop-1', 'user-1', { rating: 5 })
        ).rejects.toThrow('db down');
    });
});
