import { ConflictException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Role } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { DatabaseService } from 'src/common/database/services/database.service';
import { AnnouncementsService } from 'src/modules/announcements/announcements.service';
import { ShopUpdateDto } from 'src/modules/shops/dtos/request/shop.update.dto';
import { ShopsService } from 'src/modules/shops/shops.service';

const db = {
    shop: { findUnique: jest.fn(), delete: jest.fn() },
    order: { count: jest.fn() },
    product: { count: jest.fn() },
    announcement: { findUnique: jest.fn() },
};

async function build<T>(token: new (...a: any[]) => T): Promise<T> {
    const m = await Test.createTestingModule({
        providers: [token, { provide: DatabaseService, useValue: db }],
    }).compile();
    return m.get(token);
}

describe('ShopsService.remove', () => {
    beforeEach(() => jest.clearAllMocks());

    it('409 when orders exist', async () => {
        const svc = await build(ShopsService);
        db.shop.findUnique.mockResolvedValue({ id: 's1' });
        db.order.count.mockResolvedValue(2);
        db.product.count.mockResolvedValue(0);
        await expect(svc.remove('s1')).rejects.toBeInstanceOf(ConflictException);
        expect(db.shop.delete).not.toHaveBeenCalled();
    });

    it('deletes when no dependents', async () => {
        const svc = await build(ShopsService);
        db.shop.findUnique.mockResolvedValue({ id: 's1' });
        db.order.count.mockResolvedValue(0);
        db.product.count.mockResolvedValue(0);
        await svc.remove('s1');
        expect(db.shop.delete).toHaveBeenCalled();
    });
});

describe('workingHours validation', () => {
    const check = (workingHours: unknown) =>
        validate(plainToInstance(ShopUpdateDto, { workingHours }));

    it('accepts valid hours', async () => {
        expect(
            await check({ mon: { open: '09:00', close: '22:30', closed: false } })
        ).toHaveLength(0);
    });
    it('rejects bad time', async () => {
        expect(
            (await check({ mon: { open: '9am', close: '22:00', closed: false } }))
                .length
        ).toBeGreaterThan(0);
    });
    it('rejects missing closed flag', async () => {
        expect(
            (await check({ mon: { open: '09:00', close: '22:00' } })).length
        ).toBeGreaterThan(0);
    });
});

describe('AnnouncementsService.findOne comment privacy', () => {
    const ann = {
        id: 'a1',
        comments: [
            {
                id: 'c1',
                body: 'hi',
                userId: 'u1',
                createdAt: new Date(),
                user: { id: 'u1', name: 'Sara Ali' },
            },
        ],
    };
    beforeEach(() => db.announcement.findUnique.mockResolvedValue(ann));

    it('guest: first name only, no ids', async () => {
        const svc = await build(AnnouncementsService);
        const r = await svc.findOne('a1');
        const c: any = r.comments[0];
        expect(c.userId).toBeUndefined();
        expect(c.user).toEqual({ name: 'Sara' });
    });

    it('other authenticated user: full name, no ids', async () => {
        const svc = await build(AnnouncementsService);
        const r = await svc.findOne('a1', { userId: 'u2', role: Role.RESIDENT });
        const c: any = r.comments[0];
        expect(c.userId).toBeUndefined();
        expect(c.user).toEqual({ name: 'Sara Ali' });
    });

    it('owner and admin see ids', async () => {
        const svc = await build(AnnouncementsService);
        for (const actor of [
            { userId: 'u1', role: Role.RESIDENT },
            { userId: 'ad', role: Role.ADMIN },
        ]) {
            const c: any = (await svc.findOne('a1', actor)).comments[0];
            expect(c.userId).toBe('u1');
            expect(c.user.id).toBe('u1');
        }
    });
});
