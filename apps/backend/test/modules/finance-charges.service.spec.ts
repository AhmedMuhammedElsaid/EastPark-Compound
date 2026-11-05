import {
    BadRequestException,
    ConflictException,
    ForbiddenException,
    NotFoundException,
} from '@nestjs/common';
import { ChargeKind, PostingStatus, Prisma, Role } from '@prisma/client';

import { DatabaseService } from 'src/common/database/services/database.service';
import { FinanceAuditService } from 'src/modules/finance/kernel/finance-audit.service';
import { FinanceChargesService } from 'src/modules/finance/finance-charges.service';

import {
    fakeFinanceState,
    fakeRaw,
    FakeFinanceState,
} from '../mocks/finance-raw.mock';

const accountant = { userId: 'acc-1', role: Role.ACCOUNTANT };
const otherAccountant = { userId: 'acc-2', role: Role.ACCOUNTANT };
const admin = { userId: 'adm-1', role: Role.ADMIN };

const chargeRow = (overrides: Record<string, unknown> = {}) => ({
    id: 'ch-1',
    flatId: 'flat-1',
    kind: ChargeKind.SERVICE_CHARGE,
    amount: new Prisma.Decimal('450'),
    description: 'Service charge',
    descriptionAr: 'رسوم خدمة',
    accrualPeriod: '2026-11',
    dueDate: new Date('2026-11-10T00:00:00.000Z'),
    status: PostingStatus.POSTED,
    fundContribution: false,
    billingRunId: null,
    replacesId: null,
    createdAt: new Date('2026-11-02T08:00:00.000Z'),
    createdById: 'acc-1',
    voidedAt: null,
    voidReason: null,
    flat: { label: 'A1-3-2' },
    createdBy: { id: 'acc-1', name: 'Mona' },
    voidedBy: null,
    ...overrides,
});

/**
 * A database whose writes inside `$transaction` are staged and only reach
 * `committed` when the callback resolves: a thrown error (a failed audit
 * insert) discards them, like a Postgres rollback.
 */
function build(state: FakeFinanceState = fakeFinanceState()) {
    const committed = {
        charges: [] as unknown[],
        updates: [] as unknown[],
        audits: [] as unknown[],
    };
    const stored = new Map<string, ReturnType<typeof chargeRow>>([
        ['ch-1', chargeRow()],
    ]);
    const raw = fakeRaw(state);
    const auditCreate = jest.fn();
    const allocationCount = jest.fn().mockResolvedValue(0);

    const makeTx = (staged: typeof committed) => ({
        ...raw,
        charge: {
            create: jest.fn(
                async ({ data }: { data: Record<string, unknown> }) => {
                    staged.charges.push(data);
                    return chargeRow({
                        ...data,
                        id: 'ch-new',
                        amount: data.amount,
                    });
                }
            ),
            findUnique: jest.fn(
                async ({ where }: { where: { id: string } }) =>
                    stored.get(where.id) ?? null
            ),
            update: jest.fn(
                async ({
                    where,
                    data,
                }: {
                    where: { id: string };
                    data: Record<string, unknown>;
                }) => {
                    staged.updates.push({ id: where.id, ...data });
                    return {
                        ...chargeRow(),
                        ...stored.get(where.id),
                        ...data,
                        voidedBy: { id: 'x', name: 'X' },
                    };
                }
            ),
            findMany: jest.fn().mockResolvedValue([]),
            count: jest.fn(
                async ({ where }: { where: { replacesId?: string } }) =>
                    [...stored.values()].filter(
                        c =>
                            c.replacesId === where.replacesId &&
                            c.status === PostingStatus.POSTED
                    ).length
            ),
        },
        paymentAllocation: {
            count: allocationCount,
            findMany: jest.fn().mockResolvedValue([]),
        },
        payment: { groupBy: jest.fn().mockResolvedValue([]) },
        auditLog: {
            create: jest.fn(async (args: { data: unknown }) => {
                await auditCreate(args);
                staged.audits.push(args.data);
                return { id: 'audit-1' };
            }),
        },
    });

    const goLive = jest
        .fn()
        .mockResolvedValue({ value: '2026-10-01T00:00:00.000Z' });
    const db = {
        financeSetting: { findUnique: goLive },
        charge: {
            findUnique: jest.fn(
                async ({ where }: { where: { id: string } }) =>
                    stored.get(where.id) ?? null
            ),
        },
        auditLog: { create: jest.fn() },
        $transaction: jest.fn(async (cb: (tx: unknown) => Promise<unknown>) => {
            const staged = {
                charges: [] as unknown[],
                updates: [] as unknown[],
                audits: [] as unknown[],
            };
            const result = await cb(makeTx(staged));
            committed.charges.push(...staged.charges);
            committed.updates.push(...staged.updates);
            committed.audits.push(...staged.audits);
            return result;
        }),
    };
    const service = new FinanceChargesService(
        db as unknown as DatabaseService,
        new FinanceAuditService()
    );
    return {
        service,
        db,
        committed,
        stored,
        state,
        auditCreate,
        allocationCount,
        goLive,
    };
}

