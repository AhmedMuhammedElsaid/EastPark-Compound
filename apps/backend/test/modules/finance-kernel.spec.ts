import {
    assertRequestKeyFree,
    RequestKeyTaken,
} from 'src/modules/finance/kernel/idempotency';
import {
    assertPeriodsLocked,
    PeriodSetGrew,
    periodRange,
    withPeriodRetry,
} from 'src/modules/finance/kernel/locks';
import {
    BadRequestException,
    ConflictException,
    ForbiddenException,
    NotFoundException,
} from '@nestjs/common';
import { PostingStatus, Prisma, Role } from '@prisma/client';

import { parseDateOnly } from 'src/common/finance/cairo-date';
import {
    canonicalJson,
    requestHashOf,
    requireIdempotencyKey,
    runIdempotent,
} from 'src/modules/finance/kernel/idempotency';
import { parseFinanceAmount } from 'src/modules/finance/kernel/finance-money';
import { FinanceTx } from 'src/modules/finance/kernel/finance-tx';
import {
    summariseFlat,
    summariseFlats,
} from 'src/modules/finance/kernel/ledger';
import {
    endOfCairoDay,
    liveAllocationWhere,
    liveChargeWhere,
    livePaymentWhere,
} from 'src/modules/finance/kernel/live-predicates';
import {
    lockCharges,
    lockFlat,
    lockPeriods,
} from 'src/modules/finance/kernel/locks';
import {
    formatReceiptNo,
    nextReceiptNumber,
    reserveReceiptNumbers,
} from 'src/modules/finance/kernel/receipt-counter';
import { assertCanVoid } from 'src/modules/finance/kernel/void-policy';

import { fakeFinanceState, fakeRaw } from '../mocks/finance-raw.mock';

const D = (s: string) => new Prisma.Decimal(s);
const day = parseDateOnly;

function rawTx(state = fakeFinanceState(), startMonth: number | null = 1) {
    const raw = fakeRaw(state);
    const tx = {
        ...raw,
        financeSetting: {
            findUnique: jest
                .fn()
                .mockResolvedValue(
                    startMonth === null ? null : { value: startMonth }
                ),
        },
    };
    return { tx: tx as unknown as FinanceTx, raw, state };
}

describe('lockPeriods (plan 3.2, lock-order step 0)', () => {
    it('upserts then locks each period FOR SHARE in ascending order, deduplicated', async () => {
        const { tx, raw, state } = rawTx();
        await lockPeriods(tx, ['2026-11', '2026-10', '2026-11']);
        expect(state.log).toEqual([
            'upsert-period:2026-10',
            'lock-period:2026-10',
            'upsert-period:2026-11',
            'lock-period:2026-11',
        ]);
        const lockSql = (raw.$queryRaw.mock.calls[0]?.[0] as { sql: string })
            .sql;
        expect(lockSql).toContain('FOR SHARE');
        const upsertSql = (
            raw.$executeRaw.mock.calls[0]?.[0] as { sql: string }
        ).sql;
        expect(upsertSql).toContain('ON CONFLICT ("period") DO NOTHING');
    });

    it('refuses a CLOSED period with 409 finance.error.periodClosed', async () => {
        const { tx } = rawTx(
            fakeFinanceState({ periods: new Map([['2026-10', 'CLOSED']]) })
        );
        await expect(lockPeriods(tx, ['2026-11', '2026-10'])).rejects.toThrow(
            new ConflictException('finance.error.periodClosed')
        );
    });

    it('rejects a malformed period before touching the database', async () => {
        const { tx, raw } = rawTx();
        await expect(lockPeriods(tx, ['2026-13'])).rejects.toThrow(
            new BadRequestException('finance.error.invalidPeriod')
        );
        expect(raw.$executeRaw).not.toHaveBeenCalled();
    });
});

