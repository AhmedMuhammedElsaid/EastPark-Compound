import {
    BillingRunKind,
    BillingRunStatus,
    ChargeKind,
    EntryDirection,
    FinancePaymentMethod,
    FundEntryKind,
    ImportBatchStatus,
    OwnershipClosedReason,
    Prisma,
    PrismaClient,
} from '@prisma/client';

import { DatabaseService } from 'src/common/database/services/database.service';
import { FinanceDashboardDto } from 'src/modules/finance/dtos/response/finance-dashboard.response.dto';
import { FinanceDashboardService } from 'src/modules/finance/finance-dashboard.service';
import { FinanceFlatsService } from 'src/modules/finance/finance-flats.service';
import { summariseFlats } from 'src/modules/finance/kernel/ledger';

import {
    describeDb,
    insertUser,
    ScratchDb,
    TEST_DATABASE_URL,
} from './db-helper';
import { day, ledger } from './finance-ledger-seed';

const D = (s: string) => new Prisma.Decimal(s);
const sum = (xs: readonly string[]) =>
    xs.reduce((a, x) => a.add(D(x)), D('0')).toFixed(2);

/** The money and count-of-money figures (reproducible for a CLOSED D, 3.1). */
function moneyFigures(r: FinanceDashboardDto) {
    return {
        cohort: r.cohort,
        billed: r.billed,
        collected: r.collected,
        receiptsByMethod: r.receiptsByMethod,
        outstanding: r.outstanding,
        credit: r.credit,
        aging: r.aging,
        owingFlats: r.owingFlats,
        fundBalance: r.fundBalance,
        deposits: r.deposits,
        unapplied: r.unapplied,
        pendingCheques: r.pendingCheques,
        byBuilding: r.byBuilding,
        topOwing: r.topOwing.map(t => ({
            flatId: t.flatId,
            balance: t.balance,
            daysPastDue: t.daysPastDue,
        })),
        series: r.series,
        previous: r.previous,
        deltas: r.deltas,
    };
}

/** Section 3 "Consistency invariants" inside one response. */
function expectInternalInvariants(r: FinanceDashboardDto): void {
    expect(
        sum([r.aging.current, r.aging.d31_60, r.aging.d61_90, r.aging.over90])
    ).toBe(r.outstanding);
    expect(sum(r.byBuilding.map(b => b.outstanding))).toBe(r.outstanding);
    for (const b of r.byBuilding)
        expect(sum(b.floors.map(f => f.outstanding))).toBe(b.outstanding);
    expect(D(r.cohort.charges).sub(D(r.cohort.allocated)).toFixed(2)).toBe(
        r.cohort.open
    );
    const last = r.series[r.series.length - 1];
    expect(last?.outstanding).toBe(r.outstanding);
    expect(last?.owingFlats).toBe(r.owingFlats);
    expect(last?.fundBalance).toBe(r.fundBalance);
}

/** The invariants, plus the cross-check against the Prisma ledger (`summariseFlats`) now. */
async function expectInvariants(
    db: PrismaClient,
    r: FinanceDashboardDto
): Promise<void> {
    expectInternalInvariants(r);
    const asOf = day(r.asOf);
    const flats = await db.flat.findMany({ select: { id: true } });
    const summaries = [
        ...(
            await summariseFlats(
                db,
                flats.map(f => f.id),
                asOf
            )
        ).values(),
    ];
    const open = summaries.reduce((a, s) => a.add(s.openAmount), D('0'));
    const balance = summaries.reduce((a, s) => a.add(s.balance), D('0'));
    const credit = summaries.reduce((a, s) => a.add(s.credit), D('0'));
    expect(r.outstanding).toBe(open.toFixed(2));
    expect(r.outstanding).toBe(balance.add(credit).toFixed(2));
    expect(r.credit.creditTotal).toBe(credit.toFixed(2));
    expect(r.owingFlats).toBe(summaries.filter(s => s.balance.gt(0)).length);
    expect(r.credit.netCreditFlats).toBe(
        summaries.filter(s => s.balance.lt(0)).length
    );
    expect(r.totalFlats).toBe(flats.length);
}

