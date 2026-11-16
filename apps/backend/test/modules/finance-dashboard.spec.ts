import 'reflect-metadata';

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import {
    BadRequestException,
    ExecutionContext,
    ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Prisma, Role } from '@prisma/client';

import {
    addDays,
    cairoToday,
    dateOnlyString,
} from 'src/common/finance/cairo-date';
import { DatabaseService } from 'src/common/database/services/database.service';
import { PUBLIC_ROUTE_KEY } from 'src/common/request/constants/request.constant';
import { RolesGuard } from 'src/common/request/guards/roles.guard';
import {
    FinanceDashboardQueryDto,
    FinanceFlatsQueryDto,
} from 'src/modules/finance/dtos/request/finance-query.dto';
import { FinanceDashboardController } from 'src/modules/finance/finance-dashboard.controller';
import {
    deltaText,
    moneyText,
    percentText,
    pointsDeltaText,
    ratePercent,
} from 'src/modules/finance/finance-dashboard.format';
import {
    DASHBOARD_TX_OPTIONS,
    FinanceDashboardService,
} from 'src/modules/finance/finance-dashboard.service';
import {
    FlowRow,
    flowBuckets,
    monthBuckets,
    periodEnd,
    sameDayLastMonth,
} from 'src/modules/finance/kernel/flow-buckets';
import {
    asOfPointsSql,
    asOfSql,
    liveAllocationSql,
    spanEnd,
    utcTimestampText,
} from 'src/modules/finance/kernel/live-predicates.sql';

const D = (s: string | number) => new Prisma.Decimal(s);
const day = (s: string) => new Date(`${s}T00:00:00.000Z`);
const row = (amount: string, start: string, end?: string): FlowRow => ({
    amount: D(amount),
    start: day(start),
    end: end ? day(end) : null,
});

describe('flowBuckets (N-1)', () => {
    const buckets = monthBuckets(day('2026-11-10'), 3); // Sep, Oct, Nov (to 10th)

    it('books +amount at the start and −amount at the earliest invalidation', () => {
        const out = flowBuckets(
            [row('450', '2026-10-05', '2026-11-04'), row('100', '2026-09-01')],
            buckets
        );
        expect(out.map(b => b.net.toFixed(2))).toEqual([
            '100.00',
            '450.00',
            '-450.00',
        ]);
        expect(out[2]?.gross.toFixed(2)).toBe('0.00');
        expect(out[2]?.reversed.toFixed(2)).toBe('-450.00');
    });

    it('shows only the reversal of an original before the window; ignores anything after D', () => {
        const out = flowBuckets(
            [
                row('90', '2026-01-05', '2026-10-02'),
                row('70', '2026-11-11'),
                row('30', '2026-10-01', '2026-11-20'),
            ],
            buckets
        );
        expect(out.map(b => b.net.toFixed(2))).toEqual([
            '0.00',
            '-60.00',
            '0.00',
        ]);
    });

    it('a row that was never live counts nowhere; one live inside one bucket nets to 0 there', () => {
        const out = flowBuckets(
            [
                row('5', '2026-10-10', '2026-10-10'),
                row('8', '2026-10-10', '2026-10-01'),
                row('3', '2026-10-02', '2026-10-09'),
            ],
            buckets
        );
        expect(out[1]).toEqual({
            gross: D('3'),
            reversed: D('-3'),
            net: D('0'),
        });
    });

    it('equals S(e(m)) − S(e(m−1)) on generated rows', () => {
        const rows: FlowRow[] = [];
        let seed = 7;
        const rnd = (n: number) => (seed = (seed * 48271) % 2147483647) % n;
        for (let i = 0; i < 300; i += 1) {
            const start = addDays(day('2026-01-01'), rnd(330));
            rows.push({
                amount: D(String(1 + rnd(999))),
                start,
                end: rnd(3) === 0 ? null : addDays(start, rnd(120) - 10),
            });
        }
        const S = (d: Date) =>
            rows
                .filter(r => r.start <= d && (!r.end || d < r.end))
                .reduce((a, r) => a.add(r.amount), D(0));
        const asOf = day('2026-11-18');
        const months = monthBuckets(asOf, 12);
        const ends = [
            addDays(months[0]?.from as Date, -1),
            ...months.map(m => m.to),
        ];
        const expected = months.map((_, i) =>
            S(ends[i + 1] as Date)
                .sub(S(ends[i] as Date))
                .toFixed(2)
        );
        expect(flowBuckets(rows, months).map(b => b.net.toFixed(2))).toEqual(
            expected
        );
    });
});

