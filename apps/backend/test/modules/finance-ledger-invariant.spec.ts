import { PostingStatus, Prisma } from '@prisma/client';

import {
    addDays,
    cairoDayStart,
    parseDateOnly,
} from 'src/common/finance/cairo-date';
import { FinanceTx } from 'src/modules/finance/kernel/finance-tx';
import { summariseFlat } from 'src/modules/finance/kernel/ledger';

import { matches, Row } from '../mocks/finance-ledger.mock';

/*
 * Review M1: the invariant `balance = open − credit` checked against an
 * in-memory ledger that EVALUATES the Prisma `where` objects the kernel
 * builds (the operators the live predicates use), so a predicate that
 * forgets the charge or payment liveness fails here.
 */

// The evaluator is shared with the payments spec (test/mocks/finance-ledger.mock.ts).

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

const cairoStart = (s: string) => cairoDayStart(day(s));

// Slice 7: ledgers shaped exactly as the payments service writes them.
Object.assign(FIXTURES, {
    'slice 7: auto allocation, overpayment credit, credit applied later': {
        charges: [
            charge({
                id: 'oct',
                amount: D('450'),
                accrualPeriod: '2026-10',
                dueDate: day('2026-10-10'),
            }),
            charge({
                id: 'nov',
                amount: D('450'),
                accrualPeriod: '2026-11',
                dueDate: day('2026-11-10'),
            }),
            charge({
                id: 'dec',
                amount: D('450'),
                accrualPeriod: '2026-12',
                dueDate: day('2026-12-10'),
            }),
        ],
        payments: [
            payment({
                id: 'p',
                amount: D('1000'),
                receivedAt: day('2026-11-05'),
            }),
        ],
        allocations: [
            allocation({
                id: 'a1',
                paymentId: 'p',
                chargeId: 'oct',
                amount: D('450'),
                allocatedAt: day('2026-11-05'),
            }),
            allocation({
                id: 'a2',
                paymentId: 'p',
                chargeId: 'nov',
                amount: D('450'),
                allocatedAt: day('2026-11-05'),
            }),
            // apply-credit on 20 Nov to a charge accruing in December
            allocation({
                id: 'a3',
                paymentId: 'p',
                chargeId: 'dec',
                amount: D('100'),
                allocatedAt: day('2026-11-20'),
            }),
        ],
    },
    'slice 7: cheque bounced, allocation voided at the Cairo start of bouncedAt':
        {
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
                    id: 'a',
                    paymentId: 'chq',
                    chargeId: 'sc',
                    amount: D('450'),
                    allocatedAt: day('2026-11-01'),
                    voidedAt: cairoStart('2026-11-10'),
                }),
            ],
        },
    'slice 7: voided payment that also funded a later credit allocation': {
        charges: [
            charge({
                id: 'oct',
                amount: D('450'),
                accrualPeriod: '2026-10',
                dueDate: day('2026-10-10'),
            }),
            charge({
                id: 'nov',
                amount: D('450'),
                accrualPeriod: '2026-11',
                dueDate: day('2026-11-10'),
            }),
        ],
        payments: [
            payment({
                id: 'p',
                amount: D('900'),
                receivedAt: day('2026-10-05'),
                status: PostingStatus.VOID,
                voidedAt: new Date('2026-11-25T10:00:00Z'),
            }),
        ],
        allocations: [
            allocation({
                id: 'a1',
                paymentId: 'p',
                chargeId: 'oct',
                amount: D('450'),
                allocatedAt: day('2026-10-05'),
                voidedAt: new Date('2026-11-25T10:00:00Z'),
            }),
            allocation({
                id: 'a2',
                paymentId: 'p',
                chargeId: 'nov',
                amount: D('450'),
                allocatedAt: day('2026-11-12'),
                voidedAt: new Date('2026-11-25T10:00:00Z'),
            }),
        ],
    },
    'slice 7: deposit paid ahead of older arrears by a pending cheque': {
        charges: [
            charge({
                id: 'dep',
                amount: D('1000'),
                accrualPeriod: '2026-09',
                dueDate: day('2026-09-10'),
            }),
            charge({
                id: 'sc',
                amount: D('450'),
                accrualPeriod: '2026-10',
                dueDate: day('2026-10-10'),
            }),
        ],
        payments: [
            payment({
                id: 'chq',
                amount: D('1000'),
                receivedAt: day('2026-10-20'),
            }),
        ],
        allocations: [
            allocation({
                id: 'a',
                paymentId: 'chq',
                chargeId: 'dep',
                amount: D('1000'),
                allocatedAt: day('2026-10-20'),
            }),
        ],
    },
} satisfies Record<string, Ledger>);

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