describe('lockFlat / lockCharges (lock-order steps 1 and 2)', () => {
    it('locks the flat FOR UPDATE and 404s an unknown flat', async () => {
        const { tx, raw } = rawTx();
        await expect(lockFlat(tx, 'flat-1')).resolves.toMatchObject({
            label: 'A1-3-2',
        });
        expect(
            (raw.$queryRaw.mock.calls[0]?.[0] as { sql: string }).sql
        ).toContain('FOR UPDATE');
        await expect(lockFlat(tx, 'nope')).rejects.toThrow(
            new NotFoundException('finance.error.flatNotFound')
        );
    });

    it('locks charges in ascending id order, nothing for an empty list', async () => {
        const { tx, raw, state } = rawTx();
        await expect(lockCharges(tx, [])).resolves.toEqual([]);
        expect(raw.$queryRaw).not.toHaveBeenCalled();
        await lockCharges(tx, ['c3', 'c1', 'c3']);
        expect(state.log).toEqual(['lock-charges:c1,c3']);
    });
});

describe('receipt counter (plan 3.4)', () => {
    it('formats <scope>-<year>-<6 digits>', () => {
        expect(formatReceiptNo('R', '2026', 123)).toBe('R-2026-000123');
    });

    it('numbers by the accounting date year, not the click time', async () => {
        const { tx } = rawTx();
        await expect(
            nextReceiptNumber(tx, 'R', day('2026-12-31'))
        ).resolves.toBe('R-2026-000001');
        await expect(
            nextReceiptNumber(tx, 'R', day('2027-01-01'))
        ).resolves.toBe('R-2027-000001');
        await expect(
            nextReceiptNumber(tx, 'R', day('2026-06-01'))
        ).resolves.toBe('R-2026-000002');
    });

    it('reserves a bulk range with one statement per year, aligned with the input', async () => {
        const { tx, state } = rawTx();
        state.counters.set('O:2026', 10);
        const numbers = await reserveReceiptNumbers(tx, 'O', [
            day('2026-12-31'),
            day('2027-01-02'),
            day('2026-12-30'),
        ]);
        expect(numbers).toEqual([
            'O-2026-000011',
            'O-2027-000001',
            'O-2026-000012',
        ]);
        expect(state.log).toEqual(['counter:O:2026+2', 'counter:O:2027+1']);
    });

    it('uses the fiscal label when the year does not start in January', async () => {
        const { tx } = rawTx(fakeFinanceState(), 7);
        await expect(
            nextReceiptNumber(tx, 'E', day('2027-03-01'))
        ).resolves.toBe('E-2627-000001');
    });

    it('defaults to a January year when the setting is missing', async () => {
        const { tx } = rawTx(fakeFinanceState(), null);
        await expect(
            nextReceiptNumber(tx, 'F', day('2026-03-01'))
        ).resolves.toBe('F-2026-000001');
    });

    it('returns nothing for an empty bulk', async () => {
        const { tx, raw } = rawTx();
        await expect(reserveReceiptNumbers(tx, 'O', [])).resolves.toEqual([]);
        expect(raw.$queryRaw).not.toHaveBeenCalled();
    });
});