describe('dashboard dates', () => {
    it('monthBuckets: months ending at D, the last one ends at D', () => {
        const b = monthBuckets(day('2026-03-15'), 6);
        expect(b.map(x => x.period)).toEqual([
            '2025-10',
            '2025-11',
            '2025-12',
            '2026-01',
            '2026-02',
            '2026-03',
        ]);
        expect(dateOnlyString(b[4]?.to as Date)).toBe('2026-02-28');
        expect(dateOnlyString(b[5]?.from as Date)).toBe('2026-03-01');
        expect(dateOnlyString(b[5]?.to as Date)).toBe('2026-03-15');
        expect(dateOnlyString(periodEnd('2028-02'))).toBe('2028-02-29');
    });

    it('D′ is D minus one month, clamped to the month end', () => {
        expect(dateOnlyString(sameDayLastMonth(day('2026-03-31')))).toBe(
            '2026-02-28'
        );
        expect(dateOnlyString(sameDayLastMonth(day('2028-03-31')))).toBe(
            '2028-02-29'
        );
        expect(dateOnlyString(sameDayLastMonth(day('2026-01-15')))).toBe(
            '2025-12-15'
        );
        expect(dateOnlyString(sameDayLastMonth(day('2026-07-31')))).toBe(
            '2026-06-30'
        );
    });
});

describe('dashboard Decimal-string adapters', () => {
    it('money is a 2-dp string, never "-0.00"', () => {
        expect(moneyText(D('12500'))).toBe('12500.00');
        expect(moneyText(D('-300.5'))).toBe('-300.50');
        expect(moneyText(D('0').neg())).toBe('0.00');
        expect(moneyText(D('9999999.995'))).toBe('10000000.00');
    });

    it('percentages are 1 dp, half up, never "-0.0"; a zero denominator is null', () => {
        expect(percentText(D('87.45'))).toBe('87.5');
        expect(percentText(D('-12.35'))).toBe('-12.4');
        expect(percentText(D('-0.04'))).toBe('0.0');
        expect(ratePercent(D('1600'), D('2100'))?.toFixed(4)).toBe('76.1905');
        expect(ratePercent(D('1'), D('0'))).toBeNull();
    });

    it('deltas: relative change on |baseline|, null on zero; rate delta in points', () => {
        expect(deltaText(D('1400'), D('300'))).toBe('366.7');
        expect(deltaText(D('90'), D('100'))).toBe('-10.0');
        expect(deltaText(D('5'), D('0'))).toBeNull();
        expect(deltaText(D('-50'), D('-100'))).toBe('50.0'); // rose from −100 to −50
        expect(pointsDeltaText(D('76.19'), D('50'))).toBe('26.2');
        expect(pointsDeltaText(null, D('50'))).toBeNull();
    });
});

describe('dashboard SQL helpers (kernel)', () => {
    it('send D as a date and the Cairo day end as tz-less UTC text', () => {
        expect(utcTimestampText(new Date('2026-06-20T21:00:00.000Z'))).toBe(
            '2026-06-20T21:00:00.000'
        );
        const winter = asOfSql(day('2026-01-10'));
        expect(winter.day.values).toEqual(['2026-01-10']);
        expect(winter.end.values).toEqual(['2026-01-10T22:00:00.000']); // UTC+2
        const summer = asOfSql(day('2026-06-20'));
        expect(summer.end.values).toEqual(['2026-06-20T21:00:00.000']); // UTC+3
        expect(
            asOfPointsSql([day('2026-01-10'), day('2026-06-20')]).values
        ).toEqual([
            0,
            '2026-01-10',
            '2026-01-10T22:00:00.000',
            1,
            '2026-06-20',
            '2026-06-20T21:00:00.000',
        ]);
        expect(() => liveAllocationSql(winter, { a: 'a; DROP' })).toThrow(
            'bad SQL alias'
        );
    });

    it('spanEnd takes the earlier of a date end and the Cairo day of an instant end', () => {
        expect(spanEnd(null, null)).toBeNull();
        expect(
            dateOnlyString(
                spanEnd(null, new Date('2026-04-10T22:30:00Z')) as Date
            )
        ).toBe('2026-04-11');
        expect(
            dateOnlyString(
                spanEnd(
                    day('2026-04-15'),
                    new Date('2026-07-15T21:30:00Z')
                ) as Date
            )
        ).toBe('2026-04-15');
        expect(
            dateOnlyString(
                spanEnd(
                    day('2026-08-01'),
                    new Date('2026-07-15T21:30:00Z')
                ) as Date
            )
        ).toBe('2026-07-16');
    });

    it('the dashboard service never re-spells a live predicate (rule 1)', () => {
        const source = readFileSync(
            join(
                __dirname,
                '../../src/modules/finance/finance-dashboard.service.ts'
            ),
            'utf8'
        );
        for (const banned of [
            'voidedAt',
            'bouncedAt',
            "'POSTED'",
            'chequeState',
            'PostingStatus',
        ])
            expect({ banned, found: source.includes(banned) }).toEqual({
                banned,
                found: false,
            });
    });
});