describeDb('finance dashboard (real Postgres)', () => {
    let scratch: ScratchDb;
    let db: PrismaClient;
    let other: PrismaClient;
    let service: FinanceDashboardService;
    let flatsService: FinanceFlatsService;
    const ACC = 'acc_dash';
    const F1 = 'flat_A1-1-1';
    const F2 = 'flat_A1-1-2';
    const F3 = 'flat_A1-1-3';
    const F4 = 'flat_B1-1-1';
    const F5 = 'flat_B1-1-2';
    const AS_OF = '2026-06-20';
    let result: FinanceDashboardDto;

    beforeAll(async () => {
        scratch = new ScratchDb(TEST_DATABASE_URL as string);
        scratch.applyAllBefore('99999999999999_end');
        scratch.exec(
            insertUser(ACC) +
                insertUser('u_gone', true) +
                `INSERT INTO "users" ("id","name","email","passwordHash","updatedAt") VALUES ('u_sara','Sara','sara@t.test','x',CURRENT_TIMESTAMP);`
        );
        db = new PrismaClient({ datasourceUrl: scratch.url });
        other = new PrismaClient({ datasourceUrl: scratch.url });
        await Promise.all([db.$connect(), other.$connect()]);
        service = new FinanceDashboardService(db as unknown as DatabaseService);
        flatsService = new FinanceFlatsService(
            db as unknown as DatabaseService
        );
        const L = ledger(db, ACC);

        // F1: June charge 1000 (due 06-10, 10 days), 600 paid and allocated.
        await L.charge({
            id: 'c_f1_jun',
            flatId: F1,
            amount: '1000',
            period: '2026-06',
            due: '2026-06-10',
        });
        await L.payment({
            id: 'p_f1',
            flatId: F1,
            amount: '600',
            received: '2026-06-05',
        });
        await L.allocation({
            paymentId: 'p_f1',
            chargeId: 'c_f1_jun',
            amount: '600',
            at: '2026-06-05',
        });
        // F2: 91 days (over 90), exactly 90 days (61–90), not yet due (current).
        await L.charge({
            id: 'c_f2_a',
            flatId: F2,
            amount: '500',
            period: '2026-03',
            due: '2026-03-21',
        });
        await L.charge({
            id: 'c_f2_b',
            flatId: F2,
            amount: '250',
            period: '2026-03',
            due: '2026-03-22',
        });
        await L.charge({
            id: 'c_f2_c',
            flatId: F2,
            amount: '100',
            period: '2026-06',
            due: '2026-07-10',
        });
        // F3: open 300 (41 days) and 1000 of credit: not owing, net credit 700.
        await L.charge({
            id: 'c_f3',
            flatId: F3,
            amount: '300',
            period: '2026-05',
            due: '2026-05-10',
        });
        await L.payment({
            id: 'p_f3',
            flatId: F3,
            amount: '1000',
            received: '2026-06-01',
            method: FinancePaymentMethod.BANK_TRANSFER,
        });
        // F4: opening balance 2000, opening credit 500 (200 applied to a June
        // service charge), and a real 100 paid against the opening balance.
        await L.charge({
            id: 'c_f4_open',
            flatId: F4,
            amount: '2000',
            period: '2026-01',
            due: '2026-01-31',
            kind: ChargeKind.OPENING_BALANCE,
        });
        await L.charge({
            id: 'c_f4_jun',
            flatId: F4,
            amount: '200',
            period: '2026-06',
            due: '2026-06-30',
        });
        await L.payment({
            id: 'p_f4_open',
            flatId: F4,
            amount: '500',
            received: '2026-06-02',
            isOpening: true,
        });
        await L.allocation({
            paymentId: 'p_f4_open',
            chargeId: 'c_f4_jun',
            amount: '200',
            at: '2026-06-15',
        });
        await L.payment({
            id: 'p_f4_cash',
            flatId: F4,
            amount: '100',
            received: '2026-06-10',
        });
        await L.allocation({
            paymentId: 'p_f4_cash',
            chargeId: 'c_f4_open',
            amount: '100',
            at: '2026-06-10',
        });
        // F5: a pending cheque, a deposit, a cleared cheque, a May cheque bounced in June.
        await L.charge({
            id: 'c_f5_jun',
            flatId: F5,
            amount: '800',
            period: '2026-06',
            due: '2026-06-25',
        });
        await L.payment({
            id: 'p_f5_chq',
            flatId: F5,
            amount: '800',
            received: '2026-06-12',
            method: FinancePaymentMethod.CHEQUE,
        });
        await L.allocation({
            paymentId: 'p_f5_chq',
            chargeId: 'c_f5_jun',
            amount: '800',
            at: '2026-06-12',
        });
        await L.charge({
            id: 'c_f5_dep',
            flatId: F5,
            amount: '5000',
            period: '2026-06',
            due: '2026-06-30',
            kind: ChargeKind.MAINTENANCE_DEPOSIT,
        });
        await L.payment({
            id: 'p_f5_dep',
            flatId: F5,
            amount: '2000',
            received: '2026-06-18',
            method: FinancePaymentMethod.INSTAPAY,
        });
        await L.allocation({
            paymentId: 'p_f5_dep',
            chargeId: 'c_f5_dep',
            amount: '2000',
            at: '2026-06-18',
        });
        await L.fund({
            amount: '2000',
            date: '2026-06-18',
            paymentId: 'p_f5_dep',
        });
        await L.payment({
            id: 'p_f5_clr',
            flatId: F5,
            amount: '50',
            received: '2026-06-14',
            method: FinancePaymentMethod.CHEQUE,
            cleared: '2026-06-16',
        });
        await L.charge({
            id: 'c_f5_may',
            flatId: F5,
            amount: '300',
            period: '2026-05',
            due: '2026-05-25',
        });
        await L.payment({
            id: 'p_f5_bnc',
            flatId: F5,
            amount: '300',
            received: '2026-05-20',
            method: FinancePaymentMethod.CHEQUE,
        });
        await L.allocation({
            paymentId: 'p_f5_bnc',
            chargeId: 'c_f5_may',
            amount: '300',
            at: '2026-05-20',
        });
        await L.bounce('p_f5_bnc', '2026-06-05');
        // Fund: an import-style per-flat row (not in the total) and a June spend.
        await L.fund({ amount: '9999', date: '2026-01-31', counts: false });
        await L.fund({
            amount: '300',
            date: '2026-06-02',
            kind: FundEntryKind.MAINTENANCE_OUT,
            direction: EntryDirection.OUT,
        });
        // Owners: Sara owns F1; F2's owner account was deleted.
        await db.flatOwnership.create({
            data: { flatId: F1, userId: 'u_sara', fromDate: day('2020-01-01') },
        });
        await db.flatOwnership.create({
            data: {
                flatId: F2,
                userId: 'u_gone',
                fromDate: day('2020-01-01'),
                toDate: day('2026-04-01'),
                closedReason: OwnershipClosedReason.ACCOUNT_DELETED,
            },
        });
        // Checks: a PREVIEW billing run and import batch in June.
        await db.billingRun.create({
            data: {
                kind: BillingRunKind.CUSTOM,
                period: '2026-06',
                accrualPeriod: '2026-06',
                description: 'x',
                descriptionAr: 'x',
                amount: '1',
                dueDate: day('2026-06-30'),
                status: BillingRunStatus.PREVIEW,
                requestKey: 'br-1',
                requestHash: 'h',
                params: {},
                createdById: ACC,
            },
        });
        await db.importBatch.create({
            data: {
                fileHash: 'f',
                status: ImportBatchStatus.PREVIEW,
                asOf: day('2026-06-01'),
                createdById: ACC,
            },
        });

        result = await service.build(db, day(AS_OF), 6);
    });

    afterAll(async () => {
        await Promise.all([db?.$disconnect(), other?.$disconnect()]);
        scratch?.drop();
    });

    it('period, cohort and checks', () => {
        expect(result.asOf).toBe(AS_OF);
        expect(result.months).toBe(6);
        expect(result.period).toEqual({ period: '2026-06', status: 'OPEN' });
        // June operating charges 1000 + 100 + 200 + 800 (not the deposit, not the opening balance)
        expect(result.cohort).toEqual({
            charges: '2100.00',
            allocated: '1600.00',
            open: '500.00',
            rate: '76.2',
        });
        expect(result.checks).toEqual({
            previewBillingRuns: 1,
            previewImportBatches: 1,
            operatingChargesInMonth: 4,
        });
    });

    it('billed and collected follow N-1; opening rows stay out of billed, collections of them count', () => {
        expect(result.billed.map(b => [b.period, b.amount])).toEqual([
            ['2026-01', '0.00'], // the OPENING_BALANCE charge is not billed
            ['2026-02', '0.00'],
            ['2026-03', '750.00'],
            ['2026-04', '0.00'],
            ['2026-05', '600.00'],
            ['2026-06', '2100.00'],
        ]);
        // June: 600 + 200 (opening credit applied, L-4) + 100 (to the opening
        // balance) + 800 − 300 (May cheque bounced in June); May keeps +300.
        expect(result.collected.map(b => [b.period, b.amount])).toEqual([
            ['2026-01', '0.00'],
            ['2026-02', '0.00'],
            ['2026-03', '0.00'],
            ['2026-04', '0.00'],
            ['2026-05', '300.00'],
            ['2026-06', '1400.00'],
        ]);
    });

    it('receipts by method: cash basis, isOpening out, a bounce is a reversal', () => {
        expect(result.receiptsByMethod).toEqual([
            {
                method: 'CASH',
                gross: '700.00',
                reversed: '0.00',
                net: '700.00',
            },
            {
                method: 'BANK_TRANSFER',
                gross: '1000.00',
                reversed: '0.00',
                net: '1000.00',
            },
            {
                method: 'INSTAPAY',
                gross: '2000.00',
                reversed: '0.00',
                net: '2000.00',
            },
            {
                method: 'CHEQUE',
                gross: '850.00',
                reversed: '-300.00',
                net: '550.00',
            },
        ]);
    });

    it('outstanding, aging (90 → 61–90, 91 → over 90, not due → current), credit, owing flats', () => {
        expect(result.outstanding).toBe('6750.00');
        expect(result.aging).toEqual({
            current: '3800.00',
            d31_60: '300.00',
            d61_90: '250.00',
            over90: '2400.00',
        });
        expect(result.credit).toEqual({
            netCreditFlats: 1,
            netCreditTotal: '700.00',
            creditTotal: '1350.00',
        });
        expect(result.owingFlats).toBe(4);
        expect(result.totalFlats).toBe(690);
    });

    it('fund, deposits, unapplied and pending cheques', () => {
        expect(result.fundBalance).toBe('1700.00');
        expect(result.deposits).toEqual({
            billed: '5000.00',
            collected: '2000.00',
        });
        expect(result.unapplied.count).toBe(3);
        expect(result.unapplied.total).toBe('1350.00');
        expect(result.unapplied.oldest).toEqual([
            {
                paymentId: 'p_f3',
                flatId: F3,
                flatLabel: 'A1-1-3',
                method: 'BANK_TRANSFER',
                receivedAt: '2026-06-01',
                unallocated: '1000.00',
                ageDays: 19,
            },
            {
                paymentId: 'p_f4_open',
                flatId: F4,
                flatLabel: 'B1-1-1',
                method: 'CASH',
                receivedAt: '2026-06-02',
                unallocated: '300.00',
                ageDays: 18,
            },
            {
                paymentId: 'p_f5_clr',
                flatId: F5,
                flatLabel: 'B1-1-2',
                method: 'CHEQUE',
                receivedAt: '2026-06-14',
                unallocated: '50.00',
                ageDays: 6,
            },
        ]);
        expect(JSON.stringify(result.unapplied)).not.toMatch(/payer/i);
        expect(result.pendingCheques).toEqual({ count: 1, total: '800.00' });
    });

    it('byBuilding with floors, and topOwing (former owner, no contact field)', () => {
        const a1 = result.byBuilding.find(b => b.building === 'A1');
        expect(a1).toMatchObject({
            totalFlats: 55,
            owingFlats: 2,
            outstanding: '1550.00',
        });
        expect(a1?.floors[0]).toEqual({
            floor: '1',
            totalFlats: 5,
            owingFlats: 2,
            outstanding: '1550.00',
        });
        const b1 = result.byBuilding.find(b => b.building === 'B1');
        expect(b1).toMatchObject({ owingFlats: 2, outstanding: '5200.00' });
        expect(result.byBuilding.map(b => b.building)).toEqual(
            [...result.byBuilding.map(b => b.building)].sort()
        );
        const a2 = result.byBuilding.find(b => b.building === 'A2');
        expect(a2?.floors[0]?.floor).toBe('G');

        expect(result.topOwing).toEqual([
            {
                flatId: F5,
                label: 'B1-1-2',
                ownerName: null,
                ownerDeleted: false,
                balance: '3250.00',
                daysPastDue: 26,
            },
            {
                flatId: F4,
                label: 'B1-1-1',
                ownerName: null,
                ownerDeleted: false,
                balance: '1600.00',
                daysPastDue: 140,
            },
            {
                flatId: F2,
                label: 'A1-1-2',
                ownerName: null,
                ownerDeleted: true,
                balance: '850.00',
                daysPastDue: 91,
            },
            {
                flatId: F1,
                label: 'A1-1-1',
                ownerName: 'Sara',
                ownerDeleted: false,
                balance: '400.00',
                daysPastDue: 10,
            },
        ]);
        expect(JSON.stringify(result.topOwing)).not.toMatch(/phone|email/i);
    });

    it('series is the stock at each month end; previous is as of D′ (deltas from it)', () => {
        expect(result.series).toEqual([
            {
                period: '2026-01',
                date: '2026-01-31',
                outstanding: '2000.00',
                owingFlats: 1,
                fundBalance: '0.00',
            },
            {
                period: '2026-02',
                date: '2026-02-28',
                outstanding: '2000.00',
                owingFlats: 1,
                fundBalance: '0.00',
            },
            {
                period: '2026-03',
                date: '2026-03-31',
                outstanding: '2750.00',
                owingFlats: 2,
                fundBalance: '0.00',
            },
            {
                period: '2026-04',
                date: '2026-04-30',
                outstanding: '2750.00',
                owingFlats: 2,
                fundBalance: '0.00',
            },
            {
                period: '2026-05',
                date: '2026-05-31',
                outstanding: '3050.00',
                owingFlats: 3,
                fundBalance: '0.00',
            },
            {
                period: '2026-06',
                date: '2026-06-20',
                outstanding: '6750.00',
                owingFlats: 4,
                fundBalance: '1700.00',
            },
        ]);
        expect(result.previous).toEqual({
            asOf: '2026-05-20',
            cohort: {
                charges: '600.00',
                allocated: '300.00',
                open: '300.00',
                rate: '50.0',
            },
            collected: '300.00',
            outstanding: '3050.00',
            owingFlats: 3,
            fundBalance: '0.00',
        });
        expect(result.deltas).toEqual({
            collected: '366.7',
            outstanding: '121.3',
            owingFlats: '33.3',
            fundBalance: null, // zero baseline
            rate: '26.2',
        });
    });

    it('holds the consistency invariants (and agrees with summariseFlats)', async () => {
        await expectInvariants(db, result);
        for (const asOf of [
            '2026-01-31',
            '2026-03-21',
            '2026-05-20',
            '2026-06-05',
        ]) {
            await expectInvariants(db, await service.build(db, day(asOf), 12));
        }
    });

    it('a month with no operating charges has a null rate; deltas are null on a zero baseline', async () => {
        const feb = await service.build(db, day('2026-02-15'), 6);
        expect(feb.cohort).toEqual({
            charges: '0.00',
            allocated: '0.00',
            open: '0.00',
            rate: null,
        });
        expect(feb.checks.operatingChargesInMonth).toBe(0);
        expect(feb.deltas.rate).toBeNull();
        expect(feb.deltas.collected).toBeNull();
        expect(feb.deltas.fundBalance).toBeNull();
    });

    it('topOwing is page 1 of flats?sort=balance&hasBalance=true; sort=balance pages every owing flat once', async () => {
        const page = await flatsService.list({
            sort: 'balance',
            hasBalance: true,
            asOf: AS_OF,
            limit: 10,
        });
        expect(page.items.map(i => i.id)).toEqual(
            result.topOwing.map(t => t.flatId)
        );
        const seen: string[] = [];
        let cursor: string | undefined;
        do {
            const p = await flatsService.list({
                sort: 'balance',
                hasBalance: true,
                asOf: AS_OF,
                limit: 1,
                cursor,
            });
            seen.push(...p.items.map(i => i.id));
            cursor = p.nextCursor;
        } while (cursor);
        expect(seen).toEqual([F5, F4, F2, F1]);
        const over90 = await flatsService.list({
            sort: 'balance',
            hasBalance: true,
            overdueDays: 91,
            asOf: AS_OF,
        });
        expect(over90.items.map(i => i.id)).toEqual([F4, F2]);
        const building = await flatsService.list({
            sort: 'balance',
            hasBalance: true,
            building: 'A1',
            asOf: AS_OF,
        });
        expect(building.items.map(i => i.id)).toEqual([F2, F1]);
    });

    it('runs in one read-only REPEATABLE READ snapshot: a concurrent posting is fully out', async () => {
        const before = await service.build(db, day(AS_OF), 6);
        let injected = false;
        const seen: { isolation?: string; readOnly?: string } = {};
        const spy = {
            $transaction: (
                fn: (tx: unknown) => Promise<unknown>,
                opts: unknown
            ) =>
                db.$transaction(
                    tx =>
                        fn(
                            new Proxy(tx, {
                                get(target, key, receiver) {
                                    const value = Reflect.get(
                                        target,
                                        key,
                                        receiver
                                    );
                                    if (key !== '$queryRaw') return value;
                                    return async (...args: unknown[]) => {
                                        const rows = await (
                                            value as (
                                                ...a: unknown[]
                                            ) => Promise<unknown>
                                        ).apply(target, args);
                                        if (!injected) {
                                            injected = true;
                                            const [iso] =
                                                await target.$queryRaw<
                                                    {
                                                        transaction_isolation: string;
                                                    }[]
                                                >`SHOW transaction_isolation`;
                                            const [ro] = await target.$queryRaw<
                                                {
                                                    transaction_read_only: string;
                                                }[]
                                            >`SHOW transaction_read_only`;
                                            seen.isolation =
                                                iso?.transaction_isolation;
                                            seen.readOnly =
                                                ro?.transaction_read_only;
                                            // committed on another connection mid-request
                                            await other.charge.create({
                                                data: {
                                                    id: 'c_concurrent',
                                                    flatId: 'flat_C1-1-1',
                                                    kind: ChargeKind.SERVICE_CHARGE,
                                                    amount: '777',
                                                    description: 'x',
                                                    descriptionAr: 'x',
                                                    accrualPeriod: '2026-06',
                                                    dueDate: day('2026-06-10'),
                                                    createdById: ACC,
                                                },
                                            });
                                        }
                                        return rows;
                                    };
                                },
                            })
                        ),
                    opts as Parameters<typeof db.$transaction>[1]
                ),
        };
        const racing = new FinanceDashboardService(
            spy as unknown as DatabaseService
        );
        const during = await racing.dashboard({ asOf: AS_OF, months: 6 });
        expect(injected).toBe(true);
        expect(seen).toEqual({ isolation: 'repeatable read', readOnly: 'on' });
        expect(moneyFigures(during)).toEqual(moneyFigures(before));
        expectInternalInvariants(during);
        const after = await service.build(db, day(AS_OF), 6);
        expect(after.outstanding).toBe('7527.00');
        await expectInvariants(db, after);
        await db.charge.delete({ where: { id: 'c_concurrent' } });
    });

    it('400s a future asOf', async () => {
        await expect(service.dashboard({ asOf: '2999-01-01' })).rejects.toThrow(
            'finance.error.futureDate'
        );
    });
});

