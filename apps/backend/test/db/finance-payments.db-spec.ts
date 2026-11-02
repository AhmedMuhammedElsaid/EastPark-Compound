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
        const files = {
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
            { payFor: 'DEPOSIT' },
            accA
        );
        expect(applied.applied).toBe(300);
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