/** A `$queryRaw` stand-in that answers each dashboard query by its SQL text. */
function fakeClient() {
    const raw = jest.fn(async (q: Prisma.Sql) => {
        const text = q.sql;
        if (text.includes('AS "allocated"'))
            return [
                { idx: 0, charges: D('2100'), allocated: D('1600'), count: 4 },
                { idx: 1, charges: D('600'), allocated: D('300'), count: 2 },
            ];
        if (text.includes('AS "owing0"')) {
            // 6 month ends + D′: one wide row, one column set per point
            const point: Record<string, unknown> = {};
            for (let i = 0; i < 7; i += 1) {
                point[`charged${i}`] = D(
                    i === 5 ? '7000' : i === 6 ? '3350' : '100'
                );
                point[`allocated${i}`] = D(
                    i === 5 ? '250' : i === 6 ? '300' : '0'
                );
                point[`owing${i}`] = i === 5 ? 4 : 3;
                point[`fund${i}`] = D(i === 5 ? '1700' : '0');
            }
            return [point];
        }
        if (text.includes(`'totals' AS "kind"`)) {
            const floor = (
                building: string,
                floorName: string,
                totalFlats: number,
                owingFlats: number,
                outstanding: string
            ) => ({
                kind: 'floor',
                building,
                floor: floorName,
                totalFlats,
                owingFlats,
                outstanding: D(outstanding),
            });
            return [
                {
                    kind: 'totals',
                    outstanding: D('6750'),
                    current: D('3800'),
                    d31_60: D('300'),
                    d61_90: D('250'),
                    over90: D('2400'),
                    owingFlats: 4,
                    totalFlats: 690,
                    netCreditFlats: 1,
                    netCreditTotal: D('700'),
                    creditTotal: D('1350'),
                },
                floor('B1', '1', 5, 2, '5200'),
                {
                    kind: 'top',
                    id: 'f1',
                    label: 'A1-1-1',
                    balance: D('400'),
                    dpd: 10,
                    rank: 3,
                },
                floor('A2', '2', 5, 0, '0'),
                {
                    kind: 'top',
                    id: 'f5',
                    label: 'B1-1-2',
                    balance: D('3250'),
                    dpd: 26,
                    rank: 1,
                },
                floor('A2', 'G', 5, 1, '10'),
                floor('A1', '1', 5, 2, '1540'),
                {
                    kind: 'top',
                    id: 'f2',
                    label: 'A1-1-2',
                    balance: D('850'),
                    dpd: 91,
                    rank: 2,
                },
            ];
        }
        if (text.includes('LIMIT 5'))
            return [
                {
                    id: 'p3',
                    flatId: 'f3',
                    label: 'A1-1-3',
                    method: 'BANK_TRANSFER',
                    receivedAt: day('2026-06-01'),
                    unallocated: D('1000'),
                    ageDays: 19,
                    count: 3,
                    total: D('1350'),
                },
            ];
        if (text.includes('p."method" = \'CHEQUE\''))
            return [{ count: 1, total: D('800') }];
        if (text.includes('s."endAt"')) {
            if (text.includes('"isOpening" = false'))
                return [
                    {
                        key: 'CHEQUE',
                        start: day('2026-05-20'),
                        endDate: day('2026-06-05'),
                        endAt: null,
                        amount: D('300'),
                    },
                    {
                        key: 'CASH',
                        start: day('2026-06-05'),
                        endDate: null,
                        endAt: null,
                        amount: D('700'),
                    },
                ];
            if (text.includes("'DEPOSIT_IN' AND"))
                return [
                    {
                        key: 'DEPOSIT_IN',
                        start: day('2026-06-18'),
                        endDate: null,
                        endAt: null,
                        amount: D('2000'),
                    },
                ];
            if (text.includes('"payment_allocations" a'))
                return [
                    {
                        key: 'OP',
                        start: day('2026-06-05'),
                        endDate: null,
                        endAt: null,
                        amount: D('600'),
                    },
                    {
                        key: 'OPEN',
                        start: day('2026-06-10'),
                        endDate: null,
                        endAt: null,
                        amount: D('100'),
                    },
                    {
                        key: 'DEP',
                        start: day('2026-06-18'),
                        endDate: null,
                        endAt: null,
                        amount: D('2000'),
                    },
                    {
                        key: 'OP',
                        start: day('2026-05-20'),
                        endDate: day('2026-06-05'),
                        endAt: null,
                        amount: D('300'),
                    },
                ];
            return [
                {
                    key: 'OP',
                    start: day('2026-06-01'),
                    endDate: null,
                    endAt: null,
                    amount: D('2100'),
                },
                {
                    key: 'OPEN',
                    start: day('2026-01-01'),
                    endDate: null,
                    endAt: null,
                    amount: D('2000'),
                },
                {
                    key: 'DEP',
                    start: day('2026-06-01'),
                    endDate: null,
                    endAt: null,
                    amount: D('5000'),
                },
                {
                    key: 'OP',
                    start: day('2026-03-01'),
                    endDate: null,
                    endAt: new Date('2026-06-02T08:00:00Z'),
                    amount: D('40'),
                },
            ];
        }
        throw new Error(`unexpected query: ${text.slice(0, 80)}`);
    });
    const client = {
        $queryRaw: raw,
        $executeRaw: jest.fn().mockResolvedValue(0),
        fiscalPeriod: { findUnique: jest.fn().mockResolvedValue(null) },
        billingRun: { count: jest.fn().mockResolvedValue(1) },
        importBatch: { count: jest.fn().mockResolvedValue(0) },
        flatOwnership: {
            findMany: jest.fn().mockResolvedValue([
                {
                    flatId: 'f1',
                    toDate: null,
                    closedReason: null,
                    user: { name: 'Sara', deletedAt: null },
                },
                {
                    flatId: 'f2',
                    toDate: day('2026-04-01'),
                    closedReason: 'ACCOUNT_DELETED',
                    user: { name: 'Gone', deletedAt: new Date() },
                },
                {
                    flatId: 'f1',
                    toDate: day('2019-01-01'),
                    closedReason: 'SOLD',
                    user: { name: 'Old', deletedAt: null },
                },
            ]),
        },
    };
    const db = {
        $transaction: jest.fn(
            async (
                fn: (tx: typeof client) => Promise<unknown>,
                _options?: unknown
            ) => fn(client)
        ),
    };
    return {
        client,
        db,
        raw,
        service: new FinanceDashboardService(db as unknown as DatabaseService),
    };
}

