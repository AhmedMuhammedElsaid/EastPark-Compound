import {
    BadRequestException,
    ConflictException,
    NotFoundException,
    ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import 'reflect-metadata';
import {
    ListingStatus,
    PaymentMethod,
    Role,
} from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { SessionVersionService } from 'src/common/auth/services/session-version.service';
import { DatabaseService } from 'src/common/database/services/database.service';
import { formatUnitLabel } from 'src/common/helper/utils/unit-label';
import { EmailService } from 'src/common/email/email.service';
import { ROLES_DECORATOR_KEY } from 'src/common/request/constants/request.constant';
import { AuditService } from 'src/modules/audit/audit.service';
import { OrdersService } from 'src/modules/orders/orders.service';
import { ResidentLeadCreateDto } from 'src/modules/residents/dtos/request/resident-lead.create.dto';
import { ResidentUnitCreateDto } from 'src/modules/units/dtos/resident-unit.dto';
import { ResidentUnitsAdminController } from 'src/modules/units/resident-units.admin.controller';
import { ResidentUnitsService } from 'src/modules/units/resident-units.service';
import { UserGetProfileResponseDto } from 'src/modules/user/dtos/response/user.response';
import { UserService } from 'src/modules/user/services/user.service';

const superAdmin = { userId: 'super-1', role: Role.SUPER_ADMIN };
const flat = { building: 'A1', floor: '3', flatNumber: '2' };
const unitRow = (overrides: Record<string, unknown> = {}) => ({
    id: 'unit-1',
    building: 'A1',
    floor: '3',
    flatNumber: '2',
    createdAt: new Date('2026-10-07T10:00:00.000Z'),
    ...overrides,
});

function buildUnitsDb() {
    const db = {
        user: {
            findUnique: jest.fn(),
            update: jest.fn(),
            updateMany: jest.fn(),
        },
        residentLead: { findFirst: jest.fn() },
        residentUnit: {
            findUnique: jest.fn(),
            findFirst: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            deleteMany: jest.fn(),
        },
        listing: { updateMany: jest.fn() },
        $queryRaw: jest.fn(),
        $transaction: jest.fn(),
    };
    db.$transaction.mockImplementation((fn: (tx: unknown) => unknown) =>
        fn(db)
    );
    return db;
}

// ─── Admin add / remove ───────────────────────────────────────────────────────

describe('ResidentUnitsAdminController roles', () => {
    it('PATCH /admin/resident-units/:id is SUPER_ADMIN only', () => {
        const roles = Reflect.getMetadata(
            ROLES_DECORATOR_KEY,
            ResidentUnitsAdminController.prototype.updateKey
        ) as Role[];
        expect(roles).toEqual([Role.SUPER_ADMIN]);
    });
});

describe('ResidentUnitsService', () => {
    const db = buildUnitsDb();
    const email = { sendUnitAdded: jest.fn() };
    const audit = { record: jest.fn() };
    const service = new ResidentUnitsService(
        db as unknown as DatabaseService,
        email as unknown as EmailService,
        audit as unknown as AuditService
    );

    const owner = {
        id: 'user-1',
        name: 'Sara',
        email: 'sara@example.com',
        deletedAt: null,
    };

    // Normalised key lookups go through $queryRaw (units vs leads by table name).
    let holders: { id: string; userId: string }[] = [];
    let activeLeads: { id: string }[] = [];

    beforeEach(() => {
        jest.clearAllMocks();
        holders = [];
        activeLeads = [];
        db.$queryRaw.mockImplementation((query: { sql: string }) =>
            Promise.resolve(
                query.sql.includes('resident_units') ? holders : activeLeads
            )
        );
        db.$transaction.mockImplementation((fn: (tx: unknown) => unknown) =>
            fn(db)
        );
        db.user.findUnique.mockResolvedValue(owner);
        db.residentUnit.findUnique.mockResolvedValue(null);
        db.residentUnit.create.mockResolvedValue(unitRow());
        db.user.updateMany.mockResolvedValue({ count: 1 });
        email.sendUnitAdded.mockResolvedValue(undefined);
    });

    describe('addToUser', () => {
        it('adds the flat, sets unitNumber only when null, audits UNIT_ADDED and mails the owner', async () => {
            const result = await service.addToUser('user-1', flat, superAdmin);

            expect(result).toEqual({
                id: 'unit-1',
                building: 'A1',
                floor: '3',
                flatNumber: '2',
                label: 'A1-3-2',
                createdAt: new Date('2026-10-07T10:00:00.000Z'),
            });
            expect(db.residentUnit.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: {
                        userId: 'user-1',
                        building: 'A1',
                        floor: '3',
                        flatNumber: '2',
                        addedById: 'super-1',
                    },
                })
            );
            expect(db.user.updateMany).toHaveBeenCalledWith({
                where: { id: 'user-1', unitNumber: null },
                data: { unitNumber: 'A1-3-2' },
            });
            expect(audit.record).toHaveBeenCalledWith(
                superAdmin,
                'UNIT_ADDED',
                'ResidentUnit',
                'unit-1',
                expect.objectContaining({
                    label: 'Sara (sara@example.com) · A1-3-2',
                })
            );
            expect(email.sendUnitAdded).toHaveBeenCalledWith(
                'sara@example.com',
                'Sara',
                'A1-3-2'
            );
        });

        it('checks active applications with PENDING/INVITED on the normalised key', async () => {
            await service.addToUser('user-1', flat, superAdmin);
            const leadQuery = db.$queryRaw.mock.calls
                .map(c => c[0] as { sql: string; values: unknown[] })
                .find(q => q.sql.includes('resident_leads'));
            expect(leadQuery?.sql).toContain("IN ('PENDING', 'INVITED')");
            expect(leadQuery?.sql).toContain(
                String.raw`upper(btrim("building", E' \t\r\n'))`
            );
            expect(leadQuery?.values).toEqual(
                expect.arrayContaining(['A1', '3', '2'])
            );
        });

        it.each([
            ['another account', 'user-2'],
            ['this account', 'user-1'],
        ])(
            '409 unit.error.alreadyOwned when %s owns the flat',
            async (_, ownerId) => {
                holders = [{ id: 'unit-9', userId: ownerId }];
                const attempt = service.addToUser('user-1', flat, superAdmin);
                await expect(attempt).rejects.toBeInstanceOf(ConflictException);
                await expect(attempt).rejects.toThrow(
                    'unit.error.alreadyOwned'
                );
                expect(db.residentUnit.create).not.toHaveBeenCalled();
                expect(email.sendUnitAdded).not.toHaveBeenCalled();
            }
        );

        it('409 residentLead.error.unitReserved when a PENDING/INVITED lead exists for the flat', async () => {
            activeLeads = [{ id: 'lead-1' }];
            const attempt = service.addToUser('user-1', flat, superAdmin);
            await expect(attempt).rejects.toBeInstanceOf(ConflictException);
            await expect(attempt).rejects.toThrow(
                'residentLead.error.unitReserved'
            );
            expect(db.residentUnit.create).not.toHaveBeenCalled();
        });

        it('maps a concurrent owner (P2002) to 409 alreadyOwned without audit or email', async () => {
            db.residentUnit.create.mockRejectedValueOnce({ code: 'P2002' });
            await expect(
                service.addToUser('user-1', flat, superAdmin)
            ).rejects.toThrow('unit.error.alreadyOwned');
            expect(audit.record).not.toHaveBeenCalled();
            expect(email.sendUnitAdded).not.toHaveBeenCalled();
        });
    });

    describe('removeFromUser', () => {
        const stored = (overrides: Record<string, unknown> = {}) => ({
            ...unitRow(),
            userId: 'user-1',
            user: {
                name: 'Sara',
                email: 'sara@example.com',
                unitNumber: 'A1-3-2',
            },
            ...overrides,
        });

        beforeEach(() => {
            db.residentUnit.findUnique.mockResolvedValue(stored());
            db.residentUnit.deleteMany.mockResolvedValue({ count: 1 });
            db.user.findUnique.mockResolvedValue({ unitNumber: 'A1-3-2' });
        });

        it('404 unit.error.notFound when the unit is missing', async () => {
            db.residentUnit.findUnique.mockResolvedValue(null);
            const attempt = service.removeFromUser(
                'user-1',
                'nope',
                superAdmin
            );
            await expect(attempt).rejects.toBeInstanceOf(NotFoundException);
            await expect(attempt).rejects.toThrow('unit.error.notFound');
        });

        it("404 unit.error.notFound for another account's unit (nothing deleted)", async () => {
            db.residentUnit.findUnique.mockResolvedValue(
                stored({ userId: 'user-2' })
            );
            await expect(
                service.removeFromUser('user-1', 'unit-1', superAdmin)
            ).rejects.toThrow('unit.error.notFound');
            expect(db.residentUnit.deleteMany).not.toHaveBeenCalled();
        });

        it('removing the primary flat promotes the oldest remaining flat', async () => {
            db.residentUnit.findFirst.mockResolvedValue(
                unitRow({
                    id: 'unit-2',
                    building: 'B2',
                    floor: 'G',
                    flatNumber: '5',
                })
            );

            await expect(
                service.removeFromUser('user-1', 'unit-1', superAdmin)
            ).resolves.toEqual({
                success: true,
                message: 'unit.success.removed',
            });

            expect(db.residentUnit.deleteMany).toHaveBeenCalledWith({
                where: { id: 'unit-1', userId: 'user-1' },
            });
            expect(db.residentUnit.findFirst).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { userId: 'user-1' },
                    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
                })
            );
            expect(db.user.update).toHaveBeenCalledWith({
                where: { id: 'user-1' },
                data: { unitNumber: 'B2-G-5' },
            });
            expect(audit.record).toHaveBeenCalledWith(
                superAdmin,
                'UNIT_REMOVED',
                'ResidentUnit',
                'unit-1',
                expect.objectContaining({
                    label: 'Sara (sara@example.com) · A1-3-2',
                })
            );
            expect(email.sendUnitAdded).not.toHaveBeenCalled();
        });

        it('withdraws the removed flat\'s open listing in the same transaction', async () => {
            db.residentUnit.findFirst.mockResolvedValue(null);
            await service.removeFromUser('user-1', 'unit-1', superAdmin);

            expect(db.listing.updateMany).toHaveBeenCalledWith({
                where: {
                    ownerId: 'user-1',
                    building: 'A1',
                    floor: '3',
                    flatNumber: '2',
                    status: { in: ['PENDING', 'APPROVED'] },
                },
                data: { status: 'WITHDRAWN' },
            });
            // Same tx as the unit delete (the mocked $transaction hands back db).
            expect(db.$transaction).toHaveBeenCalledTimes(1);
        });

        it('a concurrent removal does not withdraw any listing', async () => {
            db.residentUnit.deleteMany.mockResolvedValueOnce({ count: 0 });
            await expect(
                service.removeFromUser('user-1', 'unit-1', superAdmin)
            ).rejects.toThrow('unit.error.notFound');
            expect(db.listing.updateMany).not.toHaveBeenCalled();
        });

        it('removing the last (primary) flat clears unitNumber', async () => {
            db.residentUnit.findFirst.mockResolvedValue(null);
            await service.removeFromUser('user-1', 'unit-1', superAdmin);
            expect(db.user.update).toHaveBeenCalledWith({
                where: { id: 'user-1' },
                data: { unitNumber: null },
            });
        });

        it('removing a non-primary flat leaves unitNumber alone', async () => {
            db.user.findUnique.mockResolvedValue({ unitNumber: 'C1-1-1' });
            await service.removeFromUser('user-1', 'unit-1', superAdmin);
            expect(db.user.update).not.toHaveBeenCalled();
            expect(db.residentUnit.findFirst).not.toHaveBeenCalled();
        });

        it('works for a soft-deleted account (a sold flat can be freed)', async () => {
            db.residentUnit.findFirst.mockResolvedValue(null);
            // The owner lookup carries no deletedAt filter: removal never 404s on it.
            await expect(
                service.removeFromUser('user-1', 'unit-1', superAdmin)
            ).resolves.toMatchObject({ message: 'unit.success.removed' });
            expect(db.residentUnit.deleteMany).toHaveBeenCalled();
            const lookup = db.residentUnit.findUnique.mock.calls[0][0];
            expect(lookup.where).toEqual({ id: 'unit-1' });
        });

        it('a concurrent removal (0 rows deleted) is a 404', async () => {
            db.residentUnit.deleteMany.mockResolvedValueOnce({ count: 0 });
            await expect(
                service.removeFromUser('user-1', 'unit-1', superAdmin)
            ).rejects.toThrow('unit.error.notFound');
            expect(audit.record).not.toHaveBeenCalled();
        });
    });

    describe('updateKey', () => {
        const existing = (overrides: Record<string, unknown> = {}) => ({
            ...unitRow({ building: 'a1', floor: '3', flatNumber: '2' }),
            userId: 'user-1',
            user: { name: 'Sara', email: 'sara@example.com', unitNumber: 'a1-3-2' },
            ...overrides,
        });
        const target = { building: 'A2', floor: 'G', flatNumber: '4' };

        beforeEach(() => {
            // findUnique = the unit being repaired; key holders come from $queryRaw.
            db.residentUnit.findUnique.mockReset().mockResolvedValue(existing());
            db.listing.updateMany.mockResolvedValue({ count: 0 });
            db.residentUnit.update.mockResolvedValue(
                unitRow({ building: 'A2', floor: 'G', flatNumber: '4' })
            );
        });

        it('re-keys the unit, follows the primary label and audits UNIT_KEY_CHANGED', async () => {
            const result = await service.updateKey('unit-1', target, superAdmin);

            expect(result.label).toBe('A2-G-4');
            expect(db.residentUnit.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: 'unit-1' },
                    data: { building: 'A2', floor: 'G', flatNumber: '4' },
                })
            );
            expect(db.user.updateMany).toHaveBeenCalledWith({
                where: { id: 'user-1', unitNumber: 'a1-3-2' },
                data: { unitNumber: 'A2-G-4' },
            });
            expect(audit.record).toHaveBeenCalledWith(
                superAdmin,
                'UNIT_KEY_CHANGED',
                'ResidentUnit',
                'unit-1',
                expect.objectContaining({ from: 'a1-3-2', to: 'A2-G-4' })
            );
        });

        it('normalises a sloppy key before checking it', async () => {
            await service.updateKey(
                'unit-1',
                { building: ' a2 ', floor: 'g', flatNumber: '4' },
                superAdmin
            );
            expect(db.residentUnit.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: { building: 'A2', floor: 'G', flatNumber: '4' },
                })
            );
        });

        it.each([
            { building: 'Building A', floor: '3', flatNumber: '2' },
            { building: 'A1', floor: 'G', flatNumber: '2' },
            { building: 'D2', floor: '3', flatNumber: '2' },
        ])('refuses an unknown flat %j (400 unknownFlat)', async key => {
            await expect(
                service.updateKey('unit-1', key, superAdmin)
            ).rejects.toThrow('unit.error.unknownFlat');
            expect(db.residentUnit.update).not.toHaveBeenCalled();
            expect(audit.record).not.toHaveBeenCalled();
        });

        it('refuses a key held by another unit (409 alreadyOwned)', async () => {
            holders = [{ id: 'unit-2', userId: 'user-2' }];
            await expect(
                service.updateKey('unit-1', target, superAdmin)
            ).rejects.toThrow('unit.error.alreadyOwned');
            expect(db.residentUnit.update).not.toHaveBeenCalled();
        });

        it('a legacy non-canonical holder (a2 / G / 4 on another unit) still blocks the re-key', async () => {
            // The normalised lookup returns the stored `a2 ` row; exact matching would miss it.
            holders = [{ id: 'unit-legacy', userId: 'user-3' }];
            await expect(
                service.updateKey(
                    'unit-1',
                    { building: ' a2 ', floor: 'g', flatNumber: '4' },
                    superAdmin
                )
            ).rejects.toThrow('unit.error.alreadyOwned');
            const unitQuery = db.$queryRaw.mock.calls
                .map(c => c[0] as { sql: string; values: unknown[] })
                .find(q => q.sql.includes('resident_units'));
            expect(unitQuery?.sql).toContain(
                String.raw`upper(btrim("building", E' \t\r\n'))`
            );
            expect(unitQuery?.values).toEqual(['A2', 'G', '4']);
            expect(db.residentUnit.update).not.toHaveBeenCalled();
        });

        it('the unit itself matching its own normalised key is not a conflict', async () => {
            holders = [{ id: 'unit-1', userId: 'user-1' }];
            await expect(
                service.updateKey('unit-1', target, superAdmin)
            ).resolves.toMatchObject({ label: 'A2-G-4' });
        });

        it('withdraws the owner\'s open listings on the old key inside the transaction', async () => {
            await service.updateKey('unit-1', target, superAdmin);
            expect(db.listing.updateMany).toHaveBeenCalledWith({
                where: {
                    ownerId: 'user-1',
                    building: 'a1',
                    floor: '3',
                    flatNumber: '2',
                    status: {
                        in: [ListingStatus.PENDING, ListingStatus.APPROVED],
                    },
                },
                data: { status: ListingStatus.WITHDRAWN },
            });
        });

        it('writes no listing change when the re-key fails', async () => {
            holders = [{ id: 'unit-2', userId: 'user-2' }];
            await expect(
                service.updateKey('unit-1', target, superAdmin)
            ).rejects.toThrow('unit.error.alreadyOwned');
            expect(db.listing.updateMany).not.toHaveBeenCalled();
        });

        it('audit meta carries the label, ids and keys but no phone, national id or passport', async () => {
            await service.updateKey('unit-1', target, superAdmin);
            const meta = audit.record.mock.calls[0]?.[4] as Record<string, unknown>;
            expect(Object.keys(meta).sort()).toEqual(
                ['from', 'label', 'to', 'userId'].sort()
            );
        });

        it('refuses a flat with an active application (409 unitReserved)', async () => {
            activeLeads = [{ id: 'lead-9' }];
            await expect(
                service.updateKey('unit-1', target, superAdmin)
            ).rejects.toThrow('residentLead.error.unitReserved');
            expect(db.residentUnit.update).not.toHaveBeenCalled();
        });

        it('a lost unique race is a 409 alreadyOwned', async () => {
            db.residentUnit.update.mockRejectedValue(
                Object.assign(new Error('unique'), { code: 'P2002' })
            );
            await expect(
                service.updateKey('unit-1', target, superAdmin)
            ).rejects.toThrow('unit.error.alreadyOwned');
            expect(audit.record).not.toHaveBeenCalled();
        });

        it('404 when the unit does not exist', async () => {
            db.residentUnit.findUnique.mockReset().mockResolvedValue(null);
            await expect(
                service.updateKey('nope', target, superAdmin)
            ).rejects.toThrow('unit.error.notFound');
        });

        it('is a no-op (no write, no audit) when the key is unchanged', async () => {
            db.residentUnit.findUnique
                .mockReset()
                .mockResolvedValueOnce(
                    existing({ building: 'A2', floor: 'G', flatNumber: '4' })
                );
            await service.updateKey('unit-1', target, superAdmin);
            expect(db.residentUnit.update).not.toHaveBeenCalled();
            expect(audit.record).not.toHaveBeenCalled();
        });
    });
});