/** Review L7: finance audit meta never carries an email or identity data. */
function expectNoPersonalData(audits: unknown[]): void {
    expect(audits.length).toBeGreaterThan(0);
    for (const audit of audits) {
        const meta = (audit as { meta: Record<string, unknown> }).meta;
        expect(JSON.stringify(meta)).not.toContain('@');
        for (const key of Object.keys(meta))
            expect(key).not.toMatch(/email|national|passport|phone/i);
    }
}

afterEach(() => jest.useRealTimers());

const at = (iso: string) => {
    jest.useFakeTimers({
        doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'],
    });
    jest.setSystemTime(new Date(iso));
};

const createDto = {
    flatId: 'flat-1',
    kind: ChargeKind.SERVICE_CHARGE,
    amount: 450,
    description: 'Service charge, November 2026',
    descriptionAr: 'رسوم خدمة نوفمبر 2026',
    dueDate: '2026-11-10',
};

describe('FinanceChargesService.create', () => {
    beforeEach(() => at('2026-11-02T10:00:00.000Z'));

    it('posts the charge and exactly one audit row, in one transaction, in lock order', async () => {
        const { service, db, committed, state } = build();
        const out = await service.create(createDto, accountant);

        expect(db.$transaction).toHaveBeenCalledTimes(1);
        expect(committed.charges).toHaveLength(1);
        expect(committed.audits).toHaveLength(1);
        expect(db.auditLog.create).not.toHaveBeenCalled();
        expect(committed.audits[0]).toMatchObject({
            userId: 'acc-1',
            action: 'CHARGE_CREATED',
            entity: 'Charge',
            entityId: 'ch-new',
            meta: expect.objectContaining({
                amount: '450.00',
                flatLabel: 'A1-3-2',
                accrualPeriod: '2026-11',
            }),
        });
        expect(state.log).toEqual([
            'upsert-period:2026-11',
            'lock-period:2026-11',
            'lock-flat:flat-1',
        ]);
        const data = committed.charges[0] as Record<string, unknown>;
        expect((data.amount as Prisma.Decimal).toString()).toBe('450');
        expect(data.accrualPeriod).toBe('2026-11');
        expect((data.dueDate as Date).toISOString()).toBe(
            '2026-11-10T00:00:00.000Z'
        );
        expect(data.createdById).toBe('acc-1');
        expect(data.fundContribution).toBe(false);
        expect(out).toMatchObject({
            id: 'ch-new',
            amount: 450,
            dueDate: '2026-11-10',
            flatLabel: 'A1-3-2',
        });
    });

    it('a forced audit failure rolls the posting back', async () => {
        const { service, committed, auditCreate } = build();
        auditCreate.mockRejectedValueOnce(new Error('audit insert failed'));

        await expect(service.create(createDto, accountant)).rejects.toThrow(
            'audit insert failed'
        );
        expect(committed.charges).toHaveLength(0);
        expect(committed.audits).toHaveLength(0);
    });

    it('refuses a closed accrual period with periodClosed and writes nothing', async () => {
        const { service, committed } = build(
            fakeFinanceState({ periods: new Map([['2026-10', 'CLOSED']]) })
        );
        await expect(
            service.create(
                { ...createDto, accrualPeriod: '2026-10' },
                accountant
            )
        ).rejects.toThrow(new ConflictException('finance.error.periodClosed'));
        expect(committed.charges).toHaveLength(0);
        expect(committed.audits).toHaveLength(0);
    });

    it('marks a maintenance deposit as a fund contribution', async () => {
        const { service, committed } = build();
        await service.create(
            { ...createDto, kind: ChargeKind.MAINTENANCE_DEPOSIT },
            admin
        );
        expect(
            (committed.charges[0] as { fundContribution: boolean })
                .fundContribution
        ).toBe(true);
    });

    it('rejects an amount with more than 2 decimals before opening a transaction', async () => {
        const { service, db } = build();
        await expect(
            service.create({ ...createDto, amount: 10.005 }, accountant)
        ).rejects.toThrow('finance.error.amountPrecision');
        expect(db.$transaction).not.toHaveBeenCalled();
    });

    it('404s an unknown flat and refuses an inactive one', async () => {
        const state = fakeFinanceState();
        state.flats.set('flat-x', {
            id: 'flat-x',
            label: 'B1-1-1',
            isActive: false,
        });
        const { service } = build(state);
        await expect(
            service.create({ ...createDto, flatId: 'nope' }, accountant)
        ).rejects.toThrow(new NotFoundException('finance.error.flatNotFound'));
        await expect(
            service.create({ ...createDto, flatId: 'flat-x' }, accountant)
        ).rejects.toThrow(new ConflictException('finance.error.flatInactive'));
    });

    it('a replacement must point at a voided charge of the same flat', async () => {
        const { service, stored, committed } = build();
        await expect(
            service.create({ ...createDto, replacesId: 'ch-1' }, accountant)
        ).rejects.toThrow(
            new ConflictException('finance.error.replacesNotVoid')
        );
        stored.set('ch-1', chargeRow({ status: PostingStatus.VOID }));
        await service.create({ ...createDto, replacesId: 'ch-1' }, accountant);
        expect(
            (committed.charges[0] as { replacesId: string }).replacesId
        ).toBe('ch-1');
        stored.set(
            'ch-2',
            chargeRow({
                id: 'ch-2',
                flatId: 'other',
                status: PostingStatus.VOID,
            })
        );
        await expect(
            service.create({ ...createDto, replacesId: 'ch-2' }, accountant)
        ).rejects.toThrow(
            new NotFoundException('finance.error.chargeNotFound')
        );
    });

    it('locks the replaced charge after the flat and refuses a second correction (review L4)', async () => {
        const { service, stored, state } = build();
        stored.set('ch-1', chargeRow({ status: PostingStatus.VOID }));
        await service.create({ ...createDto, replacesId: 'ch-1' }, accountant);
        expect(state.log).toEqual([
            'upsert-period:2026-11',
            'lock-period:2026-11',
            'lock-flat:flat-1',
            'lock-charges:ch-1',
        ]);
        stored.set('ch-fix', chargeRow({ id: 'ch-fix', replacesId: 'ch-1' }));
        await expect(
            service.create({ ...createDto, replacesId: 'ch-1' }, accountant)
        ).rejects.toThrow(
            new ConflictException('finance.error.alreadyReplaced')
        );
        // a voided correction does not block a new one
        stored.set(
            'ch-fix',
            chargeRow({
                id: 'ch-fix',
                replacesId: 'ch-1',
                status: PostingStatus.VOID,
            })
        );
        await expect(
            service.create({ ...createDto, replacesId: 'ch-1' }, accountant)
        ).resolves.toBeDefined();
    });

    it('bounds the accrual month to [go-live month, now + 12] (review L3)', async () => {
        const { service, db, goLive } = build();
        for (const accrualPeriod of ['2026-09', '2027-12', '2099-12'])
            await expect(
                service.create({ ...createDto, accrualPeriod }, accountant)
            ).rejects.toThrow(
                new BadRequestException('finance.error.periodOutOfRange')
            );
        // the dueDate-derived default is bounded too
        await expect(
            service.create({ ...createDto, dueDate: '2019-03-10' }, accountant)
        ).rejects.toThrow(
            new BadRequestException('finance.error.periodOutOfRange')
        );
        expect(db.$transaction).not.toHaveBeenCalled();
        for (const accrualPeriod of ['2026-10', '2027-11'])
            await expect(
                service.create({ ...createDto, accrualPeriod }, accountant)
            ).resolves.toBeDefined();
        // without go-live only the upper bound applies
        goLive.mockResolvedValue(null);
        await expect(
            service.create(
                { ...createDto, accrualPeriod: '2020-01' },
                accountant
            )
        ).resolves.toBeDefined();
        await expect(
            service.create(
                { ...createDto, accrualPeriod: '2027-12' },
                accountant
            )
        ).rejects.toThrow(
            new BadRequestException('finance.error.periodOutOfRange')
        );
    });

    it('audit meta carries no email or identity data (review L7)', async () => {
        const { service, committed } = build();
        await service.create(createDto, accountant);
        expectNoPersonalData(committed.audits);
    });
});

