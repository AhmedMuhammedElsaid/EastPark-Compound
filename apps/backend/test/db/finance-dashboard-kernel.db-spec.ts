import {
    ChargeKind,
    EntryDirection,
    FinancePaymentMethod,
    FundEntryKind,
    Prisma,
    PrismaClient,
} from '@prisma/client';

import { addDays, dateOnlyString } from 'src/common/finance/cairo-date';
import { DatabaseService } from 'src/common/database/services/database.service';
import { FinanceDashboardService } from 'src/modules/finance/finance-dashboard.service';
import {
    flowBuckets,
    monthBuckets,
} from 'src/modules/finance/kernel/flow-buckets';
import {
    liveAllocationWhere,
    liveChargeWhere,
    liveFundEntryWhere,
    livePaymentWhere,
} from 'src/modules/finance/kernel/live-predicates';
import {
    asOfSql,
    liveAllocationSpanSql,
    liveAllocationSql,
    liveChargeSpanSql,
    liveChargeSql,
    liveFundEntrySpanSql,
    liveFundEntrySql,
    LiveSpanSql,
    livePaymentSpanSql,
    livePaymentSql,
    spanEnd,
} from 'src/modules/finance/kernel/live-predicates.sql';

import {
    describeDb,
    insertUser,
    ScratchDb,
    TEST_DATABASE_URL,
} from './db-helper';
import { day, ledger } from './finance-ledger-seed';

const ALLOC_FROM = Prisma.sql`"payment_allocations" a JOIN "charges" c ON c."id" = a."chargeId" JOIN "finance_live_payments" p ON p."id" = a."paymentId"`;

interface Span {
    id: string;
    start: Date;
    end: Date | null;
}

/**
 * Slice 9 rule 1 / N-1 against real Postgres (skipped without
 * TEST_DATABASE_URL): every SQL predicate returns the same ids as its Prisma
 * twin on every day around each void and bounce (Cairo-day voids at 22:30 UTC
 * in winter and 21:30 UTC in summer, a bounce voided at the start of its
 * day), the live spans agree with both, and `flowBuckets` equals the month-end
 * differences of the PRISMA sums.
 */