// ─── Admin add DTO (same validators as the lead form) ─────────────────────────

describe('ResidentUnitCreateDto', () => {
    const errorsFor = async (body: Record<string, unknown>) =>
        (await validate(plainToInstance(ResidentUnitCreateDto, body))).map(
            e => e.property
        );

    it('accepts the lead form values', async () => {
        await expect(errorsFor(flat)).resolves.toEqual([]);
        await expect(
            errorsFor({ building: 'B2', floor: 'G', flatNumber: '5' })
        ).resolves.toEqual([]);
    });

    it('trims building, so "A1 " and "A1" are the same flat (same unique key)', () => {
        const padded = plainToInstance(ResidentUnitCreateDto, {
            ...flat,
            building: ' A1 ',
        });
        expect(padded.building).toBe('A1');
        expect(formatUnitLabel(padded)).toBe(formatUnitLabel(flat));
        const lead = plainToInstance(ResidentLeadCreateDto, {
            building: 'A1 ',
        });
        expect(lead.building).toBe('A1');
    });

    it('a whitespace-only building is empty after trimming', async () => {
        await expect(errorsFor({ ...flat, building: '   ' })).resolves.toEqual([
            'building',
        ]);
    });

    it('rejects spellings the lead form rejects', async () => {
        await expect(
            errorsFor({ building: '', floor: '03', flatNumber: '6' })
        ).resolves.toEqual(['building', 'floor', 'flatNumber']);
        await expect(
            errorsFor({ building: 'A1', floor: '12', flatNumber: '0' })
        ).resolves.toEqual(['floor', 'flatNumber']);
    });
});