describe('FinanceChargesService.void', () => {
    it('refuses a billing-run charge for every role: void the run instead (review M2)', async () => {
        at('2026-11-02T20:00:00.000Z');
        const { service, stored, committed } = build();
        stored.set('ch-1', chargeRow({ billingRunId: 'run-1' }));
        for (const actor of [
            accountant,
            admin,
            { userId: 'sa', role: Role.SUPER_ADMIN },
        ])
            await expect(
                service.void('ch-1', 'Billed by mistake', actor)
            ).rejects.toThrow(
                new ConflictException('finance.error.voidRunInstead')
            );
        expect(committed.updates).toHaveLength(0);
    });

    it('void audit meta carries no email or identity data (review L7)', async () => {
        at('2026-11-02T20:00:00.000Z');
        const { service, committed } = build();
        await service.void('ch-1', 'Typed the wrong flat', accountant);
        expectNoPersonalData(committed.audits);
    });

    it('lets the posting accountant void on the same Cairo day: one audit row with balances', async () => {
        at('2026-11-02T20:00:00.000Z');
        const { service, committed, state } = build();
        const out = await service.void(
            'ch-1',
            'Typed the wrong flat',
            accountant
        );

        expect(out.status).toBe(PostingStatus.VOID);
        expect(committed.updates).toEqual([
            expect.objectContaining({
                id: 'ch-1',
                status: PostingStatus.VOID,
                voidedById: 'acc-1',
                voidReason: 'Typed the wrong flat',
            }),
        ]);
        expect(committed.audits).toHaveLength(1);
        expect(committed.audits[0]).toMatchObject({
            action: 'CHARGE_VOIDED',
            meta: expect.objectContaining({
                reason: 'Typed the wrong flat',
                amount: '450.00',
                balanceBefore: '0.00',
                balanceAfter: '0.00',
            }),
        });
        // period(s) ascending, then flat, then the charge
        expect(state.log).toEqual([
            'upsert-period:2026-11',
            'lock-period:2026-11',
            'lock-flat:flat-1',
            'lock-charges:ch-1',
        ]);
    });

    it('refuses a void by another accountant', async () => {
        at('2026-11-02T20:00:00.000Z');
        const { service, committed } = build();
        await expect(
            service.void('ch-1', 'Not mine to void', otherAccountant)
        ).rejects.toThrow(
            new ForbiddenException('finance.error.voidNotAllowed')
        );
        expect(committed.updates).toHaveLength(0);
        expect(committed.audits).toHaveLength(0);
    });

    it('refuses the poster on a later Cairo day (00:10 Cairo, still the same UTC day)', async () => {
        // created 2026-11-02T08:00Z (10:00 Cairo); now 2026-11-02T22:10Z = 00:10 Cairo on 3 Nov
        at('2026-11-02T22:10:00.000Z');
        const { service } = build();
        await expect(
            service.void('ch-1', 'Too late for me', accountant)
        ).rejects.toThrow(
            new ForbiddenException('finance.error.voidNotAllowed')
        );
    });

    it('lets an ADMIN void another person’s charge on a later day', async () => {
        at('2026-11-20T10:00:00.000Z');
        const { service, committed } = build();
        await service.void('ch-1', 'Billed by mistake', admin);
        expect(committed.updates).toHaveLength(1);
    });

    it('refuses when the charge month is closed, for every role', async () => {
        at('2026-11-20T10:00:00.000Z');
        const state = fakeFinanceState({
            periods: new Map([['2026-10', 'CLOSED']]),
        });
        const { service, stored } = build(state);
        stored.set('ch-1', chargeRow({ accrualPeriod: '2026-10' }));
        await expect(
            service.void('ch-1', 'Billed by mistake', admin)
        ).rejects.toThrow(new ConflictException('finance.error.periodClosed'));
        // both periods were considered in ascending order: the closed one first
        expect(state.log[1]).toBe('lock-period:2026-10');
    });

    it('refuses while the charge has a live allocation, and a second void', async () => {
        at('2026-11-02T20:00:00.000Z');
        const { service, allocationCount, stored } = build();
        allocationCount.mockResolvedValueOnce(1);
        await expect(
            service.void('ch-1', 'Billed by mistake', admin)
        ).rejects.toThrow(
            new ConflictException('finance.error.hasAllocations')
        );
        stored.set('ch-1', chargeRow({ status: PostingStatus.VOID }));
        await expect(
            service.void('ch-1', 'Billed by mistake', admin)
        ).rejects.toThrow(new ConflictException('finance.error.alreadyVoid'));
    });

    it('404s an unknown charge', async () => {
        const { service } = build();
        await expect(
            service.void('nope', 'Billed by mistake', admin)
        ).rejects.toThrow(
            new NotFoundException('finance.error.chargeNotFound')
        );
    });

    it('a forced audit failure leaves the charge posted', async () => {
        at('2026-11-02T20:00:00.000Z');
        const { service, committed, auditCreate } = build();
        auditCreate.mockRejectedValueOnce(new Error('audit insert failed'));
        await expect(
            service.void('ch-1', 'Typed the wrong flat', accountant)
        ).rejects.toThrow('audit insert failed');
        expect(committed.updates).toHaveLength(0);
    });
});
