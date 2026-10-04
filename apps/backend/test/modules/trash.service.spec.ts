import {
    ConflictException,
    ExecutionContext,
    ForbiddenException,
    NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { DatabaseService } from 'src/common/database/services/database.service';
import { RolesGuard } from 'src/common/request/guards/roles.guard';
import { AUDIT_ACTIONS } from 'src/modules/audit/audit.actions';
import { AuditService } from 'src/modules/audit/audit.service';
import {
    TrashQueryDto,
    TrashRestoreParamsDto,
} from 'src/modules/trash/dtos/trash.request.dto';
import { TrashAdminController } from 'src/modules/trash/trash.admin.controller';
import { TrashService } from 'src/modules/trash/trash.service';
import { UserAdminController } from 'src/modules/user/controllers/user.admin.controller';
import { deletedUserEmail } from 'src/modules/user/services/user.service';

const superAdmin = { userId: 'owner-1', role: Role.SUPER_ADMIN };
const deletedAt = new Date('2026-10-04T10:00:00Z');
const owner = { id: 'owner-1', name: 'Ahmed' };

function model() {
    return {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
    };
}

const db = {
    user: model(),
    shop: model(),
    shopPhoto: model(),
    product: model(),
    review: model(),
};
const audit = { record: jest.fn() };
const service = new TrashService(
    db as unknown as DatabaseService,
    audit as unknown as AuditService
);

const liveShop = { name: 'Cafe', deletedAt: null };
const deadShop = { name: 'Cafe', deletedAt: new Date() };

beforeEach(() => {
    jest.clearAllMocks();
    for (const m of Object.values(db)) m.update.mockResolvedValue({});
});

describe('TrashService.list', () => {
    it('lists deleted users newest first with cursor pagination and the TrashItem shape', async () => {
        db.user.findMany.mockResolvedValue([
            {
                id: 'u1',
                name: 'Sara',
                email: 'sara@x.com',
                role: Role.RESIDENT,
                unitNumber: 'B1-2-3',
                deletedAt,
                deletedBy: owner,
            },
            {
                id: 'u2',
                name: 'Deleted user',
                email: deletedUserEmail('u2'),
                role: Role.GUEST,
                unitNumber: null,
                deletedAt,
                deletedBy: null,
            },
            { id: 'u3', name: 'x', email: 'x@x.com', role: Role.RESIDENT, unitNumber: null, deletedAt, deletedBy: null },
        ]);

        const page = await service.list({ type: 'USER', limit: 2, cursor: 'u0' });

        const args = db.user.findMany.mock.calls[0][0];
        expect(args.where).toEqual({ deletedAt: { not: null } });
        expect(args.orderBy).toEqual([{ deletedAt: 'desc' }, { id: 'desc' }]);
        expect(args.take).toBe(3);
        expect(args.cursor).toEqual({ id: 'u0' });
        expect(args.skip).toBe(1);
        // Never leaks password hashes or phone numbers.
        expect(args.select.passwordHash).toBeUndefined();
        expect(args.select.phone).toBeUndefined();

        expect(page.nextCursor).toBe('u2');
        expect(page.items).toEqual([
            {
                type: 'USER',
                id: 'u1',
                label: 'Sara (sara@x.com)',
                sublabel: 'RESIDENT · B1-2-3',
                deletedAt,
                deletedBy: { id: 'owner-1', name: 'Ahmed' },
                restorable: true,
                reason: null,
            },
            {
                type: 'USER',
                id: 'u2',
                label: `Deleted user (${deletedUserEmail('u2')})`,
                sublabel: 'GUEST',
                deletedAt,
                deletedBy: null,
                restorable: false,
                reason: 'user.error.notRestorable',
            },
        ]);
    });

    it('last page has no nextCursor', async () => {
        db.shop.findMany.mockResolvedValue([
            { id: 's1', name: 'Cafe', nameAr: 'مقهى', deletedAt, deletedBy: owner },
        ]);
        const page = await service.list({ type: 'SHOP' });
        expect(page.nextCursor).toBeUndefined();
        expect(page.items[0]).toEqual(
            expect.objectContaining({
                type: 'SHOP',
                label: 'Cafe',
                sublabel: 'مقهى',
                restorable: true,
            })
        );
    });

    it('children of a deleted shop are listed as not restorable (parentDeleted)', async () => {
        db.shopPhoto.findMany.mockResolvedValue([
            { id: 'p1', url: 'https://x/p.jpg', deletedAt, deletedBy: null, shop: deadShop },
        ]);
        db.product.findMany.mockResolvedValue([
            { id: 'pr1', name: 'Latte', nameAr: 'لاتيه', deletedAt, deletedBy: null, shop: liveShop },
        ]);
        db.review.findMany.mockResolvedValue([
            {
                id: 'r1',
                rating: 4,
                comment: 'Nice',
                userId: 'u1',
                shopId: 's1',
                deletedAt,
                deletedBy: null,
                user: { name: 'Sara' },
                shop: deadShop,
            },
        ]);

        const photos = await service.list({ type: 'SHOP_PHOTO' });
        expect(photos.items[0]).toEqual(
            expect.objectContaining({
                label: 'Cafe photo',
                sublabel: 'https://x/p.jpg',
                restorable: false,
                reason: 'trash.error.parentDeleted',
            })
        );
        const products = await service.list({ type: 'PRODUCT' });
        expect(products.items[0]).toEqual(
            expect.objectContaining({
                label: 'Latte — Cafe',
                restorable: true,
                reason: null,
            })
        );
        const reviews = await service.list({ type: 'REVIEW' });
        expect(reviews.items[0]).toEqual(
            expect.objectContaining({
                label: '4★ by Sara — Cafe',
                sublabel: 'Nice',
                restorable: false,
                reason: 'trash.error.parentDeleted',
            })
        );
    });
});

describe('TrashService.restore', () => {
    it('restores a user: clears deletedAt/deletedById atomically, audits USER_RESTORED', async () => {
        db.user.findUnique.mockResolvedValue({
            id: 'u1',
            name: 'Sara',
            email: 'sara@x.com',
            role: Role.RESIDENT,
            unitNumber: null,
            deletedAt,
            deletedBy: owner,
        });

        const result = await service.restore('USER', 'u1', superAdmin);

        expect(db.user.update).toHaveBeenCalledWith({
            where: { id: 'u1', deletedAt: { not: null } },
            data: { deletedAt: null, deletedById: null },
        });
        expect(result).toEqual({
            type: 'USER',
            id: 'u1',
            label: 'Sara (sara@x.com)',
            sublabel: 'RESIDENT',
            deletedAt: null,
            deletedBy: null,
            restorable: true,
            reason: null,
        });
        expect(audit.record).toHaveBeenCalledWith(
            superAdmin,
            'USER_RESTORED',
            'User',
            'u1',
            { label: 'Sara (sara@x.com)' }
        );
    });

    it('a legacy anonymised account is 409 notRestorable', async () => {
        db.user.findUnique.mockResolvedValue({
            id: 'u2',
            name: 'Deleted user',
            email: deletedUserEmail('u2'),
            role: Role.GUEST,
            unitNumber: null,
            deletedAt,
            deletedBy: null,
        });
        const attempt = service.restore('USER', 'u2', superAdmin);
        await expect(attempt).rejects.toBeInstanceOf(ConflictException);
        await expect(attempt).rejects.toThrow('user.error.notRestorable');
        expect(db.user.update).not.toHaveBeenCalled();
        expect(audit.record).not.toHaveBeenCalled();
    });

    it('unknown or not-deleted records are 404', async () => {
        db.shop.findUnique.mockResolvedValueOnce(null);
        await expect(service.restore('SHOP', 'nope', superAdmin)).rejects.toThrow(
            new NotFoundException('trash.error.notFound')
        );
        db.shop.findUnique.mockResolvedValueOnce({
            id: 's1',
            name: 'Cafe',
            nameAr: 'مقهى',
            deletedAt: null,
            deletedBy: null,
        });
        await expect(service.restore('SHOP', 's1', superAdmin)).rejects.toBeInstanceOf(
            NotFoundException
        );
        expect(db.shop.update).not.toHaveBeenCalled();
    });

    it('a concurrent restore that already won is a 404, audited once', async () => {
        db.shop.findUnique.mockResolvedValue({
            id: 's1',
            name: 'Cafe',
            nameAr: 'مقهى',
            deletedAt,
            deletedBy: owner,
        });
        db.shop.update.mockRejectedValue({ code: 'P2025' });
        await expect(service.restore('SHOP', 's1', superAdmin)).rejects.toBeInstanceOf(
            NotFoundException
        );
        expect(audit.record).not.toHaveBeenCalled();
    });

    it('restores a shop (SHOP_RESTORED)', async () => {
        db.shop.findUnique.mockResolvedValue({
            id: 's1',
            name: 'Cafe',
            nameAr: 'مقهى',
            deletedAt,
            deletedBy: owner,
        });
        const result = await service.restore('SHOP', 's1', superAdmin);
        expect(db.shop.update).toHaveBeenCalledWith({
            where: { id: 's1', deletedAt: { not: null } },
            data: { deletedAt: null, deletedById: null },
        });
        expect(result.deletedAt).toBeNull();
        expect(audit.record).toHaveBeenCalledWith(
            superAdmin,
            'SHOP_RESTORED',
            'Shop',
            's1',
            { label: 'Cafe' }
        );
    });

    it('restores a product and clears isDeleted too (PRODUCT_RESTORED)', async () => {
        db.product.findUnique.mockResolvedValue({
            id: 'pr1',
            name: 'Latte',
            nameAr: 'لاتيه',
            deletedAt,
            deletedBy: owner,
            shop: liveShop,
        });
        await service.restore('PRODUCT', 'pr1', superAdmin);
        expect(db.product.update).toHaveBeenCalledWith({
            where: { id: 'pr1', deletedAt: { not: null } },
            data: { isDeleted: false, deletedAt: null, deletedById: null },
        });
        expect(audit.record).toHaveBeenCalledWith(
            superAdmin,
            'PRODUCT_RESTORED',
            'Product',
            'pr1',
            { label: 'Latte — Cafe' }
        );
    });

    it('a photo, product or review of a deleted shop is 409 parentDeleted', async () => {
        db.shopPhoto.findUnique.mockResolvedValue({
            id: 'p1',
            url: 'u',
            deletedAt,
            deletedBy: null,
            shop: deadShop,
        });
        db.product.findUnique.mockResolvedValue({
            id: 'pr1',
            name: 'Latte',
            nameAr: 'x',
            deletedAt,
            deletedBy: null,
            shop: deadShop,
        });
        db.review.findUnique.mockResolvedValue({
            id: 'r1',
            rating: 5,
            comment: null,
            userId: 'u1',
            shopId: 's1',
            deletedAt,
            deletedBy: null,
            user: { name: 'Sara' },
            shop: deadShop,
        });
        for (const [type, id] of [
            ['SHOP_PHOTO', 'p1'],
            ['PRODUCT', 'pr1'],
            ['REVIEW', 'r1'],
        ] as const) {
            const attempt = service.restore(type, id, superAdmin);
            await expect(attempt).rejects.toBeInstanceOf(ConflictException);
            await expect(attempt).rejects.toThrow('trash.error.parentDeleted');
        }
        expect(db.shopPhoto.update).not.toHaveBeenCalled();
        expect(db.product.update).not.toHaveBeenCalled();
        expect(db.review.update).not.toHaveBeenCalled();
    });

    it('restores a photo (SHOP_PHOTO_RESTORED, entity ShopPhoto)', async () => {
        db.shopPhoto.findUnique.mockResolvedValue({
            id: 'p1',
            url: 'u',
            deletedAt,
            deletedBy: null,
            shop: liveShop,
        });
        await service.restore('SHOP_PHOTO', 'p1', superAdmin);
        expect(audit.record).toHaveBeenCalledWith(
            superAdmin,
            'SHOP_PHOTO_RESTORED',
            'ShopPhoto',
            'p1',
            { label: 'Cafe photo' }
        );
    });

    describe('reviews', () => {
        const deletedReview = {
            id: 'r1',
            rating: 5,
            comment: 'Great',
            userId: 'u1',
            shopId: 's1',
            deletedAt,
            deletedBy: null,
            user: { name: 'Sara' },
            shop: liveShop,
        };

        it('restores a review (REVIEW_RESTORED)', async () => {
            db.review.findUnique.mockResolvedValue(deletedReview);
            db.review.findFirst.mockResolvedValue(null);
            await service.restore('REVIEW', 'r1', superAdmin);
            expect(db.review.findFirst).toHaveBeenCalledWith({
                where: { userId: 'u1', shopId: 's1', deletedAt: null, id: { not: 'r1' } },
                select: { id: true },
            });
            expect(db.review.update).toHaveBeenCalledWith({
                where: { id: 'r1', deletedAt: { not: null } },
                data: { deletedAt: null, deletedById: null },
            });
            expect(audit.record).toHaveBeenCalledWith(
                superAdmin,
                'REVIEW_RESTORED',
                'Review',
                'r1',
                { label: '5★ by Sara — Cafe' }
            );
        });

        it('409 conflict when the user already has a live review for that shop', async () => {
            db.review.findUnique.mockResolvedValue(deletedReview);
            db.review.findFirst.mockResolvedValue({ id: 'r2' });
            const attempt = service.restore('REVIEW', 'r1', superAdmin);
            await expect(attempt).rejects.toBeInstanceOf(ConflictException);
            await expect(attempt).rejects.toThrow('trash.error.conflict');
            expect(db.review.update).not.toHaveBeenCalled();
        });
    });
});

describe('trash DTO validation', () => {
    const errors = async (cls: new () => object, payload: object) =>
        (await validate(plainToInstance(cls, payload))).length;

    it('type is required and must be a known type', async () => {
        expect(await errors(TrashQueryDto, { type: 'REVIEW' })).toBe(0);
        expect(await errors(TrashQueryDto, {})).toBe(1);
        expect(await errors(TrashQueryDto, { type: 'ORDER' })).toBe(1);
        expect(await errors(TrashQueryDto, { type: 'USER', limit: '51' })).toBe(1);
        expect(await errors(TrashRestoreParamsDto, { type: 'SHOP', id: 's1' })).toBe(0);
        expect(await errors(TrashRestoreParamsDto, { type: 'shop', id: 's1' })).toBe(1);
    });

    it('the restored audit actions are part of the fixed list', () => {
        for (const action of [
            'USER_RESTORED',
            'SHOP_RESTORED',
            'SHOP_PHOTO_RESTORED',
            'PRODUCT_RESTORED',
            'REVIEW_RESTORED',
        ]) {
            expect(AUDIT_ACTIONS).toContain(action);
        }
    });
});

describe('SUPER_ADMIN-only routes', () => {
    const guard = new RolesGuard(new Reflector());
    const context = (
        handler: (...args: never[]) => unknown,
        cls: abstract new (...args: never[]) => unknown,
        role: Role
    ) =>
        ({
            getHandler: () => handler,
            getClass: () => cls,
            switchToHttp: () => ({
                getRequest: () => ({ user: { userId: 'x', role } }),
            }),
        }) as unknown as ExecutionContext;

    const routes = [
        [TrashAdminController.prototype.list, TrashAdminController],
        [TrashAdminController.prototype.restore, TrashAdminController],
        [UserAdminController.prototype.deleteUser, UserAdminController],
    ] as const;

    it('admits the SUPER_ADMIN', () => {
        for (const [handler, cls] of routes) {
            expect(guard.canActivate(context(handler, cls, Role.SUPER_ADMIN))).toBe(
                true
            );
        }
    });

    it('refuses ADMIN, MERCHANT and RESIDENT', () => {
        for (const [handler, cls] of routes) {
            for (const role of [Role.ADMIN, Role.MERCHANT, Role.RESIDENT]) {
                expect(() => guard.canActivate(context(handler, cls, role))).toThrow(
                    ForbiddenException
                );
            }
        }
    });
});
