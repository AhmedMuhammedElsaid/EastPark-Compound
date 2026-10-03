import {
    ForbiddenException,
    NotFoundException,
} from '@nestjs/common';
import { Role } from '@prisma/client';

import { DatabaseService } from 'src/common/database/services/database.service';
import { ProductsService } from 'src/modules/products/products.service';
import { ReviewsService } from 'src/modules/shops/reviews.service';
import { SavedShopsService } from 'src/modules/shops/saved-shops.service';

const fkViolation = { code: 'P2003' };
const admin = { userId: 'admin-1', role: Role.ADMIN };
const merchant = { userId: 'merchant-1', role: Role.MERCHANT };

describe('unknown shop ids return 404 instead of a foreign-key 500', () => {
    const db = {
        review: { upsert: jest.fn() },
        savedShop: { upsert: jest.fn() },
        shop: { findUnique: jest.fn() },
        product: { create: jest.fn() },
    };
    const asDb = db as unknown as DatabaseService;

    beforeEach(() => jest.clearAllMocks());

    it('review upsert on a missing shop', async () => {
        db.review.upsert.mockRejectedValue(fkViolation);
        await expect(
            new ReviewsService(asDb).upsert('nope', 'user-1', { rating: 5 })
        ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('saving a missing shop', async () => {
        db.savedShop.upsert.mockRejectedValue(fkViolation);
        await expect(
            new SavedShopsService(asDb).saveShop('nope', 'user-1')
        ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('admin creating a product in a missing shop', async () => {
        db.shop.findUnique.mockResolvedValue(null);
        await expect(
            new ProductsService(asDb).create(
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
            new ProductsService(asDb).create(
                'shop-1',
                { name: 'x', nameAr: 'x', price: 1 },
                merchant
            )
        ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('other errors still propagate', async () => {
        db.review.upsert.mockRejectedValue(new Error('db down'));
        await expect(
            new ReviewsService(asDb).upsert('shop-1', 'user-1', { rating: 5 })
        ).rejects.toThrow('db down');
    });
});