describeDb(
    'finance dashboard, CLOSED period reproducibility (real Postgres)',
    () => {
        let scratch: ScratchDb;
        let db: PrismaClient;
        let service: FinanceDashboardService;
        const ACC = 'acc_close';
        const F = 'flat_C2-2-1';
        const G = 'flat_C2-2-2';

        beforeAll(async () => {
            scratch = new ScratchDb(TEST_DATABASE_URL as string);
            scratch.applyAllBefore('99999999999999_end');
            scratch.exec(insertUser(ACC));
            db = new PrismaClient({ datasourceUrl: scratch.url });
            await db.$connect();
            service = new FinanceDashboardService(
                db as unknown as DatabaseService
            );
            const L = ledger(db, ACC);
            await L.charge({
                id: 'k_sep',
                flatId: F,
                amount: '450',
                period: '2026-09',
                due: '2026-09-10',
            });
            await L.charge({
                id: 'k_oct',
                flatId: F,
                amount: '450',
                period: '2026-10',
                due: '2026-10-10',
            });
            await L.payment({
                id: 'q_chq',
                flatId: F,
                amount: '450',
                received: '2026-10-05',
                method: FinancePaymentMethod.CHEQUE,
            });
            await L.allocation({
                paymentId: 'q_chq',
                chargeId: 'k_oct',
                amount: '450',
                at: '2026-10-05',
            });
            await L.payment({
                id: 'q_pending',
                flatId: G,
                amount: '120',
                received: '2026-10-20',
                method: FinancePaymentMethod.CHEQUE,
            });
            await L.charge({
                id: 'k_dep',
                flatId: G,
                amount: '1000',
                period: '2026-10',
                due: '2026-10-30',
                kind: ChargeKind.MAINTENANCE_DEPOSIT,
            });
            await L.payment({
                id: 'q_dep',
                flatId: G,
                amount: '1000',
                received: '2026-10-21',
            });
            await L.allocation({
                paymentId: 'q_dep',
                chargeId: 'k_dep',
                amount: '1000',
                at: '2026-10-21',
            });
            await L.fund({
                id: 'e_dep',
                amount: '1000',
                date: '2026-10-21',
                paymentId: 'q_dep',
            });
            await db.fiscalPeriod.create({
                data: {
                    period: '2026-10',
                    status: 'CLOSED',
                    closedAt: new Date('2026-11-02T08:00:00Z'),
                },
            });
        });

        afterAll(async () => {
            await db?.$disconnect();
            scratch?.drop();
        });

        it('money figures for a CLOSED D do not change after open-period postings, a bounce, a clearing', async () => {
            const D_CLOSED = day('2026-10-31');
            const before = await service.build(db, D_CLOSED, 6);
            expect(before.period.status).toBe('CLOSED');
            expect(before.collected[5]).toEqual({
                period: '2026-10',
                amount: '450.00',
            });
            // the October cheque (450) and the late-October one (120)
            expect(before.pendingCheques).toEqual({
                count: 2,
                total: '570.00',
            });

            const L = ledger(db, ACC);
            // (a) an unrelated posting in the open period
            await L.charge({
                flatId: G,
                amount: '99',
                period: '2026-11',
                due: '2026-11-10',
            });
            await L.payment({
                flatId: G,
                amount: '99',
                received: '2026-11-03',
            });
            // (b) the October cheque bounces in November
            await L.bounce('q_chq', '2026-11-04');
            // (c) the pending cheque clears in November
            await db.payment.update({
                where: { id: 'q_pending' },
                data: { chequeState: 'CLEARED', clearedAt: day('2026-11-05') },
            });
            // a voided deposit entry in November
            await db.fundEntry.update({
                where: { id: 'e_dep' },
                data: {
                    status: 'VOID',
                    voidedAt: new Date('2026-11-06T10:00:00Z'),
                },
            });

            const again = await service.build(db, D_CLOSED, 6);
            expect(moneyFigures(again)).toEqual(moneyFigures(before));

            // only months after D change: November shows the reversals
            const nov = await service.build(db, day('2026-11-10'), 6);
            expect(
                nov.collected.find(c => c.period === '2026-10')?.amount
            ).toBe('450.00');
            expect(
                nov.collected.find(c => c.period === '2026-11')?.amount
            ).toBe('-450.00');
            expect(nov.series.find(s => s.period === '2026-10')).toEqual(
                before.series[5]
            );
            expect(nov.pendingCheques).toEqual({ count: 0, total: '0.00' });
            expect(nov.deposits.collected).toBe('-1000.00');
            expect(nov.fundBalance).toBe('0.00');
            expect(
                nov.receiptsByMethod.find(m => m.method === 'CHEQUE')
            ).toEqual({
                method: 'CHEQUE',
                gross: '0.00',
                reversed: '-450.00',
                net: '-450.00',
            });
        });
    }
);