describe('idempotency (plan 3.3)', () => {
    const p2002 = Object.assign(new Error('unique'), {
        code: 'P2002',
        meta: { target: ['requestKey'] },
    });

    it('canonical JSON sorts keys and drops undefined', () => {
        expect(canonicalJson({ b: 1, a: { d: undefined, c: [2, 1] } })).toBe(
            '{"a":{"c":[2,1]},"b":1}'
        );
        expect(requestHashOf('u1', { a: 1, b: 2 })).toBe(
            requestHashOf('u1', { b: 2, a: 1 })
        );
        expect(requestHashOf('u1', { a: 1 })).not.toBe(
            requestHashOf('u1', { a: 2 })
        );
    });

    it('hashes the normalised request: number vs string amounts and dates match (review L5)', () => {
        const asNumber = {
            flatId: 'f',
            amount: parseFinanceAmount(450),
            receivedAt: day('2026-11-02'),
        };
        const asString = {
            receivedAt: day('2026-11-02'),
            amount: parseFinanceAmount('450.00'),
            flatId: 'f',
        };
        expect(requestHashOf('u1', asNumber)).toBe(
            requestHashOf('u1', asString)
        );
        expect(canonicalJson(asNumber)).toBe(
            '{"amount":"450.00","flatId":"f","receivedAt":"2026-11-02"}'
        );
        expect(
            requestHashOf('u1', {
                ...asNumber,
                amount: parseFinanceAmount('450.01'),
            })
        ).not.toBe(requestHashOf('u1', asNumber));
    });

    it('another user reusing a key gets idempotencyConflict, never a replay', async () => {
        const request = { amount: parseFinanceAmount('450') };
        const original = {
            id: 'p1',
            requestHash: requestHashOf('u1', request),
        };
        const create = jest.fn();
        await expect(
            runIdempotent({
                requestHash: requestHashOf('u2', request),
                find: jest.fn().mockResolvedValue(original),
                create,
            })
        ).rejects.toThrow(
            new ConflictException('finance.error.idempotencyConflict')
        );
        expect(create).not.toHaveBeenCalled();
        await expect(
            runIdempotent({
                requestHash: requestHashOf('u1', request),
                find: jest.fn().mockResolvedValue(original),
                create,
            })
        ).resolves.toMatchObject({ replayed: true });
    });

    it('requires a sane Idempotency-Key header', () => {
        expect(
            requireIdempotencyKey(' 0b8f6c1e-1d2a-4f00-9a51-6f0d1c2b3a4e ')
        ).toBe('0b8f6c1e-1d2a-4f00-9a51-6f0d1c2b3a4e');
        expect(requireIdempotencyKey(['abcdefgh'])).toBe('abcdefgh');
        for (const bad of [
            undefined,
            '',
            'short',
            'has space here',
            'x'.repeat(101),
        ])
            expect(() => requireIdempotencyKey(bad)).toThrow(
                new BadRequestException('finance.error.idempotencyKeyRequired')
            );
    });

    it('creates once when the key is new', async () => {
        const create = jest
            .fn()
            .mockResolvedValue({ id: 'p1', requestHash: 'h' });
        const out = await runIdempotent({
            requestHash: 'h',
            find: jest.fn().mockResolvedValue(null),
            create,
        });
        expect(out).toEqual({
            result: { id: 'p1', requestHash: 'h' },
            replayed: false,
        });
        expect(create).toHaveBeenCalledTimes(1);
    });

    it('returns the original row for a replay with the same body', async () => {
        const create = jest.fn();
        const out = await runIdempotent({
            requestHash: 'h',
            find: jest.fn().mockResolvedValue({ id: 'p1', requestHash: 'h' }),
            create,
        });
        expect(out.replayed).toBe(true);
        expect(create).not.toHaveBeenCalled();
    });

    it('is idempotencyConflict for another body under the same key', async () => {
        await expect(
            runIdempotent({
                requestHash: 'h2',
                find: jest
                    .fn()
                    .mockResolvedValue({ id: 'p1', requestHash: 'h1' }),
                create: jest.fn(),
            })
        ).rejects.toThrow(
            new ConflictException('finance.error.idempotencyConflict')
        );
    });

    it('a concurrent loser (P2002) re-reads and returns the winner', async () => {
        const find = jest
            .fn()
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce({ id: 'winner', requestHash: 'h' });
        const out = await runIdempotent({
            requestHash: 'h',
            find,
            create: jest.fn().mockRejectedValue(p2002),
        });
        expect(out).toEqual({
            result: { id: 'winner', requestHash: 'h' },
            replayed: true,
        });
    });

    it('a concurrent loser with another body gets idempotencyConflict', async () => {
        const find = jest
            .fn()
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce({ id: 'winner', requestHash: 'other' });
        await expect(
            runIdempotent({
                requestHash: 'h',
                find,
                create: jest.fn().mockRejectedValue(p2002),
            })
        ).rejects.toThrow(
            new ConflictException('finance.error.idempotencyConflict')
        );
    });

    it('rethrows a P2002 that is not about the key, and any other error', async () => {
        await expect(
            runIdempotent({
                requestHash: 'h',
                find: jest.fn().mockResolvedValue(null),
                create: jest.fn().mockRejectedValue(p2002),
            })
        ).rejects.toBe(p2002);
        const boom = new Error('boom');
        await expect(
            runIdempotent({
                requestHash: 'h',
                find: jest.fn().mockResolvedValue(null),
                create: jest.fn().mockRejectedValue(boom),
            })
        ).rejects.toBe(boom);
    });
});

