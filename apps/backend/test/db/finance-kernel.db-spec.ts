import { ConflictException } from '@nestjs/common';
import { ChargeKind, PrismaClient, Role } from '@prisma/client';

import {
    cairoPeriod,
    parseDateOnly,
    shiftPeriod,
} from 'src/common/finance/cairo-date';
import { DatabaseService } from 'src/common/database/services/database.service';
import { FinanceChargesService } from 'src/modules/finance/finance-charges.service';
import { FinanceAuditService } from 'src/modules/finance/kernel/finance-audit.service';
import { lockPeriods } from 'src/modules/finance/kernel/locks';
import {
    nextReceiptNumber,
    reserveReceiptNumbers,
} from 'src/modules/finance/kernel/receipt-counter';

import {
    describeDb,
    insertUser,
    ScratchDb,
    TEST_DATABASE_URL,
} from './db-helper';

/**
 * Slice 6 kernel against real Postgres (skipped without TEST_DATABASE_URL):
 * the receipt counter has no gaps under rollback and parallel posts (plan
 * 3.4), and the period lock holds against a concurrent raw-SQL close (plan
 * 3.2 point 4: "payment committed after the close" must never happen).
 */
describeDb('finance kernel (real Postgres)', () => {
    let scratch: ScratchDb;
    let db: PrismaClient;
    let closer: PrismaClient;
    const FLAT = 'flat_A1-1-1';
    const actor = { userId: 'acc_db', role: Role.ACCOUNTANT };
    const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
    /** A month inside the charge bounds (review L3): current Cairo month + n. */
    const ahead = (n: number) => shiftPeriod(cairoPeriod(new Date()), n);
    const chargesIn = (period: string) =>
        db.charge.count({ where: { accrualPeriod: period } });

    beforeAll(async () => {
        scratch = new ScratchDb(TEST_DATABASE_URL as string);
        scratch.applyAllBefore('99999999999999_end');
        scratch.exec(insertUser('acc_db'));
        db = new PrismaClient({ datasourceUrl: scratch.url });
        closer = new PrismaClient({ datasourceUrl: scratch.url });
        await Promise.all([db.$connect(), closer.$connect()]);
    });

    afterAll(async () => {
        await Promise.all([db?.$disconnect(), closer?.$disconnect()]);
        scratch?.drop();
    });

    describe('receipt counter', () => {
        it('a rolled-back transaction leaves no gap', async () => {
            const date = parseDateOnly('2030-05-01');
            await expect(
                db.$transaction(async tx => {
                    const n = await nextReceiptNumber(tx, 'R', date);
                    expect(n).toBe('R-2030-000001');
                    throw new Error('rollback');
                })
            ).rejects.toThrow('rollback');
            const first = await db.$transaction(tx =>
                nextReceiptNumber(tx, 'R', date)
            );
            const second = await db.$transaction(tx =>
                nextReceiptNumber(tx, 'R', date)
            );
            expect([first, second]).toEqual(['R-2030-000001', 'R-2030-000002']);
        });

        it('parallel posts (some rolling back, some bulk) produce a contiguous range', async () => {
            const date = parseDateOnly('2031-03-15');
            const runs = Array.from({ length: 24 }, (_, i) =>
                db.$transaction(
                    async tx => {
                        const numbers =
                            i % 4 === 1
                                ? await reserveReceiptNumbers(tx, 'E', [
                                      date,
                                      date,
                                      date,
                                  ])
                                : [await nextReceiptNumber(tx, 'E', date)];
                        await sleep(5);
                        if (i % 3 === 0) throw new Error('rollback');
                        return numbers;
                    },
                    { maxWait: 30_000, timeout: 30_000 }
                )
            );
            const settled = await Promise.allSettled(runs);
            const committed = settled
                .filter(
                    (s): s is PromiseFulfilledResult<string[]> =>
                        s.status === 'fulfilled'
                )
                .flatMap(s => s.value)
                .map(n => Number(n.slice(-6)))
                .sort((a, b) => a - b);
            expect(committed.length).toBeGreaterThan(0);
            expect(committed).toEqual(
                Array.from({ length: committed.length }, (_, i) => i + 1)
            );
            const last = await db.receiptCounter.findUnique({
                where: { scope_year: { scope: 'E', year: 2031 } },
            });
            expect(last?.last).toBe(committed.length);
        });
    });

    describe('period lock vs a raw-SQL close', () => {
        const rawClose = (
            period: string,
            onLocked: () => void,
            holdMs: number
        ) =>
            closer.$transaction(
                async tx => {
                    await tx.$executeRaw`INSERT INTO "fiscal_periods" ("period", "status") VALUES (${period}, 'OPEN') ON CONFLICT ("period") DO NOTHING`;
                    await tx.$queryRaw`SELECT "period" FROM "fiscal_periods" WHERE "period" = ${period} FOR UPDATE`;
                    onLocked();
                    await sleep(holdMs);
                    await tx.$executeRaw`UPDATE "fiscal_periods" SET "status" = 'CLOSED', "closedAt" = now() WHERE "period" = ${period}`;
                    return Date.now();
                },
                { maxWait: 30_000, timeout: 30_000 }
            );

        it('posting first: the close waits for it (payment committed, then close)', async () => {
            const period = '2032-10';
            let locked!: () => void;
            const postingHoldsLock = new Promise<void>(r => (locked = r));
            const posting = db.$transaction(
                async tx => {
                    await lockPeriods(tx, [period]);
                    locked();
                    await sleep(400);
                    await tx.charge.create({
                        data: {
                            flatId: FLAT,
                            kind: ChargeKind.OTHER,
                            amount: '10.00',
                            description: 'x',
                            descriptionAr: 'x',
                            accrualPeriod: period,
                            dueDate: parseDateOnly('2032-10-10'),
                            createdById: actor.userId,
                        },
                    });
                    return Date.now();
                },
                { maxWait: 30_000, timeout: 30_000 }
            );
            await postingHoldsLock;
            const close = rawClose(period, () => undefined, 0);
            const [postedAt, closedAt] = await Promise.all([posting, close]);
            expect(closedAt).toBeGreaterThanOrEqual(postedAt);
            expect(await chargesIn(period)).toBe(1);
        });

        it('close first: a posting that starts meanwhile fails periodClosed and writes nothing', async () => {
            const period = ahead(2);
            let locked!: () => void;
            const closeHoldsLock = new Promise<void>(r => (locked = r));
            const close = rawClose(period, () => locked(), 400);
            await closeHoldsLock;

            const service = new FinanceChargesService(
                db as unknown as DatabaseService,
                new FinanceAuditService()
            );
            const posting = service.create(
                {
                    flatId: FLAT,
                    kind: ChargeKind.OTHER,
                    amount: 10,
                    description: 'x',
                    descriptionAr: 'x',
                    dueDate: `${period}-10`,
                },
                actor
            );
            await expect(posting).rejects.toThrow(
                new ConflictException('finance.error.periodClosed')
            );
            await close;
            expect(await chargesIn(period)).toBe(0);
            expect(
                await db.auditLog.count({
                    where: {
                        action: 'CHARGE_CREATED',
                        meta: { path: ['accrualPeriod'], equals: period },
                    },
                })
            ).toBe(0);
        });

        it('a posting through the service writes the charge and exactly one audit row', async () => {
            const service = new FinanceChargesService(
                db as unknown as DatabaseService,
                new FinanceAuditService()
            );
            const out = await service.create(
                {
                    flatId: FLAT,
                    kind: ChargeKind.SERVICE_CHARGE,
                    amount: '450.25',
                    description: 'Service charge',
                    descriptionAr: 'رسوم خدمة',
                    dueDate: `${ahead(3)}-10`,
                },
                actor
            );
            expect(out.amount).toBe(450.25);
            expect(
                await db.auditLog.count({
                    where: { action: 'CHARGE_CREATED', entityId: out.id },
                })
            ).toBe(1);
        });
    });

    describe('audit atomicity and lock-order smoke (review L6)', () => {
        /** A real audit insert that fails in the database: FK to a missing user. */
        class BrokenFinanceAudit extends FinanceAuditService {
            override record(
                ...args: Parameters<FinanceAuditService['record']>
            ): Promise<void> {
                const [tx, who, ...rest] = args;
                return super.record(
                    tx,
                    { ...who, userId: 'no_such_user' },
                    ...rest
                );
            }
        }

        it('a failing audit insert rolls back the charge and the new period row', async () => {
            const period = ahead(4);
            const service = new FinanceChargesService(
                db as unknown as DatabaseService,
                new BrokenFinanceAudit()
            );
            await expect(
                service.create(
                    {
                        flatId: FLAT,
                        kind: ChargeKind.OTHER,
                        amount: '12.00',
                        description: 'x',
                        descriptionAr: 'x',
                        dueDate: `${period}-10`,
                    },
                    actor
                )
            ).rejects.toThrow();
            expect(await chargesIn(period)).toBe(0);
            expect(await db.fiscalPeriod.count({ where: { period } })).toBe(0);
        });

        it('a failing audit insert rolls back a reserved receipt number', async () => {
            const date = parseDateOnly('2034-02-01');
            const counter = () =>
                db.receiptCounter.findUnique({
                    where: { scope_year: { scope: 'V', year: 2034 } },
                });
            await db.$transaction(tx => nextReceiptNumber(tx, 'V', date));
            const before = (await counter())?.last;
            await expect(
                db.$transaction(async tx => {
                    await nextReceiptNumber(tx, 'V', date);
                    await new BrokenFinanceAudit().record(
                        tx,
                        actor,
                        'REVENUE_RECORDED',
                        'Revenue',
                        null,
                        { label: 'x' }
                    );
                })
            ).rejects.toThrow();
            expect((await counter())?.last).toBe(before);
        });

        it('postings racing to create the same new period row all commit, one row', async () => {
            const period = ahead(5);
            const service = new FinanceChargesService(
                db as unknown as DatabaseService,
                new FinanceAuditService()
            );
            const flats = ['flat_A1-2-1', 'flat_A1-2-2', 'flat_A1-2-3', FLAT];
            await Promise.all(
                flats.map(flatId =>
                    service.create(
                        {
                            flatId,
                            kind: ChargeKind.OTHER,
                            amount: '5',
                            description: 'x',
                            descriptionAr: 'x',
                            dueDate: `${period}-10`,
                        },
                        actor
                    )
                )
            );
            expect(await chargesIn(period)).toBe(flats.length);
            expect(await db.fiscalPeriod.count({ where: { period } })).toBe(1);
        });

        it('a void and a create racing on the same flat both finish (no deadlock)', async () => {
            const period = ahead(1);
            const service = new FinanceChargesService(
                db as unknown as DatabaseService,
                new FinanceAuditService()
            );
            const input = {
                flatId: FLAT,
                kind: ChargeKind.OTHER,
                amount: '7.50',
                description: 'x',
                descriptionAr: 'x',
                dueDate: `${period}-10`,
            };
            for (let round = 0; round < 5; round++) {
                const victim = await service.create(input, actor);
                const [voided, created] = await Promise.all([
                    service.void(victim.id, 'Race smoke test', actor),
                    service.create(input, actor),
                ]);
                expect(voided.status).toBe('VOID');
                expect(created.status).toBe('POSTED');
            }
        });
    });
});
