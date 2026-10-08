import { BadRequestException, ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Role, ShopCategory } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { SessionVersionService } from 'src/common/auth/services/session-version.service';
import { roleSatisfies } from 'src/common/auth/utils/roles';
import { DatabaseService } from 'src/common/database/services/database.service';
import { ROLES_DECORATOR_KEY } from 'src/common/request/constants/request.constant';
import { AuditService } from 'src/modules/audit/audit.service';
import { ShopCreateDto } from 'src/modules/shops/dtos/request/shop.create.dto';
import { ShopsController } from 'src/modules/shops/shops.controller';
import { ShopsService } from 'src/modules/shops/shops.service';
import { UserAdminController } from 'src/modules/user/controllers/user.admin.controller';
import { AdminMerchantQueryDto } from 'src/modules/user/dtos/request/user.admin.request';
import { UserService } from 'src/modules/user/services/user.service';

const rolesOf = (handler: unknown): Role[] =>
    Reflect.getMetadata(ROLES_DECORATOR_KEY, handler as object) as Role[];

describe('GET /admin/user/merchants', () => {
    const db = { user: { findMany: jest.fn() } };
    const service = new UserService(
        db as unknown as DatabaseService,
        {} as SessionVersionService,
        {} as ConfigService,
        {} as AuditService
    );
    beforeEach(() => jest.clearAllMocks());

    it('is ADMIN-only, and a SUPER_ADMIN passes', () => {
        const roles = rolesOf(UserAdminController.prototype.listMerchants);
        expect(roles).toEqual([Role.ADMIN]);
        expect(roles.some(r => roleSatisfies(Role.SUPER_ADMIN, r))).toBe(true);
        for (const role of [Role.MERCHANT, Role.RESIDENT]) {
            expect(roles.some(r => roleSatisfies(role, r))).toBe(false);
        }
    });

    it('lists live merchants only, selecting id/name/email and the live shop', async () => {
        db.user.findMany.mockResolvedValue([]);
        await service.listMerchants({ limit: 20, q: 'sam' });
        const args = db.user.findMany.mock.calls[0][0];
        expect(args.where).toEqual({
            role: Role.MERCHANT,
            deletedAt: null,
            NOT: { email: { endsWith: '@deleted.invalid' } },
            OR: [
                { name: { contains: 'sam', mode: 'insensitive' } },
                { email: { contains: 'sam', mode: 'insensitive' } },
            ],
        });
        expect(args.take).toBe(21);
        expect(Object.keys(args.select).sort()).toEqual(['email', 'id', 'name', 'shops']);
        expect(args.select.shops).toEqual({
            where: { deletedAt: null },
            orderBy: { createdAt: 'asc' },
            take: 1,
            select: { id: true, name: true, nameAr: true },
        });
    });

    it('maps the shop (or null) and pages by the last returned row', async () => {
        db.user.findMany.mockResolvedValue([
            { id: 'm1', name: 'Mona', email: 'm1@x.test', shops: [{ id: 's1', name: 'Cafe', nameAr: 'كافيه' }] },
            { id: 'm2', name: 'Omar', email: 'm2@x.test', shops: [] },
            { id: 'm3', name: 'Extra', email: 'm3@x.test', shops: [] },
        ]);
        const page = await service.listMerchants({ limit: 2, cursor: 'm0' });
        expect(db.user.findMany.mock.calls[0][0]).toMatchObject({ skip: 1, cursor: { id: 'm0' }, take: 3 });
        expect(page).toEqual({
            items: [
                { id: 'm1', name: 'Mona', email: 'm1@x.test', shop: { id: 's1', name: 'Cafe', nameAr: 'كافيه' } },
                { id: 'm2', name: 'Omar', email: 'm2@x.test', shop: null },
            ],
            nextCursor: 'm2',
        });
    });

    it('validates the query (limit 1..50, q ≤ 100)', async () => {
        const errors = async (payload: Record<string, unknown>) =>
            (await validate(plainToInstance(AdminMerchantQueryDto, payload))).length;
        expect(await errors({ limit: '20', q: '  sam ' })).toBe(0);
        expect(await errors({ limit: '51' })).toBe(1);
        expect(await errors({ q: 'x'.repeat(101) })).toBe(1);
    });
});

describe('POST /shops (admin create)', () => {
    const db = {
        user: { findUnique: jest.fn() },
        shop: { count: jest.fn(), create: jest.fn() },
    };
    const audit = { record: jest.fn() };
    const service = new ShopsService(
        db as unknown as DatabaseService,
        audit as unknown as AuditService
    );
    const admin = { userId: 'admin-1', role: Role.ADMIN };
    const dto = {
        name: 'Cafe',
        nameAr: 'كافيه',
        category: ShopCategory.CAFE_AND_FOOD,
        merchantId: 'm1',
    } as ShopCreateDto;
    beforeEach(() => jest.clearAllMocks());

    it('stays ADMIN-only (SUPER_ADMIN passes)', () => {
        expect(rolesOf(ShopsController.prototype.create)).toEqual([Role.ADMIN]);
    });

    it('409s when the merchant already runs a live shop', async () => {
        db.user.findUnique.mockResolvedValue({ role: Role.MERCHANT, deletedAt: null });
        db.shop.count.mockResolvedValue(1);
        await expect(service.create(dto, admin)).rejects.toEqual(
            new ConflictException('shop.error.merchantHasShop')
        );
        expect(db.shop.count).toHaveBeenCalledWith({
            where: { merchantId: 'm1', deletedAt: null },
        });
        expect(db.shop.create).not.toHaveBeenCalled();
    });

    it('creates when the merchant has no live shop (a soft-deleted one does not count)', async () => {
        db.user.findUnique.mockResolvedValue({ role: Role.MERCHANT, deletedAt: null });
        db.shop.count.mockResolvedValue(0);
        db.shop.create.mockResolvedValue({ id: 's1', name: 'Cafe', photos: [], _count: { reviews: 0 } });
        const shop = await service.create(dto, admin);
        expect(shop).toMatchObject({ id: 's1', reviewCount: 0, averageRating: null });
        expect(audit.record).toHaveBeenCalledWith(admin, 'SHOP_CREATED', 'Shop', 's1', { label: 'Cafe' });
    });

    it('still 400s for a non-merchant owner before the shop check', async () => {
        db.user.findUnique.mockResolvedValue({ role: Role.RESIDENT, deletedAt: null });
        await expect(service.create(dto, admin)).rejects.toEqual(
            new BadRequestException('shop.error.merchantInvalid')
        );
        expect(db.shop.count).not.toHaveBeenCalled();
    });
});
