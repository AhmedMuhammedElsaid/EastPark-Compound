import { PostingStatus, Prisma } from '@prisma/client';

import { addDays, parseDateOnly } from 'src/common/finance/cairo-date';
import { FinanceTx } from 'src/modules/finance/kernel/finance-tx';
import { summariseFlat } from 'src/modules/finance/kernel/ledger';

/*
 * Review M1: the invariant `balance = open − credit` checked against an
 * in-memory ledger that EVALUATES the Prisma `where` objects the kernel
 * builds (the operators the live predicates use), so a predicate that
 * forgets the charge or payment liveness fails here.
 */

type Row = Record<string, unknown>;

const OPS = ['lte', 'lt', 'gte', 'gt', 'in', 'equals'];

function cmp(a: unknown, b: unknown): number {
    const x = a instanceof Date ? a.getTime() : a;
    const y = b instanceof Date ? b.getTime() : b;
    return (x as number) < (y as number)
        ? -1
        : (x as number) > (y as number)
          ? 1
          : 0;
}

function same(a: unknown, b: unknown): boolean {
    if (a instanceof Date && b instanceof Date)
        return a.getTime() === b.getTime();
    return a === b;
}

function matches(row: Row | null | undefined, where: Row): boolean {
    if (!row) return false;
    return Object.entries(where).every(([key, cond]) => {
        if (key === 'AND') return (cond as Row[]).every(w => matches(row, w));
        if (key === 'OR') return (cond as Row[]).some(w => matches(row, w));
        const value = row[key];
        if (cond === null) return value === null || value === undefined;
        if (typeof cond !== 'object' || cond instanceof Date)
            return same(value, cond);
        const ops = Object.keys(cond as Row);
        if (ops.length > 0 && ops.every(o => OPS.includes(o))) {
            if (value === null || value === undefined) return false;
            const c = cond as Row;
            if ('lte' in c && cmp(value, c.lte) > 0) return false;
            if ('lt' in c && cmp(value, c.lt) >= 0) return false;
            if ('gte' in c && cmp(value, c.gte) < 0) return false;
            if ('gt' in c && cmp(value, c.gt) <= 0) return false;
            if ('in' in c && !(c.in as unknown[]).some(v => same(value, v)))
                return false;
            if ('equals' in c && !same(value, c.equals)) return false;
            return true;
        }
        return matches(value as Row, cond as Row); // relation filter
    });
}

interface Ledger {
    charges: Row[];
    payments: Row[];
    allocations: Row[];
}

function ledgerClient(ledger: Ledger): FinanceTx {
    const allocations = (): Row[] =>
        ledger.allocations.map(a => ({
            ...a,
            charge: ledger.charges.find(c => c.id === a.chargeId),
            payment: ledger.payments.find(p => p.id === a.paymentId),
        }));
    return {
        charge: {
            findMany: async ({ where }: { where: Row }) =>
                ledger.charges.filter(c => matches(c, where)),
        },
        paymentAllocation: {
            findMany: async ({ where }: { where: Row }) =>
                allocations()
                    .filter(a => matches(a, where))
                    .map(a => ({
                        amount: a.amount,
                        chargeId: a.chargeId,
                        payment: { flatId: (a.payment as Row).flatId },
                    })),
        },
        payment: {
            groupBy: async ({ where }: { where: Row }) => {
                const sums = new Map<string, Prisma.Decimal>();
                for (const p of ledger.payments.filter(x =>
                    matches(x, where)
                )) {
                    const flatId = p.flatId as string;
                    sums.set(
                        flatId,
                        (sums.get(flatId) ?? new Prisma.Decimal(0)).add(
                            p.amount as Prisma.Decimal
                        )
                    );
                }
                return [...sums].map(([flatId, amount]) => ({
                    flatId,
                    _sum: { amount },
                }));
            },
        },
    } as unknown as FinanceTx;
}

const D = (s: string) => new Prisma.Decimal(s);
const day = parseDateOnly;

const charge = (o: Row): Row => ({
    flatId: 'f',
    status: PostingStatus.POSTED,
    voidedAt: null,
    createdAt: new Date('2026-10-01T08:00:00Z'),
    ...o,
});
const payment = (o: Row): Row => ({
    flatId: 'f',
    status: PostingStatus.POSTED,
    voidedAt: null,
    bouncedAt: null,
    ...o,
});
const allocation = (o: Row): Row => ({ voidedAt: null, ...o });

