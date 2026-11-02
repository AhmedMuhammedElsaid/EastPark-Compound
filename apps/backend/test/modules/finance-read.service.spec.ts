import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ChargeKind, PeriodStatus, Prisma, Role } from '@prisma/client';

import { shiftPeriod } from 'src/common/finance/cairo-date';
import { DatabaseService } from 'src/common/database/services/database.service';
import { FINANCE_AUDIT_ACTIONS } from 'src/modules/audit/audit.actions';
import { FinanceDeskService } from 'src/modules/finance/finance-desk.service';
import { FinanceFlatsService } from 'src/modules/finance/finance-flats.service';

const D = (s: string) => new Prisma.Decimal(s);
const day = (s: string) => new Date(`${s}T00:00:00.000Z`);

const flat = (building: string, floor: string, n: string) => ({
    id: `flat_${building}-${floor}-${n}`,
    label: `${building}-${floor}-${n}`,
    building,
    floor,
    flatNumber: n,
    phase: 'phase-1',
    isActive: true,
});

/** Fields the accountant DTO must never carry (plan 9). */
const FORBIDDEN_KEYS = [
    'email',
    'nationalId',
    'passportNumber',
    'passwordHash',
];

function deepKeys(value: unknown, out = new Set<string>()): Set<string> {
    if (Array.isArray(value)) value.forEach(v => deepKeys(v, out));
    else if (value && typeof value === 'object' && !(value instanceof Date))
        for (const [k, v] of Object.entries(value)) {
            out.add(k);
            deepKeys(v, out);
        }
    return out;
}

function buildFlats() {
    const flats = [
        flat('A2', 'G', '1'),
        flat('A1', '10', '1'),
        flat('A1', '2', '5'),
        flat('A1', '2', '1'),
    ];
    const db = {
        flat: {
            findMany: jest.fn().mockResolvedValue(flats),
            findUnique: jest.fn(),
        },
        flatOwnership: {
            findMany: jest.fn().mockResolvedValue([]),
            findFirst: jest.fn(),
        },
        charge: { findMany: jest.fn().mockResolvedValue([]) },
        paymentAllocation: { findMany: jest.fn().mockResolvedValue([]) },
        payment: { groupBy: jest.fn().mockResolvedValue([]) },
    };
    return {
        db,
        service: new FinanceFlatsService(db as unknown as DatabaseService),
    };
}

describe('FinanceFlatsService.list', () => {
    it('orders by layout (building, floor G..11, flat) and pages by id', async () => {
        const { db, service } = buildFlats();
        const first = await service.list({ limit: 2, asOf: '2026-11-02' });
        expect(first.items.map(i => i.label)).toEqual(['A1-2-1', 'A1-2-5']);
        expect(first.nextCursor).toBe('flat_A1-2-5');
        expect(first.asOf).toBe('2026-11-02');

        const second = await service.list({
            limit: 2,
            cursor: first.nextCursor,
        });
        expect(second.items.map(i => i.label)).toEqual(['A1-10-1', 'A2-G-1']);
        expect(second.nextCursor).toBeUndefined();
        // the figures are computed for the page only
        expect(db.charge.findMany.mock.calls[0][0].where.flatId).toEqual({
            in: ['flat_A1-2-1', 'flat_A1-2-5'],
        });
    });

    it('400s an unknown cursor instead of restarting at page 1 (review L2)', async () => {
        const { service } = buildFlats();
        await expect(
            service.list({ cursor: 'flat_gone', limit: 2 })
        ).rejects.toThrow(
            new BadRequestException('finance.error.invalidCursor')
        );
    });

    it('passes label, building and phase filters to the query', async () => {
        const { db, service } = buildFlats();
        await service.list({ q: 'a1-2', building: 'A1', phase: 'phase-1' });
        expect(db.flat.findMany.mock.calls[0][0].where).toEqual({
            label: { contains: 'a1-2', mode: 'insensitive' },
            building: 'A1',
            phase: 'phase-1',
        });
    });

    it('filters on figures (hasBalance, overdueDays) over every candidate', async () => {
        const { db, service } = buildFlats();
        db.charge.findMany.mockResolvedValue([
            {
                id: 'c1',
                flatId: 'flat_A1-2-5',
                amount: D('450'),
                dueDate: day('2026-10-10'),
            },
            {
                id: 'c2',
                flatId: 'flat_A2-G-1',
                amount: D('100'),
                dueDate: day('2026-11-01'),
            },
        ]);
        db.flatOwnership.findMany.mockResolvedValue([
            { flatId: 'flat_A1-2-5', user: { name: 'Sara' } },
        ]);

        const owing = await service.list({
            hasBalance: true,
            asOf: '2026-11-02',
        });
        expect(owing.items.map(i => i.label)).toEqual(['A1-2-5', 'A2-G-1']);
        expect(owing.items[0]).toMatchObject({
            balance: 450,
            overdueAmount: 450,
            oldestDueDays: 23,
            ownerName: 'Sara',
            hasAccount: true,
        });
        expect(owing.items[1]).toMatchObject({
            ownerName: null,
            hasAccount: false,
        });

        const late = await service.list({
            overdueDays: 10,
            asOf: '2026-11-02',
        });
        expect(late.items.map(i => i.label)).toEqual(['A1-2-5']);

        const settled = await service.list({
            hasBalance: false,
            asOf: '2026-11-02',
        });
        expect(settled.items.map(i => i.label)).toEqual(['A1-2-1', 'A1-10-1']);
    });

    it('never exposes email or identity documents', async () => {
        const { db, service } = buildFlats();
        db.flatOwnership.findMany.mockResolvedValue([
            { flatId: 'flat_A1-2-1', user: { name: 'Sara' } },
        ]);
        const page = await service.list({});
        const keys = deepKeys(page);
        for (const k of FORBIDDEN_KEYS) expect(keys.has(k)).toBe(false);
        expect(db.flatOwnership.findMany.mock.calls[0][0].select).toEqual({
            flatId: true,
            user: { select: { name: true } },
        });
    });
});

