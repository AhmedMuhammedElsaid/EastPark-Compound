import { ConflictException } from '@nestjs/common';
import { ChargeKind, PrismaClient, Role } from '@prisma/client';

import {
    addDays,
    cairoPeriod,
    cairoToday,
    dateOnlyString,
    parseDateOnly,
    shiftPeriod,
} from 'src/common/finance/cairo-date';
import { DatabaseService } from 'src/common/database/services/database.service';
import { PrivateFileService } from 'src/common/file/services/private-file.service';
import { FinancePaymentCreateDto } from 'src/modules/finance/dtos/request/finance-payment.dto';
import { FinancePaymentsService } from 'src/modules/finance/finance-payments.service';
import { FinanceAuditService } from 'src/modules/finance/kernel/finance-audit.service';
import { summariseFlat } from 'src/modules/finance/kernel/ledger';

import {
    describeDb,
    insertUser,
    ScratchDb,
    TEST_DATABASE_URL,
} from './db-helper';

/**
 * Slice 7 payments against real Postgres (skipped without TEST_DATABASE_URL):
 * idempotency under a real unique index and row locks (plan 3.3), two
 * accountants on one flat, the void cascade, and "close October, bounce in
 * November" (plan 2.1.1 H1) with relative months so it runs on any date.
 */