describe('parseFinanceAmount (plan 3.5)', () => {
    it('keeps the typed value exactly, from a number or a string', () => {
        expect(parseFinanceAmount(450).toFixed(2)).toBe('450.00');
        expect(parseFinanceAmount(0.1).toString()).toBe('0.1');
        expect(parseFinanceAmount('1234.56').toString()).toBe('1234.56');
        expect(parseFinanceAmount('9999999.99').toString()).toBe('9999999.99');
        expect(parseFinanceAmount(0.01).toString()).toBe('0.01');
    });

    it('rejects extra precision instead of rounding (float noise included)', () => {
        for (const v of [1.005, '10.123', 0.1 + 0.2])
            expect(() => parseFinanceAmount(v)).toThrow(
                new BadRequestException('finance.error.amountPrecision')
            );
    });

    it('rejects out-of-range and non-numeric values', () => {
        for (const v of [0, -5, '0.00', 10_000_000])
            expect(() => parseFinanceAmount(v)).toThrow(
                new BadRequestException('finance.error.amountOutOfRange')
            );
        for (const v of [NaN, Infinity, 'abc', '', null, undefined, {}])
            expect(() => parseFinanceAmount(v)).toThrow(
                new BadRequestException('finance.error.invalidAmount')
            );
    });
});

describe('assertCanVoid (plan 3.6)', () => {
    const accountant = { userId: 'acc-1', role: Role.ACCOUNTANT };
    // created 23:30 Cairo on 2 November (21:30Z, UTC+2)
    const entry = {
        createdById: 'acc-1',
        createdAt: new Date('2026-11-02T21:30:00Z'),
    };

    it('lets the posting accountant void until Cairo midnight', () => {
        expect(() =>
            assertCanVoid(accountant, entry, new Date('2026-11-02T21:59:00Z'))
        ).not.toThrow();
    });

    it('refuses the same accountant on the next Cairo day, even the same UTC day', () => {
        // 00:10 Cairo on 3 November is still 2 November in UTC
        expect(() =>
            assertCanVoid(accountant, entry, new Date('2026-11-02T22:10:00Z'))
        ).toThrow(new ForbiddenException('finance.error.voidNotAllowed'));
    });

    it('refuses another accountant on the same day', () => {
        expect(() =>
            assertCanVoid(
                { userId: 'acc-2', role: Role.ACCOUNTANT },
                entry,
                new Date('2026-11-02T21:40:00Z')
            )
        ).toThrow(new ForbiddenException('finance.error.voidNotAllowed'));
    });

    it('lets ADMIN and SUPER_ADMIN void any entry on any day', () => {
        for (const role of [Role.ADMIN, Role.SUPER_ADMIN])
            expect(() =>
                assertCanVoid(
                    { userId: 'a', role },
                    entry,
                    new Date('2027-03-01T10:00:00Z')
                )
            ).not.toThrow();
    });

    it('refuses any other role', () => {
        expect(() =>
            assertCanVoid(
                { userId: 'acc-1', role: Role.RESIDENT },
                entry,
                entry.createdAt
            )
        ).toThrow(ForbiddenException);
    });
});