// ─── Profile ──────────────────────────────────────────────────────────────────

describe('UserService.getProfile units', () => {
    const db = { user: { findUnique: jest.fn() } };
    const service = new UserService(
        db as unknown as DatabaseService,
        {} as SessionVersionService,
        {} as ConfigService,
        { record: jest.fn() } as unknown as AuditService
    );

    it('returns every owned flat oldest first with its label; unitNumber stays the primary', async () => {
        db.user.findUnique.mockResolvedValue({
            id: 'user-1',
            name: 'Sara',
            email: 'sara@example.com',
            unitNumber: 'A1-3-2',
            deletedAt: null,
            residentUnits: [
                unitRow(),
                unitRow({
                    id: 'unit-2',
                    building: 'B2',
                    floor: 'G',
                    flatNumber: '5',
                }),
            ],
        });

        const profile = await service.getProfile('user-1');

        expect(db.user.findUnique).toHaveBeenCalledWith({
            where: { id: 'user-1' },
            include: {
                residentUnits: {
                    select: {
                        id: true,
                        building: true,
                        floor: true,
                        flatNumber: true,
                        createdAt: true,
                    },
                    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
                },
            },
        });
        expect(profile.unitNumber).toBe('A1-3-2');
        expect(profile.units.map(u => u.label)).toEqual(['A1-3-2', 'B2-G-5']);
        expect(profile).not.toHaveProperty('residentUnits');
    });

    it('legacy account: units is empty, unitNumber unchanged', async () => {
        db.user.findUnique.mockResolvedValue({
            id: 'user-2',
            unitNumber: 'B1-301',
            deletedAt: null,
            residentUnits: [],
        });
        const profile = await service.getProfile('user-2');
        expect(profile.units).toEqual([]);
        expect(profile.unitNumber).toBe('B1-301');
    });

    it('the profile serializer keeps units (excludeExtraneousValues)', () => {
        const data = plainToInstance(
            UserGetProfileResponseDto,
            {
                id: 'user-1',
                name: 'Sara',
                email: 'sara@example.com',
                unitNumber: 'A1-3-2',
                passwordHash: 'secret',
                units: [{ ...unitRow(), label: 'A1-3-2', extra: 'drop me' }],
            },
            { excludeExtraneousValues: true }
        );
        expect(data.units).toHaveLength(1);
        expect(data.units[0]).toEqual({
            id: 'unit-1',
            building: 'A1',
            floor: '3',
            flatNumber: '2',
            label: 'A1-3-2',
            createdAt: new Date('2026-10-07T10:00:00.000Z'),
        });
        expect(data.passwordHash).toBeUndefined();
    });
});

