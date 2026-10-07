import {
    BadRequestException,
    ConflictException,
    NotFoundException,
    ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentMethod, ResidentLeadStatus, Role } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { SessionVersionService } from 'src/common/auth/services/session-version.service';
import { DatabaseService } from 'src/common/database/services/database.service';
import { formatUnitLabel } from 'src/common/helper/utils/unit-label';
import { EmailService } from 'src/common/email/email.service';
import { AuditService } from 'src/modules/audit/audit.service';
import { OrdersService } from 'src/modules/orders/orders.service';
import { ResidentLeadCreateDto } from 'src/modules/residents/dtos/request/resident-lead.create.dto';
import { ResidentUnitCreateDto } from 'src/modules/units/dtos/resident-unit.dto';
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
            deleteMany: jest.fn(),
        },
        $transaction: jest.fn(),
    };
    db.$transaction.mockImplementation((fn: (tx: unknown) => unknown) =>
        fn(db)
    );
    return db;
}

// ─── Admin add / remove ───────────────────────────────────────────────────────

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

    beforeEach(() => {
        jest.clearAllMocks();
        db.$transaction.mockImplementation((fn: (tx: unknown) => unknown) =>
            fn(db)
        );
        db.user.findUnique.mockResolvedValue(owner);
        db.residentUnit.findUnique.mockResolvedValue(null);
        db.residentLead.findFirst.mockResolvedValue(null);
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

        it('checks active applications with PENDING/INVITED only', async () => {
            await service.addToUser('user-1', flat, superAdmin);
            expect(db.residentLead.findFirst).toHaveBeenCalledWith({
                where: {
                    ...flat,
                    status: {
                        in: [
                            ResidentLeadStatus.PENDING,
                            ResidentLeadStatus.INVITED,
                        ],
                    },
                },
                select: { id: true },
            });
        });

        it('an email failure never fails the request', async () => {
            email.sendUnitAdded.mockRejectedValueOnce(
                new ServiceUnavailableException('common.serviceUnavailable')
            );
            await expect(
                service.addToUser('user-1', flat, superAdmin)
            ).resolves.toMatchObject({ label: 'A1-3-2' });
        });

        it.each([
            ['missing', null],
            ['soft-deleted', { ...owner, deletedAt: new Date() }],
            [
                'a legacy tombstone',
                { ...owner, email: 'deleted-user-1@deleted.invalid' },
            ],
        ])('404 user.error.notFound for a %s account', async (_, user) => {
            db.user.findUnique.mockResolvedValue(user);
            const attempt = service.addToUser('user-1', flat, superAdmin);
            await expect(attempt).rejects.toBeInstanceOf(NotFoundException);
            await expect(attempt).rejects.toThrow('user.error.notFound');
            expect(db.residentUnit.create).not.toHaveBeenCalled();
        });

        it.each([
            ['another account', 'user-2'],
            ['this account', 'user-1'],
        ])(
            '409 unit.error.alreadyOwned when %s owns the flat',
            async (_, ownerId) => {
                db.residentUnit.findUnique.mockResolvedValue({
                    id: 'unit-9',
                    userId: ownerId,
                });
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
            db.residentLead.findFirst.mockResolvedValue({ id: 'lead-1' });
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