describe('live predicates (plan 2.1.1)', () => {
    const asOf = day('2026-10-31');
    const end = endOfCairoDay(asOf);

    it('end of a Cairo day is the next day start (UTC+2 in late October)', () => {
        expect(end.toISOString()).toBe('2026-10-31T22:00:00.000Z');
    });

    it('livePaymentWhere: received by D, not voided by D, not bounced by D', () => {
        expect(livePaymentWhere(asOf)).toEqual({
            receivedAt: { lte: asOf },
            AND: [
                {
                    OR: [
                        { status: PostingStatus.POSTED },
                        { voidedAt: { gte: end } },
                    ],
                },
                { OR: [{ bouncedAt: null }, { bouncedAt: { gt: asOf } }] },
            ],
        });
    });

    it('liveChargeWhere: accrual month started by D and not voided by D', () => {
        expect(liveChargeWhere(asOf)).toEqual({
            accrualPeriod: { lte: '2026-10' },
            OR: [{ status: PostingStatus.POSTED }, { voidedAt: { gte: end } }],
        });
    });

    it('liveAllocationWhere: allocated and not voided by D, with a live charge and payment', () => {
        expect(liveAllocationWhere(asOf)).toEqual({
            allocatedAt: { lte: asOf },
            OR: [{ voidedAt: null }, { voidedAt: { gte: end } }],
            charge: liveChargeWhere(asOf),
            payment: livePaymentWhere(asOf),
        });
    });
});

describe('ledger figures (plan 2.1.1)', () => {
    function client(data: {
        charges: {
            id: string;
            flatId: string;
            amount: string;
            dueDate: string;
        }[];
        allocations: { amount: string; chargeId: string; flatId: string }[];
        payments: { flatId: string; amount: string }[];
    }) {
        return {
            charge: {
                findMany: jest.fn().mockResolvedValue(
                    data.charges.map(c => ({
                        ...c,
                        amount: D(c.amount),
                        dueDate: day(c.dueDate),
                    }))
                ),
            },
            paymentAllocation: {
                findMany: jest.fn().mockResolvedValue(
                    data.allocations.map(a => ({
                        amount: D(a.amount),
                        chargeId: a.chargeId,
                        payment: { flatId: a.flatId },
                    }))
                ),
            },
            payment: {
                groupBy: jest.fn().mockResolvedValue(
                    data.payments.map(p => ({
                        flatId: p.flatId,
                        _sum: { amount: D(p.amount) },
                    }))
                ),
            },
        };
    }

    const fixtures = {
        'no activity': { charges: [], allocations: [], payments: [] },
        'partly paid, overdue': {
            charges: [
                { id: 'c1', flatId: 'f', amount: '450', dueDate: '2026-10-10' },
                { id: 'c2', flatId: 'f', amount: '450', dueDate: '2026-11-10' },
            ],
            allocations: [{ amount: '450', chargeId: 'c1', flatId: 'f' }],
            payments: [{ flatId: 'f', amount: '450' }],
        },
        'overpaid: credit': {
            charges: [
                {
                    id: 'c1',
                    flatId: 'f',
                    amount: '300.50',
                    dueDate: '2026-10-10',
                },
            ],
            allocations: [{ amount: '300.50', chargeId: 'c1', flatId: 'f' }],
            payments: [{ flatId: 'f', amount: '1000' }],
        },
        'paid, unallocated': {
            charges: [
                {
                    id: 'c1',
                    flatId: 'f',
                    amount: '0.10',
                    dueDate: '2026-09-01',
                },
            ],
            allocations: [],
            payments: [{ flatId: 'f', amount: '0.20' }],
        },
    };

    it.each(Object.entries(fixtures))(
        'invariant balance = open charges - credit (%s)',
        async (_name, data) => {
            const s = await summariseFlat(
                client(data) as unknown as FinanceTx,
                'f',
                day('2026-11-02')
            );
            expect(s.balance.toString()).toBe(
                s.openAmount.sub(s.credit).toString()
            );
            expect(s.availableCredit.toString()).toBe(s.credit.toString());
        }
    );

    it('computes balance, credit, overdue and oldest due days exactly', async () => {
        const s = await summariseFlat(
            client(fixtures['partly paid, overdue']) as unknown as FinanceTx,
            'f',
            day('2026-11-15')
        );
        expect(s.balance.toFixed(2)).toBe('450.00');
        expect(s.credit.toFixed(2)).toBe('0.00');
        expect(s.overdueAmount.toFixed(2)).toBe('450.00');
        expect(s.oldestDueDays).toBe(5);
        expect(s.openCharges.map(c => c.id)).toEqual(['c2']);

        const credit = await summariseFlat(
            client(fixtures['overpaid: credit']) as unknown as FinanceTx,
            'f',
            day('2026-11-15')
        );
        expect(credit.balance.toFixed(2)).toBe('-699.50');
        expect(credit.credit.toFixed(2)).toBe('699.50');
        expect(credit.oldestDueDays).toBeNull();

        const tiny = await summariseFlat(
            client(fixtures['paid, unallocated']) as unknown as FinanceTx,
            'f',
            day('2026-11-15')
        );
        // 0.10 - 0.20 in Decimal, never float noise
        expect(tiny.balance.toString()).toBe('-0.1');
    });

    it('reads with the shared predicates for the requested flats only', async () => {
        const c = client({ charges: [], allocations: [], payments: [] });
        const asOf = day('2026-11-02');
        const map = await summariseFlats(
            c as unknown as FinanceTx,
            ['f', 'g'],
            asOf
        );
        expect([...map.keys()]).toEqual(['f', 'g']);
        expect(c.charge.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { flatId: { in: ['f', 'g'] }, ...liveChargeWhere(asOf) },
            })
        );
        expect(c.payment.groupBy).toHaveBeenCalledWith(
            expect.objectContaining({
                where: {
                    flatId: { in: ['f', 'g'] },
                    ...livePaymentWhere(asOf),
                },
            })
        );
        expect(c.paymentAllocation.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: {
                    AND: [
                        liveAllocationWhere(asOf),
                        { payment: { flatId: { in: ['f', 'g'] } } },
                    ],
                },
            })
        );
        const empty = await summariseFlats(c as unknown as FinanceTx, [], asOf);
        expect(empty.size).toBe(0);
    });
});