// ─── Order delivery unit ──────────────────────────────────────────────────────

describe('OrdersService.create deliveryUnit', () => {
    const resident = { userId: 'resident-1', role: Role.RESIDENT };
    const db = {
        product: { findMany: jest.fn() },
        shop: { findUnique: jest.fn() },
        order: { create: jest.fn() },
        user: { findUnique: jest.fn() },
    };
    const service = new OrdersService(
        db as never,
        { emitStatusUpdate: jest.fn() } as never,
        { send: jest.fn() } as never,
        { get: jest.fn() } as never,
        { record: jest.fn() } as never
    );
    const dto = (deliveryUnit: string) => ({
        items: [{ productId: 'prod-1', quantity: 1 }],
        deliveryUnit,
        paymentMethod: PaymentMethod.CASH,
    });

    beforeEach(() => {
        jest.clearAllMocks();
        db.product.findMany.mockResolvedValue([
            {
                id: 'prod-1',
                shopId: 'shop-1',
                price: 10,
                name: 'Tea',
                nameAr: 'شاي',
            },
        ]);
        db.shop.findUnique.mockResolvedValue({ isOpen: true, deletedAt: null });
        db.order.create.mockResolvedValue({
            id: 'order-1',
            totalAmount: 10,
            items: [],
        });
        db.user.findUnique.mockResolvedValue({
            unitNumber: 'A1-3-2',
            residentUnits: [
                { building: 'A1', floor: '3', flatNumber: '2' },
                { building: 'B2', floor: 'G', flatNumber: '5' },
            ],
        });
    });

    it("accepts any of the caller's flat labels (trimmed) and stores the trimmed value", async () => {
        await service.create(dto('  B2-G-5 '), resident);
        expect(db.order.create.mock.calls[0][0].data.deliveryUnit).toBe(
            'B2-G-5'
        );
    });

    it('400 order.error.deliveryUnitInvalid for a flat the caller does not own', async () => {
        const attempt = service.create(dto('C1-1-1'), resident);
        await expect(attempt).rejects.toBeInstanceOf(BadRequestException);
        await expect(attempt).rejects.toThrow(
            'order.error.deliveryUnitInvalid'
        );
        expect(db.order.create).not.toHaveBeenCalled();
    });

    it('legacy account: unitNumber is always allowed with no flat rows', async () => {
        db.user.findUnique.mockResolvedValue({
            unitNumber: 'B1-301',
            residentUnits: [],
        });
        await service.create(dto('B1-301'), resident);
        expect(db.order.create.mock.calls[0][0].data.deliveryUnit).toBe(
            'B1-301'
        );
    });

    it('no flats and no unitNumber: nothing is deliverable', async () => {
        db.user.findUnique.mockResolvedValue({
            unitNumber: null,
            residentUnits: [],
        });
        await expect(service.create(dto('A1-3-2'), resident)).rejects.toThrow(
            'order.error.deliveryUnitInvalid'
        );
    });
});