describe('FinanceFlatsService.detail and ownership', () => {
    it('returns totals, the owner name and phone (no email) and open charges', async () => {
        const { db, service } = buildFlats();
        db.flat.findUnique.mockResolvedValue(flat('A1', '3', '2'));
        db.flatOwnership.findFirst.mockResolvedValue({
            fromDate: day('1900-01-01'),
            user: { id: 'u1', name: 'Sara', phone: '01012345678' },
        });
        db.charge.findMany
            .mockResolvedValueOnce([
                {
                    id: 'c1',
                    flatId: 'flat_A1-3-2',
                    amount: D('450'),
                    dueDate: day('2026-10-10'),
                },
            ])
            .mockResolvedValueOnce([
                {
                    id: 'c1',
                    kind: ChargeKind.SERVICE_CHARGE,
                    description: 'Service charge',
                    descriptionAr: 'رسوم',
                    accrualPeriod: '2026-10',
                },
            ]);
        db.paymentAllocation.findMany.mockResolvedValue([
            {
                amount: D('100'),
                chargeId: 'c1',
                payment: { flatId: 'flat_A1-3-2' },
            },
        ]);
        db.payment.groupBy.mockResolvedValue([
            { flatId: 'flat_A1-3-2', _sum: { amount: D('100') } },
        ]);

        const out = await service.detail('flat_A1-3-2', '2026-11-02');
        expect(out).toMatchObject({
            label: 'A1-3-2',
            asOf: '2026-11-02',
            balance: 350,
            credit: 0,
            availableCredit: 0,
            openAmount: 350,
            overdueAmount: 350,
            owner: {
                userId: 'u1',
                name: 'Sara',
                phone: '01012345678',
                since: '1900-01-01',
            },
            openCharges: [
                expect.objectContaining({
                    id: 'c1',
                    amount: 450,
                    openAmount: 350,
                    dueDate: '2026-10-10',
                }),
            ],
        });
        expect(db.flatOwnership.findFirst.mock.calls[0][0].select.user).toEqual(
            {
                select: { id: true, name: true, phone: true },
            }
        );
        for (const k of FORBIDDEN_KEYS)
            expect(deepKeys(out).has(k)).toBe(false);
    });

    it('404s an unknown flat', async () => {
        const { db, service } = buildFlats();
        db.flat.findUnique.mockResolvedValue(null);
        await expect(service.detail('nope')).rejects.toThrow(
            new NotFoundException('finance.error.flatNotFound')
        );
        await expect(service.ownership('nope')).rejects.toThrow(
            new NotFoundException('finance.error.flatNotFound')
        );
    });

    it('lists ownership periods and anonymises a deleted owner', async () => {
        const { db, service } = buildFlats();
        db.flat.findUnique.mockResolvedValue({ id: 'f' });
        db.flatOwnership.findMany.mockResolvedValue([
            {
                id: 'o2',
                fromDate: day('2026-11-01'),
                toDate: null,
                closedReason: null,
                user: { name: 'New owner', deletedAt: null },
            },
            {
                id: 'o1',
                fromDate: day('1900-01-01'),
                toDate: day('2026-10-31'),
                closedReason: 'ACCOUNT_DELETED',
                user: { name: 'Old owner', deletedAt: new Date() },
            },
        ]);
        const out = await service.ownership('f');
        expect(out.items).toEqual([
            {
                id: 'o2',
                ownerName: 'New owner',
                ownerDeleted: false,
                fromDate: '2026-11-01',
                beforeGoLive: false,
                toDate: null,
                closedReason: null,
            },
            {
                id: 'o1',
                ownerName: null,
                ownerDeleted: true,
                fromDate: '1900-01-01',
                beforeGoLive: true,
                toDate: '2026-10-31',
                closedReason: 'ACCOUNT_DELETED',
            },
        ]);
    });
});