describe('FinanceDashboardService', () => {
    it('400s a future asOf before opening a transaction', async () => {
        const { db, service } = fakeClient();
        const tomorrow = dateOnlyString(addDays(cairoToday(), 1));
        await expect(service.dashboard({ asOf: tomorrow })).rejects.toThrow(
            new BadRequestException('finance.error.futureDate')
        );
        expect(db.$transaction).not.toHaveBeenCalled();
    });

    it('runs every query in one read-only REPEATABLE READ transaction, READ ONLY first', async () => {
        const { db, client, service } = fakeClient();
        const result = await service.dashboard({ asOf: '2026-06-20' });
        expect(result.months).toBe(12);
        expect(db.$transaction).toHaveBeenCalledTimes(1);
        expect(db.$transaction.mock.calls[0]?.[1]).toBe(DASHBOARD_TX_OPTIONS);
        expect(DASHBOARD_TX_OPTIONS.isolationLevel).toBe('RepeatableRead');
        expect(client.$executeRaw.mock.calls[0]?.[0].join('')).toBe(
            'SET TRANSACTION READ ONLY'
        );
        expect(client.$executeRaw.mock.invocationCallOrder[0]).toBeLessThan(
            client.fiscalPeriod.findUnique.mock.invocationCallOrder[0] as number
        );
    });

    // Cross-client contract (accounting slice 9, review L12): the same JSON is copied into the web and mobile
    // test fixtures, where web parses it with `dashboardSchema.strict()` and mobile checks the key set and types.
    // After an intentional response change run `UPDATE_CONTRACT_FIXTURE=1 pnpm test finance-dashboard.spec` and
    // copy the file to apps/web/src/test/fixtures and apps/mobile/src/__tests__/fixtures.
    it('serialises to the shared client contract fixture', async () => {
        const { client, service } = fakeClient();
        const result = await service.build(client as never, day('2026-06-20'), 6);
        const json = JSON.parse(JSON.stringify(result)) as unknown;
        const path = join(__dirname, '../fixtures/finance-dashboard.contract.json');
        if (process.env.UPDATE_CONTRACT_FIXTURE === '1')
            writeFileSync(path, `${JSON.stringify(json, null, 2)}
`);
        expect(json).toEqual(JSON.parse(readFileSync(path, 'utf8')));
    });

    it('assembles every field as Decimal strings', async () => {
        const { client, service } = fakeClient();
        const r = await service.build(client as never, day('2026-06-20'), 6);
        expect(r.period).toEqual({ period: '2026-06', status: 'OPEN' });
        expect(r.cohort).toEqual({
            charges: '2100.00',
            allocated: '1600.00',
            open: '500.00',
            rate: '76.2',
        });
        expect(r.previous.cohort.rate).toBe('50.0');
        // a March charge voided 2 June: +40 in March, −40 in June
        expect(r.billed.map(b => b.amount)).toEqual([
            '0.00',
            '0.00',
            '40.00',
            '0.00',
            '0.00',
            '2060.00',
        ]);
        // OP + OPEN allocations count (Q4); DEP does not; the bounce reverses in June
        expect(r.collected.map(b => b.amount)).toEqual([
            '0.00',
            '0.00',
            '0.00',
            '0.00',
            '300.00',
            '400.00',
        ]);
        expect(r.previous.collected).toBe('300.00');
        expect(r.receiptsByMethod).toEqual([
            {
                method: 'CASH',
                gross: '700.00',
                reversed: '0.00',
                net: '700.00',
            },
            {
                method: 'BANK_TRANSFER',
                gross: '0.00',
                reversed: '0.00',
                net: '0.00',
            },
            {
                method: 'INSTAPAY',
                gross: '0.00',
                reversed: '0.00',
                net: '0.00',
            },
            {
                method: 'CHEQUE',
                gross: '0.00',
                reversed: '-300.00',
                net: '-300.00',
            },
        ]);
        expect(r.deposits).toEqual({ billed: '5000.00', collected: '2000.00' });
        expect(r.outstanding).toBe('6750.00');
        expect(r.aging).toEqual({
            current: '3800.00',
            d31_60: '300.00',
            d61_90: '250.00',
            over90: '2400.00',
        });
        expect(r.credit).toEqual({
            netCreditFlats: 1,
            netCreditTotal: '700.00',
            creditTotal: '1350.00',
        });
        expect([r.owingFlats, r.totalFlats]).toEqual([4, 690]);
        expect(r.fundBalance).toBe('1700.00');
        expect(r.unapplied).toEqual({
            count: 3,
            total: '1350.00',
            oldest: [
                {
                    paymentId: 'p3',
                    flatId: 'f3',
                    flatLabel: 'A1-1-3',
                    method: 'BANK_TRANSFER',
                    receivedAt: '2026-06-01',
                    unallocated: '1000.00',
                    ageDays: 19,
                },
            ],
        });
        expect(r.pendingCheques).toEqual({ count: 1, total: '800.00' });
        expect(r.checks).toEqual({
            previewBillingRuns: 1,
            previewImportBatches: 0,
            operatingChargesInMonth: 4,
        });
        expect(r.byBuilding.map(b => b.building)).toEqual(['A1', 'A2', 'B1']);
        expect(r.byBuilding[1]).toEqual({
            building: 'A2',
            totalFlats: 10,
            owingFlats: 1,
            outstanding: '10.00',
            floors: [
                {
                    floor: 'G',
                    totalFlats: 5,
                    owingFlats: 1,
                    outstanding: '10.00',
                },
                {
                    floor: '2',
                    totalFlats: 5,
                    owingFlats: 0,
                    outstanding: '0.00',
                },
            ],
        });
        expect(r.topOwing).toEqual([
            {
                flatId: 'f5',
                label: 'B1-1-2',
                ownerName: null,
                ownerDeleted: false,
                balance: '3250.00',
                daysPastDue: 26,
            },
            {
                flatId: 'f2',
                label: 'A1-1-2',
                ownerName: null,
                ownerDeleted: true,
                balance: '850.00',
                daysPastDue: 91,
            },
            {
                flatId: 'f1',
                label: 'A1-1-1',
                ownerName: 'Sara',
                ownerDeleted: false,
                balance: '400.00',
                daysPastDue: 10,
            },
        ]);
        expect(r.series).toHaveLength(6);
        expect(r.series[5]).toEqual({
            period: '2026-06',
            date: '2026-06-20',
            outstanding: '6750.00',
            owingFlats: 4,
            fundBalance: '1700.00',
        });
        expect(r.previous).toMatchObject({
            asOf: '2026-05-20',
            outstanding: '3050.00',
            owingFlats: 3,
            fundBalance: '0.00',
        });
        expect(r.deltas).toEqual({
            collected: '33.3',
            outstanding: '121.3',
            owingFlats: '33.3',
            fundBalance: null,
            rate: '26.2',
        });
    });
});