describe('slice 7 review kernel additions', () => {
    it('M1: RequestKeyTaken inside the transaction replays the winner', async () => {
        const winner = { id: 'p1', requestHash: 'h' };
        const find = jest
            .fn()
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce(winner);
        const out = await runIdempotent({
            requestHash: 'h',
            find,
            create: async () => {
                await assertRequestKeyFree(async () => ({ id: 'p1' }));
                return winner;
            },
        });
        expect(out).toEqual({ result: winner, replayed: true });
    });

    it('M1: RequestKeyTaken with another body is idempotencyConflict', async () => {
        const find = jest
            .fn()
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce({ id: 'p1', requestHash: 'other' });
        await expect(
            runIdempotent({
                requestHash: 'h',
                find,
                create: () => {
                    throw new RequestKeyTaken();
                },
            })
        ).rejects.toThrow('finance.error.idempotencyConflict');
        await expect(assertRequestKeyFree(async () => null)).resolves.toBe(
            undefined
        );
    });

    it('L2: assertPeriodsLocked / withPeriodRetry / periodRange', async () => {
        expect(periodRange('2026-11', '2027-02')).toEqual([
            '2026-11',
            '2026-12',
            '2027-01',
            '2027-02',
        ]);
        expect(periodRange('2026-12', '2026-11')).toEqual([]);
        expect(() =>
            assertPeriodsLocked(['2026-10'], ['2026-10'])
        ).not.toThrow();
        try {
            assertPeriodsLocked(['2026-12'], ['2026-11']);
            throw new Error('expected PeriodSetGrew');
        } catch (e) {
            expect(e).toBeInstanceOf(PeriodSetGrew);
            expect((e as PeriodSetGrew).periods).toEqual([
                '2026-11',
                '2026-12',
            ]);
        }
        const seen: string[][] = [];
        const out = await withPeriodRetry(['2026-12'], async periods => {
            seen.push([...periods]);
            if (seen.length === 1) assertPeriodsLocked(periods, ['2026-11']);
            return 'ok';
        });
        expect(out).toBe('ok');
        expect(seen).toEqual([['2026-12'], ['2026-11', '2026-12']]);
        await expect(
            withPeriodRetry(['2026-01'], async () => {
                throw new PeriodSetGrew(['2026-01']);
            })
        ).rejects.toThrow('finance.error.concurrentChange');
        await expect(
            withPeriodRetry(['2026-01'], async () => {
                throw new Error('boom');
            })
        ).rejects.toThrow('boom');
    });
});