// ─── PUT /user unitNumber = choose the primary flat ──────────────────────────

describe('UserService.updateUser unitNumber', () => {
    const db = {
        user: { findUnique: jest.fn(), update: jest.fn() },
        residentUnit: { findMany: jest.fn() },
    };
    const service = new UserService(
        db as unknown as DatabaseService,
        {} as SessionVersionService,
        {} as ConfigService,
        { record: jest.fn() } as unknown as AuditService
    );
    const owner = (unitNumber: string | null) => ({
        id: 'user-1',
        name: 'Sara',
        avatarUrl: null,
        unitNumber,
        deletedAt: null,
    });
    const owned = [
        { building: 'A1', floor: '3', flatNumber: '2' },
        { building: 'B2', floor: 'G', flatNumber: '5' },
    ];

    beforeEach(() => {
        jest.clearAllMocks();
        db.user.findUnique.mockResolvedValue(owner('A1-3-2'));
        db.residentUnit.findMany.mockResolvedValue(owned);
        db.user.update.mockResolvedValue({});
    });

    const sentData = () => db.user.update.mock.calls[0][0].data;

    it('unchanged value (old mobile builds send the whole form) is 200 and not rewritten', async () => {
        await service.updateUser('user-1', {
            name: 'Sara',
            unitNumber: ' A1-3-2 ',
        });
        expect(sentData()).toEqual({ name: 'Sara' });
        expect(db.residentUnit.findMany).not.toHaveBeenCalled();
    });

    it('switching the primary to another owned flat is stored (trimmed)', async () => {
        await service.updateUser('user-1', { unitNumber: 'B2-G-5 ' });
        expect(sentData()).toEqual({ unitNumber: 'B2-G-5' });
        expect(db.residentUnit.findMany).toHaveBeenCalledWith({
            where: { userId: 'user-1' },
            select: { building: true, floor: true, flatNumber: true },
        });
    });

    it.each([
        ['a flat the caller does not own', 'C1-1-1'],
        ['clearing it while flats are owned (null)', null],
        ['clearing it while flats are owned (empty)', '  '],
    ])('400 user.error.unitNotOwned for %s', async (_, unitNumber) => {
        const attempt = service.updateUser('user-1', { unitNumber });
        await expect(attempt).rejects.toBeInstanceOf(BadRequestException);
        await expect(attempt).rejects.toThrow('user.error.unitNotOwned');
        expect(db.user.update).not.toHaveBeenCalled();
    });

    it('legacy account (no flats): only the unchanged value is accepted', async () => {
        db.user.findUnique.mockResolvedValue(owner('B1-301'));
        db.residentUnit.findMany.mockResolvedValue([]);

        await service.updateUser('user-1', { unitNumber: 'B1-301' });
        expect(sentData()).toEqual({});

        await expect(
            service.updateUser('user-1', { unitNumber: 'B1-302' })
        ).rejects.toThrow('user.error.unitNotOwned');
        await expect(
            service.updateUser('user-1', { unitNumber: null })
        ).rejects.toThrow('user.error.unitNotOwned');
    });

    it('\'\' and null are the same "none" for an account without a primary', async () => {
        db.user.findUnique.mockResolvedValue(owner(null));
        await service.updateUser('user-1', { unitNumber: '' });
        expect(sentData()).toEqual({});
    });

    it('omitting unitNumber never touches it', async () => {
        await service.updateUser('user-1', { name: 'Sara' });
        expect(sentData()).toEqual({ name: 'Sara' });
        expect(db.residentUnit.findMany).not.toHaveBeenCalled();
    });
});