describe('GET /finance/dashboard access', () => {
    const handler = FinanceDashboardController.prototype.get;
    const ctx = (role?: Role) =>
        ({
            getHandler: () => handler,
            getClass: () => FinanceDashboardController,
            switchToHttp: () => ({
                getRequest: () => ({
                    user: role ? { userId: 'u', role } : undefined,
                }),
            }),
        }) as unknown as ExecutionContext;
    const guard = new RolesGuard(new Reflector());

    it('admits ACCOUNTANT, ADMIN and SUPER_ADMIN', () => {
        for (const role of [Role.ACCOUNTANT, Role.ADMIN, Role.SUPER_ADMIN])
            expect(guard.canActivate(ctx(role))).toBe(true);
    });

    it('refuses RESIDENT and MERCHANT (403); a guest has no user (401 from the global JWT guard, the route is not public)', () => {
        for (const role of [Role.RESIDENT, Role.MERCHANT])
            expect(() => guard.canActivate(ctx(role))).toThrow(
                ForbiddenException
            );
        expect(() => guard.canActivate(ctx())).toThrow(ForbiddenException);
        expect(Reflect.getMetadata(PUBLIC_ROUTE_KEY, handler)).toBeUndefined();
        expect(
            Reflect.getMetadata(PUBLIC_ROUTE_KEY, FinanceDashboardController)
        ).toBeUndefined();
    });
});

describe('dashboard and flats query DTOs', () => {
    const check = async <T extends object>(cls: new () => T, plain: object) =>
        (await validate(plainToInstance(cls, plain))).map(e => e.property);

    it('months is 6 or 12; asOf is a date', async () => {
        expect(
            await check(FinanceDashboardQueryDto, {
                months: '6',
                asOf: '2026-06-20',
            })
        ).toEqual([]);
        expect(await check(FinanceDashboardQueryDto, {})).toEqual([]);
        expect(await check(FinanceDashboardQueryDto, { months: '7' })).toEqual([
            'months',
        ]);
        expect(
            await check(FinanceDashboardQueryDto, { asOf: '2026-02-30' })
        ).toEqual(['asOf']);
        expect(
            plainToInstance(FinanceDashboardQueryDto, { months: '12' }).months
        ).toBe(12);
    });

    it('flats sort is layout or balance', async () => {
        expect(await check(FinanceFlatsQueryDto, { sort: 'balance' })).toEqual(
            []
        );
        expect(await check(FinanceFlatsQueryDto, { sort: 'name' })).toEqual([
            'sort',
        ]);
    });
});