describe('FinanceDeskService', () => {
    function buildDesk() {
        const db = {
            auditLog: { findMany: jest.fn().mockResolvedValue([]) },
            fiscalPeriod: { findMany: jest.fn().mockResolvedValue([]) },
            financeSetting: { findMany: jest.fn().mockResolvedValue([]) },
        };
        return {
            db,
            service: new FinanceDeskService(db as unknown as DatabaseService),
        };
    }

    it('audit: finance actions only, Cairo date range, actor without email', async () => {
        const { db, service } = buildDesk();
        db.auditLog.findMany.mockResolvedValue([
            {
                id: 'a2',
                action: 'CHARGE_CREATED',
                entity: 'Charge',
                entityId: 'c1',
                meta: { label: 'A1-3-2' },
                createdAt: new Date(),
                user: { id: 'u', name: 'Mona', role: Role.ACCOUNTANT },
            },
            {
                id: 'a1',
                action: 'CHARGE_VOIDED',
                entity: 'Charge',
                entityId: 'c1',
                meta: null,
                createdAt: new Date(),
                user: { id: 'u', name: 'Mona', role: Role.ACCOUNTANT },
            },
        ]);
        const page = await service.audit({
            limit: 1,
            entity: 'Charge',
            from: '2026-11-01',
            to: '2026-11-30',
        });
        const args = db.auditLog.findMany.mock.calls[0][0];
        expect(args.where).toEqual({
            action: { in: [...FINANCE_AUDIT_ACTIONS] },
            entity: 'Charge',
            createdAt: {
                gte: new Date('2026-10-31T22:00:00.000Z'),
                lt: new Date('2026-11-30T22:00:00.000Z'),
            },
        });
        expect(args.select.user).toEqual({
            select: { id: true, name: true, role: true },
        });
        expect(page.items).toHaveLength(1);
        expect(page.nextCursor).toBe('a2');
        expect(page.items[0]?.actor).toEqual({
            id: 'u',
            name: 'Mona',
            role: Role.ACCOUNTANT,
        });
    });

    it('audit: a single finance action filter', async () => {
        const { db, service } = buildDesk();
        await service.audit({
            action: 'CHARGE_VOIDED',
            actorId: 'u',
            entityId: 'c1',
        });
        expect(db.auditLog.findMany.mock.calls[0][0].where).toEqual({
            action: 'CHARGE_VOIDED',
            entityId: 'c1',
            userId: 'u',
        });
    });

    it('periods: newest first, missing months are OPEN, rows win', async () => {
        const { db, service } = buildDesk();
        db.fiscalPeriod.findMany.mockResolvedValue([
            {
                period: '2026-10',
                status: PeriodStatus.CLOSED,
                closedAt: new Date('2026-11-05T10:00:00Z'),
                closedBy: { id: 'adm', name: 'Admin' },
                reopenedAt: null,
                reopenedBy: null,
                reopenReason: null,
            },
        ]);
        const out = await service.periods({ from: '2026-09', to: '2026-11' });
        expect(out.items.map(p => [p.period, p.status])).toEqual([
            ['2026-11', PeriodStatus.OPEN],
            ['2026-10', PeriodStatus.CLOSED],
            ['2026-09', PeriodStatus.OPEN],
        ]);
    });

    it('periods: defaults to 12 months and refuses an inverted or huge range', async () => {
        const { service } = buildDesk();
        expect((await service.periods({})).items).toHaveLength(12);
        await expect(
            service.periods({ from: '2026-12', to: '2026-01' })
        ).rejects.toThrow(
            new BadRequestException('finance.error.invalidPeriodRange')
        );
        await expect(
            service.periods({ from: '2020-01', to: '2026-01' })
        ).rejects.toThrow(BadRequestException);
        expect(shiftPeriod('2026-01', -1)).toBe('2025-12');
        expect(shiftPeriod('2026-12', 1)).toBe('2027-01');
    });

    it('settings: every key with its value and the last editor name', async () => {
        const { db, service } = buildDesk();
        db.financeSetting.findMany.mockResolvedValue([
            {
                key: 'billing.defaultDueDay',
                value: 10,
                updatedAt: new Date(),
                updatedBy: null,
            },
        ]);
        const out = await service.settings();
        expect(out.items[0]).toMatchObject({
            key: 'billing.defaultDueDay',
            value: 10,
        });
        expect(
            db.financeSetting.findMany.mock.calls[0][0].select.updatedBy
        ).toEqual({
            select: { id: true, name: true },
        });
    });
});