describeDb('finance payments (real Postgres)', () => {
    let scratch: ScratchDb;
    let db: PrismaClient;
    let service: FinancePaymentsService;
    let files: PrivateFileService;
    const accA = { userId: 'acc_a', role: Role.ACCOUNTANT };
    const accB = { userId: 'acc_b', role: Role.ACCOUNTANT };
    const now = new Date();
    const thisMonth = cairoPeriod(now);
    const lastMonth = shiftPeriod(thisMonth, -1);
    const today = dateOnlyString(cairoToday(now));

    const addCharge = (
        flatId: string,
        period: string,
        amount: string,
        kind: ChargeKind = ChargeKind.SERVICE_CHARGE
    ) =>
        db.charge.create({
            data: {
                flatId,
                kind,
                amount,
                description: 'x',
                descriptionAr: 'x',
                accrualPeriod: period,
                dueDate: parseDateOnly(`${period}-10`),
                fundContribution: kind === ChargeKind.MAINTENANCE_DEPOSIT,
                createdById: accA.userId,
            },
        });

    const dto = (
        flatId: string,
        o: Partial<FinancePaymentCreateDto> = {}
    ): FinancePaymentCreateDto =>
        ({
            flatId,
            amount: '450.00',
            method: 'CASH',
            receivedAt: today,
            ...o,
        }) as FinancePaymentCreateDto;

    beforeAll(async () => {
        scratch = new ScratchDb(TEST_DATABASE_URL as string);
        scratch.applyAllBefore('99999999999999_end');
        scratch.exec(insertUser('acc_a') + insertUser('acc_b'));
        // payments may be dated from the go-live month on: open it up for the test
        scratch.exec(
            `INSERT INTO "finance_settings" ("key","value","updatedAt") VALUES ('finance.goLiveAt','"2020-01-01T00:00:00.000Z"'::jsonb, now()) ` +
                `ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value";`
        );
        db = new PrismaClient({ datasourceUrl: scratch.url });
        await db.$connect();
        files = {
            exists: async () => true,
            copy: async () => true,
            remove: async () => true,
        } as unknown as PrivateFileService;
        service = new FinancePaymentsService(
            db as unknown as DatabaseService,
            new FinanceAuditService(),
            files
        );
    });

    afterAll(async () => {
        await db?.$disconnect();
        scratch?.drop();
    });

    it('two identical requests in parallel: one row, the same response', async () => {
        const flat = 'flat_A1-1-1';
        await addCharge(flat, thisMonth, '450');
        const key = 'db-spec-same-key-0001';
        const [a, b] = await Promise.all([
            service.create(dto(flat), key, accA),
            service.create(dto(flat), key, accA),
        ]);
        expect(a).toEqual(b);
        expect(await db.payment.count({ where: { requestKey: key } })).toBe(1);
        expect(
            await db.auditLog.count({
                where: { action: 'PAYMENT_RECORDED', entityId: a.id },
            })
        ).toBe(1);
        await expect(
            service.create(dto(flat, { amount: '1.00' }), key, accA)
        ).rejects.toThrow(
            new ConflictException('finance.error.idempotencyConflict')
        );
    });

    it('two accountants on one flat at once: the charge is settled once, receipts are distinct', async () => {
        const flat = 'flat_A1-1-2';
        const charge = await addCharge(flat, thisMonth, '450');
        const [a, b] = await Promise.all([
            service.create(dto(flat), 'db-spec-two-acc-a', accA),
            service.create(dto(flat), 'db-spec-two-acc-b', accB),
        ]);
        expect(a.receiptNo).not.toBe(b.receiptNo);
        const allocated = await db.paymentAllocation.aggregate({
            where: { chargeId: charge.id, voidedAt: null },
            _sum: { amount: true },
        });
        expect(allocated._sum.amount?.toFixed(2)).toBe('450.00');
        const s = await summariseFlat(db, flat, cairoToday());
        expect([s.balance, s.credit].map(x => x.toFixed(2))).toEqual([
            '-450.00',
            '450.00',
        ]);
    });

    it('void cascades to allocations and DEPOSIT_IN entries; credit can be applied after', async () => {
        const flat = 'flat_A1-1-3';
        await addCharge(
            flat,
            thisMonth,
            '1000',
            ChargeKind.MAINTENANCE_DEPOSIT
        );
        const p = await service.create(
            dto(flat, { amount: '1000', payFor: 'DEPOSIT' }),
            'db-spec-void-0001',
            accA
        );
        expect(
            await db.fundEntry.count({
                where: { paymentId: p.id, status: 'POSTED' },
            })
        ).toBe(1);
        await service.void(p.id, 'Posted to the wrong flat', accA);
        expect(
            await db.paymentAllocation.count({
                where: { paymentId: p.id, voidedAt: null },
            })
        ).toBe(0);
        expect(
            await db.fundEntry.count({
                where: { paymentId: p.id, status: 'VOID' },
            })
        ).toBe(1);

        const credit = await service.create(
            dto(flat, { amount: '300', payFor: 'AUTO' }),
            'db-spec-void-0003',
            accA
        );
        expect(credit.unallocatedAmount).toBe(300);
        const applied = await service.applyCredit(
            flat,
            { payFor: 'DEPOSIT', expectedCredit: '300.00' },
            accA
        );
        expect(applied.applied).toBe(300);
    });

    it('review M1: same-key race with a cheque reference and a full explicit allocation replays the winner', async () => {
        const flat = 'flat_A1-2-1';
        const charge = await addCharge(flat, thisMonth, '450');
        const body = dto(flat, {
            method: 'CHEQUE',
            reference: 'DB-RACE-CHQ',
            allocations: [{ chargeId: charge.id, amount: '450.00' }],
        });
        const key = 'db-spec-race-ref-0001';
        const [a, b] = await Promise.all([
            service.create(body, key, accA),
            service.create(body, key, accA),
        ]);
        expect(a).toEqual(b);
        expect(await db.payment.count({ where: { requestKey: key } })).toBe(1);
    });

    it('review M2: two payments racing to attach one staged file: one wins, one attachmentInUse', async () => {
        const path = `staging/acc_a/${Date.now()}-db-race.jpg`;
        const results = await Promise.allSettled([
            service.create(
                dto('flat_A1-2-2', { attachmentPath: path }),
                'db-spec-attach-a',
                accA
            ),
            service.create(
                dto('flat_A1-2-3', { attachmentPath: path }),
                'db-spec-attach-b',
                accA
            ),
        ]);
        expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
        const rejected = results.find(
            (r): r is PromiseRejectedResult => r.status === 'rejected'
        );
        expect(rejected?.reason).toEqual(
            new ConflictException('finance.error.attachmentInUse')
        );
    });

    it('review M3: a back-dated bounce needs every month up to today open and no later allocation', async () => {
        const flat = 'flat_A1-2-4';
        await addCharge(flat, lastMonth, '450');
        const cheque = await service.create(
            dto(flat, {
                method: 'CHEQUE',
                amount: '600.00',
                receivedAt: `${lastMonth}-15`,
            }),
            'db-spec-m3-0001',
            accA
        );
        await addCharge(flat, thisMonth, '150');
        await service.applyCredit(flat, { expectedCredit: '150.00' }, accA);

        await db.$executeRaw`UPDATE "fiscal_periods" SET "status" = 'CLOSED' WHERE "period" = ${thisMonth}`;
        await expect(
            service.chequeBounced(cheque.id, { date: `${lastMonth}-16` }, accA)
        ).rejects.toThrow(new ConflictException('finance.error.periodClosed'));
        await db.$executeRaw`UPDATE "fiscal_periods" SET "status" = 'OPEN' WHERE "period" = ${thisMonth}`;

        await expect(
            service.chequeBounced(cheque.id, { date: `${lastMonth}-16` }, accA)
        ).rejects.toThrow(
            new ConflictException('finance.error.dateBeforeAllocation')
        );
        const bounced = await service.chequeBounced(cheque.id, {}, accA);
        expect(bounced.allocations.every(a => a.voidedAt !== null)).toBe(true);
    });

    it('review L5: receipt numbers stay consecutive after a rolled-back payment', async () => {
        class BrokenAudit extends FinanceAuditService {
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
        const broken = new FinancePaymentsService(
            db as unknown as DatabaseService,
            new BrokenAudit(),
            files
        );
        await expect(
            broken.create(dto('flat_A1-3-1'), 'db-spec-rollback-0001', accA)
        ).rejects.toThrow();
        await service.create(dto('flat_A1-3-1'), 'db-spec-rollback-0002', accA);
        await service.create(dto('flat_A1-3-1'), 'db-spec-rollback-0003', accA);
        const year = today.slice(0, 4);
        const numbers = (
            await db.payment.findMany({
                where: { receiptNo: { startsWith: `R-${year}-` } },
                select: { receiptNo: true },
            })
        )
            .map(p => Number(p.receiptNo.slice(-6)))
            .sort((x, y) => x - y);
        expect(numbers).toEqual(
            Array.from({ length: numbers.length }, (_, i) => i + 1)
        );
    });

    it('close last month, bounce its cheque this month: last month is unchanged', async () => {
        const flat = 'flat_A1-1-4';
        await addCharge(flat, lastMonth, '450');
        const cheque = await service.create(
            dto(flat, {
                method: 'CHEQUE',
                reference: 'DB-CHQ-1',
                receivedAt: `${lastMonth}-15`,
            }),
            'db-spec-bounce-0001',
            accA
        );
        expect(cheque.allocations).toHaveLength(1);
        await db.$executeRaw`UPDATE "fiscal_periods" SET "status" = 'CLOSED', "closedAt" = now() WHERE "period" = ${lastMonth}`;

        const lastMonthEnd = addDays(parseDateOnly(`${thisMonth}-01`), -1);
        const before = await summariseFlat(db, flat, lastMonthEnd);
        expect(before.balance.toFixed(2)).toBe('0.00');

        await expect(
            service.chequeBounced(
                cheque.id,
                { date: dateOnlyString(lastMonthEnd) },
                accA
            )
        ).rejects.toThrow(new ConflictException('finance.error.periodClosed'));
        const bounced = await service.chequeBounced(cheque.id, {}, accA);
        expect(bounced.chequeState).toBe('BOUNCED');

        const after = await summariseFlat(db, flat, lastMonthEnd);
        expect(after).toEqual(before);
        const nowFigures = await summariseFlat(db, flat, cairoToday());
        expect(nowFigures.balance.toFixed(2)).toBe('450.00');
        expect(nowFigures.openAmount.toFixed(2)).toBe('450.00');
        expect(nowFigures.credit.toFixed(2)).toBe('0.00');
    });
});