describeDb(
    'finance dashboard kernel: SQL predicate parity and N-1 (real Postgres)',
    () => {
        let scratch: ScratchDb;
        let db: PrismaClient;
        const ACC = 'acc_parity';
        const F = 'flat_C3-1-1';
        const G = 'flat_C3-1-2';

        const sqlIds = async (
            from: Prisma.Sql,
            where: Prisma.Sql,
            idCol: Prisma.Sql
        ) =>
            (
                await db.$queryRaw<{ id: string }[]>(
                    Prisma.sql`SELECT ${idCol} AS "id" FROM ${from} WHERE ${where}`
                )
            )
                .map(r => r.id)
                .sort();
        const spans = async (
            from: Prisma.Sql,
            span: LiveSpanSql,
            idCol: Prisma.Sql
        ): Promise<Span[]> =>
            (
                await db.$queryRaw<
                    {
                        id: string;
                        start: Date;
                        endDate: Date | null;
                        endAt: Date | null;
                    }[]
                >(
                    Prisma.sql`SELECT ${idCol} AS "id", ${span.start} AS "start", ${span.endDate} AS "endDate", ${span.endAt} AS "endAt" FROM ${from}`
                )
            ).map(r => ({
                id: r.id,
                start: r.start,
                end: spanEnd(r.endDate, r.endAt),
            }));
        const liveBySpan = (all: Span[], d: Date) =>
            all
                .filter(
                    s =>
                        s.start.getTime() <= d.getTime() &&
                        (!s.end || d.getTime() < s.end.getTime())
                )
                .map(s => s.id)
                .sort();

        beforeAll(async () => {
            scratch = new ScratchDb(TEST_DATABASE_URL as string);
            scratch.applyAllBefore('99999999999999_end');
            scratch.exec(insertUser(ACC));
            db = new PrismaClient({ datasourceUrl: scratch.url });
            await db.$connect();
            const L = ledger(db, ACC);
            // Charges: posted, voided 22:30 UTC in winter (next Cairo day), 21:30
            // UTC in summer (next Cairo day), 20:59:59 UTC in summer (same day),
            // a later accrual month, a deposit, a VOID with no voidedAt.
            await L.charge({
                id: 'k1',
                flatId: F,
                amount: '100',
                period: '2026-03',
                due: '2026-03-10',
            });
            await L.charge({
                id: 'k2',
                flatId: F,
                amount: '200',
                period: '2026-03',
                due: '2026-03-10',
                voidedAt: new Date('2026-04-10T22:30:00Z'),
            });
            await L.charge({
                id: 'k3',
                flatId: F,
                amount: '300',
                period: '2026-05',
                due: '2026-05-10',
                voidedAt: new Date('2026-07-15T21:30:00Z'),
            });
            await L.charge({
                id: 'k4',
                flatId: F,
                amount: '400',
                period: '2026-05',
                due: '2026-05-10',
            });
            await L.charge({
                id: 'k5',
                flatId: F,
                amount: '500',
                period: '2026-04',
                due: '2026-04-10',
                kind: ChargeKind.MAINTENANCE_DEPOSIT,
            });
            await L.charge({
                id: 'k6',
                flatId: F,
                amount: '600',
                period: '2026-03',
                due: '2026-03-10',
            });
            await db.charge.update({
                where: { id: 'k6' },
                data: { status: 'VOID' },
            });
            await L.charge({
                id: 'k7',
                flatId: G,
                amount: '700',
                period: '2026-03',
                due: '2026-03-10',
                voidedAt: new Date('2026-07-15T20:59:59Z'),
            });
            // Payments: cash, a cheque bounced 04-15, a voided payment, a cleared
            // cheque, one voided on its own Cairo day, one bounced on its receipt day.
            await L.payment({
                id: 'q1',
                flatId: F,
                amount: '1000',
                received: '2026-03-05',
            });
            await L.payment({
                id: 'q2',
                flatId: F,
                amount: '1000',
                received: '2026-03-20',
                method: FinancePaymentMethod.CHEQUE,
            });
            await L.payment({
                id: 'q3',
                flatId: F,
                amount: '50',
                received: '2026-04-01',
                voidedAt: new Date('2026-04-20T10:00:00Z'),
            });
            await L.payment({
                id: 'q4',
                flatId: F,
                amount: '700',
                received: '2026-04-02',
                method: FinancePaymentMethod.CHEQUE,
                cleared: '2026-04-05',
            });
            await L.payment({
                id: 'q5',
                flatId: G,
                amount: '10',
                received: '2026-04-01',
                voidedAt: new Date('2026-04-01T21:59:00Z'),
            });
            await L.payment({
                id: 'q6',
                flatId: G,
                amount: '20',
                received: '2026-05-02',
                method: FinancePaymentMethod.CHEQUE,
                bounced: '2026-05-02',
            });
            await L.payment({
                id: 'q7',
                flatId: G,
                amount: '700',
                received: '2026-03-21',
                method: FinancePaymentMethod.CHEQUE,
            });
            // Allocations.
            await L.allocation({
                id: 'a1',
                paymentId: 'q1',
                chargeId: 'k1',
                amount: '60',
                at: '2026-03-05',
            });
            await L.allocation({
                id: 'a2',
                paymentId: 'q2',
                chargeId: 'k4',
                amount: '400',
                at: '2026-03-20',
            }); // charge starts after the bounce
            await L.allocation({
                id: 'a3',
                paymentId: 'q2',
                chargeId: 'k1',
                amount: '40',
                at: '2026-03-20',
            });
            await L.allocation({
                id: 'a4',
                paymentId: 'q3',
                chargeId: 'k4',
                amount: '50',
                at: '2026-05-01',
                voidedAt: new Date('2026-04-20T10:00:00Z'),
            });
            await L.allocation({
                id: 'a5',
                paymentId: 'q1',
                chargeId: 'k3',
                amount: '300',
                at: '2026-03-06',
            }); // charge voided in July
            await L.allocation({
                id: 'a6',
                paymentId: 'q4',
                chargeId: 'k5',
                amount: '500',
                at: '2026-04-02',
            });
            await L.allocation({
                id: 'a7',
                paymentId: 'q4',
                chargeId: 'k2',
                amount: '200',
                at: '2026-04-03',
                voidedAt: new Date('2026-05-01T09:00:00Z'),
            });
            await L.allocation({
                id: 'a8',
                paymentId: 'q7',
                chargeId: 'k7',
                amount: '700',
                at: '2026-03-21',
            });
            await L.bounce('q2', '2026-04-15');
            await L.bounce('q7', '2026-04-16'); // its charge is voided later (July): one reversal, at the bounce
            // Fund entries.
            await L.fund({
                id: 'e1',
                amount: '500',
                date: '2026-04-02',
                paymentId: 'q4',
            });
            await L.fund({
                id: 'e2',
                amount: '80',
                date: '2026-04-03',
                voidedAt: new Date('2026-04-10T22:30:00Z'),
            });
            await L.fund({
                id: 'e3',
                amount: '30',
                date: '2026-05-01',
                kind: FundEntryKind.MAINTENANCE_OUT,
                direction: EntryDirection.OUT,
            });
            await L.fund({
                id: 'e4',
                amount: '999',
                date: '2026-03-01',
                counts: false,
            });
        });

        afterAll(async () => {
            await db?.$disconnect();
            scratch?.drop();
        });

        it('each SQL fragment and its span return the Prisma twin ids on every day from Feb to late July', async () => {
            const chargeSpans = await spans(
                Prisma.sql`"charges" c`,
                liveChargeSpanSql(),
                Prisma.sql`c."id"`
            );
            const paymentSpans = await spans(
                Prisma.sql`"finance_live_payments" p`,
                livePaymentSpanSql(),
                Prisma.sql`p."id"`
            );
            const allocationSpans = await spans(
                ALLOC_FROM,
                liveAllocationSpanSql(),
                Prisma.sql`a."id"`
            );
            const fundSpans = await spans(
                Prisma.sql`"fund_entries" f`,
                liveFundEntrySpanSql(),
                Prisma.sql`f."id"`
            );

            for (
                let d = day('2026-02-25');
                d.getTime() <= day('2026-07-20').getTime();
                d = addDays(d, 1)
            ) {
                const label = dateOnlyString(d);
                const sql = asOfSql(d);
                const prisma = {
                    charges: (
                        await db.charge.findMany({
                            where: liveChargeWhere(d),
                            select: { id: true },
                        })
                    )
                        .map(r => r.id)
                        .sort(),
                    payments: (
                        await db.payment.findMany({
                            where: livePaymentWhere(d),
                            select: { id: true },
                        })
                    )
                        .map(r => r.id)
                        .sort(),
                    allocations: (
                        await db.paymentAllocation.findMany({
                            where: liveAllocationWhere(d),
                            select: { id: true },
                        })
                    )
                        .map(r => r.id)
                        .sort(),
                    fund: (
                        await db.fundEntry.findMany({
                            where: liveFundEntryWhere(d),
                            select: { id: true },
                        })
                    )
                        .map(r => r.id)
                        .sort(),
                };
                const viaSql = {
                    charges: await sqlIds(
                        Prisma.sql`"charges" c`,
                        liveChargeSql(sql),
                        Prisma.sql`c."id"`
                    ),
                    payments: await sqlIds(
                        Prisma.sql`"finance_live_payments" p`,
                        livePaymentSql(sql),
                        Prisma.sql`p."id"`
                    ),
                    allocations: await sqlIds(
                        ALLOC_FROM,
                        liveAllocationSql(sql),
                        Prisma.sql`a."id"`
                    ),
                    fund: await sqlIds(
                        Prisma.sql`"fund_entries" f`,
                        liveFundEntrySql(sql),
                        Prisma.sql`f."id"`
                    ),
                };
                const viaSpans = {
                    charges: liveBySpan(chargeSpans, d),
                    payments: liveBySpan(paymentSpans, d),
                    allocations: liveBySpan(allocationSpans, d),
                    fund: liveBySpan(fundSpans, d),
                };
                expect({ label, ...viaSql }).toEqual({ label, ...prisma });
                expect({ label, ...viaSpans }).toEqual({ label, ...prisma });
            }
        });

        it('spot checks: Cairo-day voids, double invalidation reverses once at the earlier date', async () => {
            const alloc = await spans(
                ALLOC_FROM,
                liveAllocationSpanSql(),
                Prisma.sql`a."id"`
            );
            const byId = new Map(alloc.map(s => [s.id, s]));
            // a7: charge k2 voided 2026-04-10 22:30 UTC = 11 April in Cairo, before its own void (1 May)
            expect(dateOnlyString(byId.get('a7')?.end as Date)).toBe(
                '2026-04-11'
            );
            // a8: bounced 16 April, charge voided in July: ends at the bounce
            expect(dateOnlyString(byId.get('a8')?.end as Date)).toBe(
                '2026-04-16'
            );
            // a4: allocated (01 May) after its payment was voided (20 April): never live
            const a4 = byId.get('a4') as Span;
            expect((a4.end as Date).getTime()).toBeLessThanOrEqual(
                a4.start.getTime()
            );
            const charges = await spans(
                Prisma.sql`"charges" c`,
                liveChargeSpanSql(),
                Prisma.sql`c."id"`
            );
            const k = new Map(charges.map(s => [s.id, s]));
            expect(dateOnlyString(k.get('k3')?.end as Date)).toBe('2026-07-16'); // 21:30 UTC in summer
            expect(dateOnlyString(k.get('k7')?.end as Date)).toBe('2026-07-15'); // 20:59:59 UTC in summer
        });

        it('flowBuckets equals the month-end differences of the Prisma sums', async () => {
            const D_ = day('2026-07-20');
            const buckets = monthBuckets(D_, 6);
            const prev = addDays(buckets[0]?.from as Date, -1);
            const ends = [prev, ...buckets.map(b => b.to)];
            const sumWhere = async (
                kind: 'charge' | 'allocation' | 'fund',
                d: Date
            ) => {
                if (kind === 'charge')
                    return (
                        (
                            await db.charge.aggregate({
                                where: liveChargeWhere(d),
                                _sum: { amount: true },
                            })
                        )._sum.amount ?? new Prisma.Decimal(0)
                    );
                if (kind === 'allocation')
                    return (
                        (
                            await db.paymentAllocation.aggregate({
                                where: liveAllocationWhere(d),
                                _sum: { amount: true },
                            })
                        )._sum.amount ?? new Prisma.Decimal(0)
                    );
                return (
                    (
                        await db.fundEntry.aggregate({
                            where: liveFundEntryWhere(d),
                            _sum: { amount: true },
                        })
                    )._sum.amount ?? new Prisma.Decimal(0)
                );
            };
            const cases = [
                {
                    kind: 'charge' as const,
                    from: Prisma.sql`"charges" c`,
                    span: liveChargeSpanSql(),
                    amount: Prisma.sql`c."amount"`,
                },
                {
                    kind: 'allocation' as const,
                    from: ALLOC_FROM,
                    span: liveAllocationSpanSql(),
                    amount: Prisma.sql`a."amount"`,
                },
                {
                    kind: 'fund' as const,
                    from: Prisma.sql`"fund_entries" f`,
                    span: liveFundEntrySpanSql(),
                    amount: Prisma.sql`f."amount"`,
                },
            ];
            for (const c of cases) {
                const rows = await db.$queryRaw<
                    {
                        amount: Prisma.Decimal;
                        start: Date;
                        endDate: Date | null;
                        endAt: Date | null;
                    }[]
                >(
                    Prisma.sql`SELECT ${c.amount} AS "amount", ${c.span.start} AS "start", ${c.span.endDate} AS "endDate", ${c.span.endAt} AS "endAt" FROM ${c.from}`
                );
                const flows = flowBuckets(
                    rows.map(r => ({
                        amount: r.amount,
                        start: r.start,
                        end: spanEnd(r.endDate, r.endAt),
                    })),
                    buckets
                );
                const S = await Promise.all(ends.map(e => sumWhere(c.kind, e)));
                const expected = buckets.map((_, i) =>
                    (S[i + 1] as Prisma.Decimal)
                        .sub(S[i] as Prisma.Decimal)
                        .toFixed(2)
                );
                expect({
                    kind: c.kind,
                    flows: flows.map(f => f.net.toFixed(2)),
                }).toEqual({ kind: c.kind, flows: expected });
            }
        });

        describe('N-1 additivity before and after a reversal', () => {
            let service: FinanceDashboardService;
            const H = 'flat_E2-3-1';
            const at = (s: string) => day(s);
            const L = () => ledger(db, ACC);

            beforeAll(() => {
                service = new FinanceDashboardService(
                    db as unknown as DatabaseService
                );
            });

            /** The range total equals the sum of its months, and equals S(D) − S(window start − 1) with the Prisma twins. */
            const expectAdditive = async (asOf: string) => {
                const r = await service.build(db, at(asOf), 6);
                const buckets = monthBuckets(at(asOf), 6);
                const before = addDays(buckets[0]?.from as Date, -1);
                const S = async (d: Date) =>
                    (
                        await db.paymentAllocation.aggregate({
                            where: {
                                AND: [
                                    liveAllocationWhere(d),
                                    {
                                        charge: {
                                            kind: {
                                                not: ChargeKind.MAINTENANCE_DEPOSIT,
                                            },
                                        },
                                    },
                                ],
                            },
                            _sum: { amount: true },
                        })
                    )._sum.amount ?? new Prisma.Decimal(0);
                const total = r.collected.reduce(
                    (a, c) => a.add(c.amount),
                    new Prisma.Decimal(0)
                );
                expect(total.toFixed(2)).toBe(
                    (await S(at(asOf))).sub(await S(before)).toFixed(2)
                );
                return r;
            };
            const month = (
                r: { collected: { period: string; amount: string }[] },
                p: string
            ) => r.collected.find(c => c.period === p)?.amount;

            it('an October cheque bounced in November: October unchanged, November −amount', async () => {
                await L().charge({
                    id: 'n_k1',
                    flatId: H,
                    amount: '450',
                    period: '2026-10',
                    due: '2026-10-10',
                });
                await L().payment({
                    id: 'n_q1',
                    flatId: H,
                    amount: '450',
                    received: '2026-10-05',
                    method: FinancePaymentMethod.CHEQUE,
                });
                await L().allocation({
                    paymentId: 'n_q1',
                    chargeId: 'n_k1',
                    amount: '450',
                    at: '2026-10-05',
                });
                const before = await expectAdditive('2026-11-10');
                const october = (await service.build(db, at('2026-10-31'), 6))
                    .collected;
                await L().bounce('n_q1', '2026-11-04');
                const after = await expectAdditive('2026-11-10');
                expect(month(after, '2026-10')).toBe(month(before, '2026-10'));
                expect(
                    new Prisma.Decimal(month(after, '2026-11') as string)
                        .sub(month(before, '2026-11') as string)
                        .toFixed(2)
                ).toBe('-450.00');
                expect(
                    (await service.build(db, at('2026-10-31'), 6)).collected
                ).toEqual(october);
            });

            it('a voided payment and a voided allocation reverse in their own month', async () => {
                await L().charge({
                    id: 'n_k2',
                    flatId: H,
                    amount: '300',
                    period: '2026-10',
                    due: '2026-10-10',
                });
                await L().payment({
                    id: 'n_q2',
                    flatId: H,
                    amount: '300',
                    received: '2026-10-06',
                });
                await L().allocation({
                    id: 'n_a2',
                    paymentId: 'n_q2',
                    chargeId: 'n_k2',
                    amount: '300',
                    at: '2026-10-06',
                });
                await L().charge({
                    id: 'n_k3',
                    flatId: H,
                    amount: '120',
                    period: '2026-10',
                    due: '2026-10-10',
                });
                await L().payment({
                    id: 'n_q3',
                    flatId: H,
                    amount: '120',
                    received: '2026-10-07',
                });
                await L().allocation({
                    id: 'n_a3',
                    paymentId: 'n_q3',
                    chargeId: 'n_k3',
                    amount: '120',
                    at: '2026-10-07',
                });
                const before = await expectAdditive('2026-11-10');
                const voidAt = new Date('2026-11-03T22:30:00Z'); // 4 November in Cairo
                await db.payment.update({
                    where: { id: 'n_q2' },
                    data: { status: 'VOID', voidedAt: voidAt },
                });
                await db.paymentAllocation.update({
                    where: { id: 'n_a2' },
                    data: { voidedAt: voidAt },
                });
                await db.paymentAllocation.update({
                    where: { id: 'n_a3' },
                    data: { voidedAt: voidAt },
                });
                const after = await expectAdditive('2026-11-10');
                expect(month(after, '2026-10')).toBe(month(before, '2026-10'));
                expect(
                    new Prisma.Decimal(month(after, '2026-11') as string)
                        .sub(month(before, '2026-11') as string)
                        .toFixed(2)
                ).toBe('-420.00');
                const cash = (r: Awaited<ReturnType<typeof service.build>>) =>
                    r.receiptsByMethod.find(m => m.method === 'CASH');
                const novBefore = cash(before);
                const novAfter = cash(after);
                expect(
                    new Prisma.Decimal(novAfter?.reversed as string)
                        .sub(novBefore?.reversed as string)
                        .toFixed(2)
                ).toBe('-300.00');
            });

            it('a voided charge reverses billed in its void month; a voided DEPOSIT_IN reverses the fund flow', async () => {
                await L().charge({
                    id: 'n_k4',
                    flatId: H,
                    amount: '75',
                    period: '2026-10',
                    due: '2026-10-10',
                });
                await L().fund({
                    id: 'n_e1',
                    amount: '640',
                    date: '2026-10-12',
                });
                const oct = await service.build(db, at('2026-10-31'), 6);
                const before = await service.build(db, at('2026-11-10'), 6);
                const voidAt = new Date('2026-11-05T08:00:00Z');
                await db.charge.update({
                    where: { id: 'n_k4' },
                    data: { status: 'VOID', voidedAt: voidAt },
                });
                await db.fundEntry.update({
                    where: { id: 'n_e1' },
                    data: { status: 'VOID', voidedAt: voidAt },
                });
                const after = await service.build(db, at('2026-11-10'), 6);
                const billed = (r: typeof after, p: string) =>
                    r.billed.find(b => b.period === p)?.amount;
                expect(billed(after, '2026-10')).toBe(
                    billed(before, '2026-10')
                );
                expect(
                    new Prisma.Decimal(billed(after, '2026-11') as string)
                        .sub(billed(before, '2026-11') as string)
                        .toFixed(2)
                ).toBe('-75.00');
                expect(
                    new Prisma.Decimal(after.deposits.collected)
                        .sub(before.deposits.collected)
                        .toFixed(2)
                ).toBe('-640.00');
                expect(
                    new Prisma.Decimal(after.fundBalance)
                        .sub(before.fundBalance)
                        .toFixed(2)
                ).toBe('-640.00');
                const octAgain = await service.build(db, at('2026-10-31'), 6);
                expect(octAgain.billed).toEqual(oct.billed);
                expect(octAgain.deposits).toEqual(oct.deposits);
                expect(octAgain.fundBalance).toBe(oct.fundBalance);
            });

            it('an original before the window shows only its reversal', async () => {
                await L().charge({
                    id: 'n_k5',
                    flatId: H,
                    amount: '90',
                    period: '2026-01',
                    due: '2026-01-10',
                });
                await L().payment({
                    id: 'n_q5',
                    flatId: H,
                    amount: '90',
                    received: '2026-01-05',
                    method: FinancePaymentMethod.CHEQUE,
                });
                await L().allocation({
                    paymentId: 'n_q5',
                    chargeId: 'n_k5',
                    amount: '90',
                    at: '2026-01-05',
                });
                const before = await expectAdditive('2026-11-10'); // window Jun–Nov: January is outside
                await L().bounce('n_q5', '2026-11-06');
                const after = await expectAdditive('2026-11-10');
                for (const p of [
                    '2026-06',
                    '2026-07',
                    '2026-08',
                    '2026-09',
                    '2026-10',
                ])
                    expect(month(after, p)).toBe(month(before, p));
                expect(
                    new Prisma.Decimal(month(after, '2026-11') as string)
                        .sub(month(before, '2026-11') as string)
                        .toFixed(2)
                ).toBe('-90.00');
            });
        });
    }
);