const FIXTURES: Record<string, Ledger> = {
    // review M1: a deposit instalment paid ahead of its accrual month
    'future-accrual deposit paid and allocated early': {
        charges: [
            charge({
                id: 'dep',
                amount: D('1000'),
                accrualPeriod: '2026-12',
                dueDate: day('2026-12-10'),
            }),
        ],
        payments: [
            payment({
                id: 'p1',
                amount: D('1000'),
                receivedAt: day('2026-11-05'),
            }),
        ],
        allocations: [
            allocation({
                id: 'a1',
                paymentId: 'p1',
                chargeId: 'dep',
                amount: D('1000'),
                allocatedAt: day('2026-11-05'),
            }),
        ],
    },
    // a cheque bounced on 10 Nov whose allocation void is stamped later (12 Nov)
    'bounced cheque before its allocation void': {
        charges: [
            charge({
                id: 'sc',
                amount: D('450'),
                accrualPeriod: '2026-11',
                dueDate: day('2026-11-10'),
            }),
        ],
        payments: [
            payment({
                id: 'chq',
                amount: D('450'),
                receivedAt: day('2026-11-01'),
                bouncedAt: day('2026-11-10'),
            }),
        ],
        allocations: [
            allocation({
                id: 'a1',
                paymentId: 'chq',
                chargeId: 'sc',
                amount: D('450'),
                allocatedAt: day('2026-11-01'),
                voidedAt: new Date('2026-11-12T09:00:00Z'),
            }),
        ],
    },
    'voided charge with a voided payment': {
        charges: [
            charge({
                id: 'c',
                amount: D('300'),
                accrualPeriod: '2026-11',
                dueDate: day('2026-11-10'),
                status: PostingStatus.VOID,
                voidedAt: new Date('2026-11-20T10:00:00Z'),
            }),
        ],
        payments: [
            payment({
                id: 'p',
                amount: D('500'),
                receivedAt: day('2026-11-03'),
                status: PostingStatus.VOID,
                voidedAt: new Date('2026-11-18T10:00:00Z'),
            }),
        ],
        allocations: [
            allocation({
                id: 'a',
                paymentId: 'p',
                chargeId: 'c',
                amount: D('300'),
                allocatedAt: day('2026-11-03'),
                voidedAt: new Date('2026-11-18T10:00:00Z'),
            }),
        ],
    },
};

const DATES = Array.from({ length: 70 }, (_, i) =>
    addDays(day('2026-10-28'), i)
);

describe('ledger invariant over dated fixtures (review M1)', () => {
    it.each(Object.entries(FIXTURES))(
        'balance = open − credit and credit >= 0 on every date (%s)',
        async (_name, ledger) => {
            const client = ledgerClient(ledger);
            for (const asOf of DATES) {
                const s = await summariseFlat(client, 'f', asOf);
                expect(s.balance.toFixed(2)).toBe(
                    s.openAmount.sub(s.credit).toFixed(2)
                );
                expect(s.credit.gte(0)).toBe(true);
            }
        }
    );

    it('future-accrual deposit: credit until the accrual month, settled after', async () => {
        const client = ledgerClient(
            FIXTURES[
                'future-accrual deposit paid and allocated early'
            ] as Ledger
        );
        const nov = await summariseFlat(client, 'f', day('2026-11-15'));
        expect(
            [nov.balance, nov.credit, nov.openAmount].map(d => d.toFixed(2))
        ).toEqual(['-1000.00', '1000.00', '0.00']);
        const dec = await summariseFlat(client, 'f', day('2026-12-15'));
        expect(
            [dec.balance, dec.credit, dec.openAmount].map(d => d.toFixed(2))
        ).toEqual(['0.00', '0.00', '0.00']);
    });

    it('bounced cheque: the charge is open again from the bounce date', async () => {
        const client = ledgerClient(
            FIXTURES['bounced cheque before its allocation void'] as Ledger
        );
        const before = await summariseFlat(client, 'f', day('2026-11-09'));
        expect(before.balance.toFixed(2)).toBe('0.00');
        const gap = await summariseFlat(client, 'f', day('2026-11-11'));
        expect(
            [gap.balance, gap.credit, gap.openAmount].map(d => d.toFixed(2))
        ).toEqual(['450.00', '0.00', '450.00']);
    });
});
