import {
    BadRequestException,
    ConflictException,
    ForbiddenException,
    NotFoundException,
} from '@nestjs/common';
import { ChargeKind, Prisma, Role } from '@prisma/client';

import {
    addDays,
    cairoDayStart,
    parseDateOnly,
} from 'src/common/finance/cairo-date';
import { DatabaseService } from 'src/common/database/services/database.service';
import { PrivateFileService } from 'src/common/file/services/private-file.service';
import { FinancePaymentCreateDto } from 'src/modules/finance/dtos/request/finance-payment.dto';
import {
    ATTACH_MAX_AGE_MS,
    BOUNCE_VOID_REASON,
    FinancePaymentsService,
} from 'src/modules/finance/finance-payments.service';
import { FinanceAuditService } from 'src/modules/finance/kernel/finance-audit.service';
import { summariseFlat } from 'src/modules/finance/kernel/ledger';

import {
    emptyLedger,
    FakeFinanceDb,
    LedgerState,
    Row,
} from '../mocks/finance-ledger.mock';

const NOW = new Date('2026-11-20T10:00:00.000Z'); // 12:00 Cairo, 20 Nov
const accountant = { userId: 'acc-1', role: Role.ACCOUNTANT };
const otherAccountant = { userId: 'acc-2', role: Role.ACCOUNTANT };
const admin = { userId: 'adm-1', role: Role.ADMIN };
const D = (s: string) => new Prisma.Decimal(s);
const day = parseDateOnly;

function addCharge(state: LedgerState, o: Row): Row {
    const row: Row = {
        flatId: 'flat-1',
        kind: ChargeKind.SERVICE_CHARGE,
        description: 'Service charge',
        descriptionAr: 'رسوم خدمة',
        status: 'POSTED',
        voidedAt: null,
        createdById: 'acc-1',
        createdAt: new Date('2026-10-01T08:00:00Z'),
        ...o,
    };
    state.charges.push(row);
    return row;
}

function files() {
    return {
        copy: jest.fn().mockResolvedValue(true),
        remove: jest.fn().mockResolvedValue(true),
        listStagingBefore: jest.fn().mockResolvedValue([]),
    };
}

function build(seed?: (s: LedgerState) => void) {
    const state = emptyLedger();
    state.settings.set('finance.goLiveAt', '2026-01-01T00:00:00.000Z');
    state.raw.flats.set('flat-2', {
        id: 'flat-2',
        label: 'A1-3-3',
        isActive: true,
    });
    state.raw.flats.set('flat-off', {
        id: 'flat-off',
        label: 'A1-3-4',
        isActive: false,
    });
    seed?.(state);
    const db = new FakeFinanceDb(state);
    const storage = files();
    const service = new FinancePaymentsService(
        db as unknown as DatabaseService,
        new FinanceAuditService(),
        storage as unknown as PrivateFileService
    );
    return { state, db, service, storage };
}

/** Three charges: deposit due Sep, service Oct, service Nov. */
function standardCharges(state: LedgerState): void {
    addCharge(state, {
        id: 'dep',
        kind: ChargeKind.MAINTENANCE_DEPOSIT,
        amount: D('1000'),
        accrualPeriod: '2026-09',
        dueDate: day('2026-09-10'),
    });
    addCharge(state, {
        id: 'oct',
        amount: D('450'),
        accrualPeriod: '2026-10',
        dueDate: day('2026-10-10'),
    });
    addCharge(state, {
        id: 'nov',
        amount: D('450'),
        accrualPeriod: '2026-11',
        dueDate: day('2026-11-10'),
    });
}

const pay = (
    o: Partial<FinancePaymentCreateDto> = {}
): FinancePaymentCreateDto =>
    ({
        flatId: 'flat-1',
        amount: '1000.00',
        method: 'CASH',
        receivedAt: '2026-11-15',
        ...o,
    }) as FinancePaymentCreateDto;

const live = (state: LedgerState) =>
    state.allocations.filter(a => a.voidedAt === null);

async function assertInvariant(db: FakeFinanceDb, flatId = 'flat-1') {
    for (
        let d = day('2026-09-01');
        d.getTime() <= day('2026-12-31').getTime();
        d = addDays(d, 1)
    ) {
        const s = await summariseFlat(db as never, flatId, d);
        expect(s.balance.toFixed(2)).toBe(
            s.openAmount.sub(s.credit).toFixed(2)
        );
        expect(s.credit.gte(0)).toBe(true);
    }
}

beforeEach(() => {
    jest.useFakeTimers({
        now: NOW,
        doNotFake: [
            'nextTick',
            'queueMicrotask',
            'setImmediate',
            'clearImmediate',
            'setTimeout',
            'clearTimeout',
            'setInterval',
            'clearInterval',
        ],
    });
});
afterEach(() => jest.useRealTimers());

describe('FinancePaymentsService.create', () => {
    it('auto allocation: oldest due first, deposits skipped, rest as credit, one audit row', async () => {
        const { service, state } = build(standardCharges);
        const out = await service.create(pay(), 'key-00000001', accountant);

        expect(out.receiptNo).toBe('R-2026-000001');
        expect(out.status).toBe('POSTED');
        expect(out.chequeState).toBe('NOT_APPLICABLE');
        expect(out.allocations.map(a => [a.chargeId, a.amount])).toEqual([
            ['oct', 450],
            ['nov', 450],
        ]);
        expect(out.allocations.every(a => a.allocatedAt === '2026-11-15')).toBe(
            true
        );
        expect(out.unallocatedAmount).toBe(100);
        expect(out.flatTotals.credit).toBe(100);
        expect(out.flatTotals.balance).toBe(900); // deposit 1000 open − 100 credit
        expect(state.fundEntries).toHaveLength(0);
        expect(state.audits).toHaveLength(1);
        expect(state.audits[0]).toMatchObject({
            action: 'PAYMENT_RECORDED',
            entity: 'Payment',
            userId: 'acc-1',
        });
        expect(JSON.stringify(state.audits[0])).not.toMatch(/@/);
    });

    it('takes the locks in the fixed order: period, flat, charges, counter', async () => {
        const { service, state } = build(standardCharges);
        await service.create(pay(), 'key-00000001', accountant);
        const order = state.raw.log.map(l => l.split(':')[0]);
        expect(order).toEqual([
            'upsert-period',
            'lock-period',
            'lock-flat',
            'lock-charges',
            'counter',
        ]);
        expect(state.raw.log[0]).toBe('upsert-period:2026-11');
    });

    it('payFor DEPOSIT pays the deposit and feeds the fund (DEPOSIT_IN)', async () => {
        const { service, state } = build(standardCharges);
        const out = await service.create(
            pay({ payFor: 'DEPOSIT' }),
            'key-00000001',
            accountant
        );
        expect(out.allocations.map(a => a.chargeId)).toEqual(['dep']);
        expect(state.fundEntries).toHaveLength(1);
        expect(state.fundEntries[0]).toMatchObject({
            entryNo: 'F-2026-000001',
            kind: 'DEPOSIT_IN',
            direction: 'IN',
            paymentId: out.id,
            requestKey: `${out.id}:${out.allocations[0]?.id}`,
            entryDate: day('2026-11-15'),
        });
    });

    it('explicit allocations: the rest stays as credit; deposits may be ticked', async () => {
        const { service } = build(standardCharges);
        const out = await service.create(
            pay({
                amount: '700',
                allocations: [
                    { chargeId: 'dep', amount: '500' },
                    { chargeId: 'nov', amount: 100 },
                ],
            }),
            'key-00000001',
            accountant
        );
        expect(out.allocations.map(a => [a.chargeId, a.amount])).toEqual([
            ['dep', 500],
            ['nov', 100],
        ]);
        expect(out.unallocatedAmount).toBe(100);
    });

    it.each([
        [
            'more than the payment',
            [
                { chargeId: 'oct', amount: '450' },
                { chargeId: 'nov', amount: '450' },
            ],
            '800',
            new ConflictException('finance.error.allocationExceedsPayment'),
        ],
        [
            'more than the charge',
            [{ chargeId: 'oct', amount: '450.01' }],
            '1000',
            new ConflictException('finance.error.allocationExceedsCharge'),
        ],
        [
            'the same charge twice',
            [
                { chargeId: 'oct', amount: '10' },
                { chargeId: 'oct', amount: '10' },
            ],
            '1000',
            new BadRequestException('finance.error.duplicateAllocation'),
        ],
        [
            'a charge of another flat',
            [{ chargeId: 'other', amount: '10' }],
            '1000',
            new ConflictException('finance.error.allocationChargeNotOpen'),
        ],
    ])(
        'over-allocation: %s is refused and nothing is written',
        async (_n, allocations, amount, error) => {
            const { service, state } = build(s => {
                standardCharges(s);
                addCharge(s, {
                    id: 'other',
                    flatId: 'flat-2',
                    amount: D('450'),
                    accrualPeriod: '2026-11',
                    dueDate: day('2026-11-10'),
                });
            });
            await expect(
                service.create(
                    pay({ amount, allocations }),
                    'key-00000001',
                    accountant
                )
            ).rejects.toThrow(error);
            expect(state.payments).toHaveLength(0);
            expect(state.allocations).toHaveLength(0);
            expect(state.audits).toHaveLength(0);
            expect(state.raw.counters.size).toBe(0);
        }
    );

    it('an allocation over what an earlier payment left open is refused', async () => {
        const { service } = build(standardCharges);
        await service.create(
            pay({
                amount: '300',
                allocations: [{ chargeId: 'oct', amount: '300' }],
            }),
            'key-00000001',
            accountant
        );
        await expect(
            service.create(
                pay({
                    amount: '200',
                    allocations: [{ chargeId: 'oct', amount: '200' }],
                }),
                'key-00000002',
                accountant
            )
        ).rejects.toThrow('finance.error.allocationExceedsCharge');
    });

    it('a cheque is created PENDING_CLEARANCE and is live (provisional)', async () => {
        const { service } = build(standardCharges);
        const out = await service.create(
            pay({ method: 'CHEQUE', reference: 'CHQ-1' }),
            'key-00000001',
            accountant
        );
        expect(out.chequeState).toBe('PENDING_CLEARANCE');
        expect(out.flatTotals.credit).toBe(100);
    });

    it.each([
        [
            'a future date',
            pay({ receivedAt: '2026-11-21' }),
            'finance.error.futureDate',
        ],
        [
            'a date before the go-live month',
            pay({ receivedAt: '2025-12-31' }),
            'finance.error.receivedOutOfRange',
        ],
        [
            'an attachment that is not your own upload',
            pay({ attachmentPath: 'staging/acc-2/1-x.jpg' }),
            'finance.error.attachmentInvalid',
        ],
        [
            'a non-finance attachment path',
            pay({ attachmentPath: 'user-avatars/acc-1/1-x.jpg' }),
            'finance.error.attachmentInvalid',
        ],
        [
            'a stale staged upload',
            pay({
                attachmentPath: `staging/acc-1/${NOW.getTime() - ATTACH_MAX_AGE_MS - 1}-x.jpg`,
            }),
            'finance.error.attachmentExpired',
        ],
    ])('400 for %s', async (_n, dto, key) => {
        const { service, state } = build(standardCharges);
        await expect(
            service.create(dto, 'key-00000001', accountant)
        ).rejects.toThrow(new BadRequestException(key));
        expect(state.payments).toHaveLength(0);
    });

    it('a closed period, an inactive or unknown flat are refused', async () => {
        const { service, state } = build(standardCharges);
        state.raw.periods.set('2026-10', 'CLOSED');
        await expect(
            service.create(
                pay({ receivedAt: '2026-10-20' }),
                'key-00000001',
                accountant
            )
        ).rejects.toThrow(new ConflictException('finance.error.periodClosed'));
        await expect(
            service.create(
                pay({ flatId: 'flat-off' }),
                'key-00000002',
                accountant
            )
        ).rejects.toThrow('finance.error.flatInactive');
        await expect(
            service.create(pay({ flatId: 'nope' }), 'key-00000003', accountant)
        ).rejects.toThrow(new NotFoundException('finance.error.flatNotFound'));
        expect(state.payments).toHaveLength(0);
    });

    it('a forced audit failure rolls the payment, allocations and receipt number back', async () => {
        const { service, state, db } = build(standardCharges);
        db.failAudit = true;
        await expect(
            service.create(pay(), 'key-00000001', accountant)
        ).rejects.toThrow('audit insert failed');
        expect(state.payments).toHaveLength(0);
        expect(state.allocations).toHaveLength(0);
        expect(state.raw.counters.size).toBe(0);
        db.failAudit = false;
        const out = await service.create(pay(), 'key-00000001', accountant);
        expect(out.receiptNo).toBe('R-2026-000001');
    });

    describe('idempotency (plan 3.3)', () => {
        it('a retry with the same key returns the original receipt, one row', async () => {
            const { service, state } = build(standardCharges);
            const first = await service.create(
                pay(),
                'key-00000001',
                accountant
            );
            const again = await service.create(
                pay({ amount: 1000 }),
                'key-00000001',
                accountant
            );
            expect(again).toEqual(first);
            expect(state.payments).toHaveLength(1);
            expect(state.audits).toHaveLength(1);
        });

        it('two identical requests in parallel: one row, identical responses', async () => {
            const { service, state } = build(standardCharges);
            const [a, b] = await Promise.all([
                service.create(pay(), 'key-00000001', accountant),
                service.create(pay(), 'key-00000001', accountant),
            ]);
            expect(a).toEqual(b);
            expect(state.payments).toHaveLength(1);
            expect(state.raw.counters.get('R:2026')).toBe(1);
        });

        it('another body or another user under the same key is idempotencyConflict', async () => {
            const { service } = build(standardCharges);
            await service.create(pay(), 'key-00000001', accountant);
            await expect(
                service.create(
                    pay({ amount: '999' }),
                    'key-00000001',
                    accountant
                )
            ).rejects.toThrow('finance.error.idempotencyConflict');
            await expect(
                service.create(pay(), 'key-00000001', otherAccountant)
            ).rejects.toThrow('finance.error.idempotencyConflict');
        });

        it('force is not part of the hash', async () => {
            const { service, state } = build(standardCharges);
            await service.create(
                pay({ reference: 'TRX-9' }),
                'key-00000001',
                accountant
            );
            await service.create(
                pay({ reference: 'TRX-9', force: true }),
                'key-00000001',
                accountant
            );
            expect(state.payments).toHaveLength(1);
        });
    });

    describe('duplicateReference (soft warning, plan 7.2 L2)', () => {
        it('warns on the same method + reference (any case) and posts with force', async () => {
            const { service, state } = build(standardCharges);
            await service.create(
                pay({ method: 'BANK_TRANSFER', reference: 'TRX-77' }),
                'key-00000001',
                accountant
            );
            await expect(
                service.create(
                    pay({ method: 'BANK_TRANSFER', reference: 'trx-77' }),
                    'key-00000002',
                    accountant
                )
            ).rejects.toThrow(
                new ConflictException('finance.error.duplicateReference')
            );
            await service.create(
                pay({
                    method: 'BANK_TRANSFER',
                    reference: 'trx-77',
                    force: true,
                }),
                'key-00000002',
                accountant
            );
            expect(state.payments).toHaveLength(2);
            expect(state.audits[1]).toMatchObject({
                meta: expect.objectContaining({ forcedDuplicate: true }),
            });
        });

        it('ignores another method, opening rows and bounced cheques', async () => {
            const { service, state } = build(standardCharges);
            state.payments.push({
                id: 'open-1',
                flatId: 'flat-1',
                receiptNo: 'O-2026-000001',
                amount: D('5'),
                method: 'CASH',
                reference: 'OPENING',
                receivedAt: day('2026-01-01'),
                status: 'POSTED',
                isOpening: true,
                bouncedAt: null,
                voidedAt: null,
                chequeState: 'NOT_APPLICABLE',
            });
            await service.create(
                pay({ reference: 'OPENING' }),
                'key-00000001',
                accountant
            );
            await service.create(
                pay({ method: 'INSTAPAY', reference: 'OPENING' }),
                'key-00000002',
                accountant
            );
            const chq = await service.create(
                pay({ method: 'CHEQUE', reference: 'C-5' }),
                'key-00000003',
                accountant
            );
            await service.chequeBounced(
                chq.id,
                { date: '2026-11-18' },
                accountant
            );
            await service.create(
                pay({ method: 'CHEQUE', reference: 'C-5' }),
                'key-00000004',
                accountant
            );
            expect(state.payments).toHaveLength(5);
        });
    });

    it('attachments: refused when already used; promoted out of staging after commit', async () => {
        const { service, state, storage } = build(standardCharges);
        const path = `staging/acc-1/${NOW.getTime() - 1000}-abc.jpg`;
        const out = await service.create(
            pay({ attachmentPath: path }),
            'key-00000001',
            accountant
        );
        expect(out.hasAttachment).toBe(true);
        expect(JSON.stringify(out)).not.toContain('staging/');
        const target = `receipts/2026/R-2026-000001/${NOW.getTime() - 1000}-abc.jpg`;
        expect(storage.copy).toHaveBeenCalledWith(path, target);
        expect(storage.remove).toHaveBeenCalledWith([path]);
        expect(state.payments[0]?.attachmentPath).toBe(target);

        storage.copy.mockResolvedValueOnce(false);
        const path2 = `staging/acc-1/${NOW.getTime() - 500}-def.jpg`;
        await service.create(
            pay({ attachmentPath: path2 }),
            'key-00000002',
            accountant
        );
        expect(state.payments[1]?.attachmentPath).toBe(path2); // stays, still readable
        await expect(
            service.create(
                pay({ attachmentPath: path2 }),
                'key-00000003',
                accountant
            )
        ).rejects.toThrow('finance.error.attachmentInUse');
    });

    it('replacesId must name a voided payment of the same flat, replaced once', async () => {
        const { service } = build(standardCharges);
        const original = await service.create(
            pay(),
            'key-00000001',
            accountant
        );
        await expect(
            service.create(
                pay({ replacesId: original.id }),
                'key-00000002',
                accountant
            )
        ).rejects.toThrow('finance.error.replacesNotVoid');
        await service.void(original.id, 'Wrong amount typed', accountant);
        await expect(
            service.create(
                pay({ flatId: 'flat-2', replacesId: original.id }),
                'key-00000003',
                accountant
            )
        ).rejects.toThrow('finance.error.paymentNotFound');
        const fixed = await service.create(
            pay({ amount: '900', replacesId: original.id }),
            'key-00000004',
            accountant
        );
        expect(fixed.replacesId).toBe(original.id);
        await expect(
            service.create(
                pay({ replacesId: original.id }),
                'key-00000005',
                accountant
            )
        ).rejects.toThrow('finance.error.alreadyReplaced');
    });
});

describe('two accountants posting on the same flat at once', () => {
    it('the flat lock serialises them: the charge is settled once, the rest is credit', async () => {
        const { service, state, db } = build(s =>
            addCharge(s, {
                id: 'oct',
                amount: D('450'),
                accrualPeriod: '2026-10',
                dueDate: day('2026-10-10'),
            })
        );
        const [a, b] = await Promise.all([
            service.create(pay({ amount: '450' }), 'key-acc1-0001', accountant),
            service.create(
                pay({ amount: '450' }),
                'key-acc2-0001',
                otherAccountant
            ),
        ]);
        expect([a.receiptNo, b.receiptNo].sort()).toEqual([
            'R-2026-000001',
            'R-2026-000002',
        ]);
        const toOct = live(state).filter(x => x.chargeId === 'oct');
        expect(toOct).toHaveLength(1);
        expect((toOct[0]?.amount as Prisma.Decimal).toFixed(2)).toBe('450.00');
        const s = await summariseFlat(db as never, 'flat-1', day('2026-11-20'));
        expect([s.balance, s.credit].map(x => x.toFixed(2))).toEqual([
            '-450.00',
            '450.00',
        ]);
        await assertInvariant(db);
    });
});

describe('FinancePaymentsService.void (cascade, plan 3.1)', () => {
    async function posted() {
        const ctx = build(standardCharges);
        const out = await ctx.service.create(
            pay({
                amount: '1450',
                allocations: [
                    { chargeId: 'dep', amount: '1000' },
                    { chargeId: 'oct', amount: '450' },
                ],
            }),
            'key-00000001',
            accountant
        );
        return { ...ctx, out };
    }

    it('voids the payment, its allocations and DEPOSIT_IN entries; charges reopen', async () => {
        const { service, state, db, out } = await posted();
        expect(state.fundEntries).toHaveLength(1);
        const voided = await service.void(
            out.id,
            'Typed the wrong flat',
            accountant
        );
        expect(voided.status).toBe('VOID');
        expect(voided.allocations.every(a => a.voidedAt !== null)).toBe(true);
        expect(voided.allocatedAmount).toBe(0);
        expect(state.fundEntries[0]).toMatchObject({ status: 'VOID' });
        const s = await summariseFlat(db as never, 'flat-1', day('2026-11-20'));
        expect(s.openCharges.map(c => c.id)).toEqual(['dep', 'oct', 'nov']);
        const audit = state.audits.at(-1) as Row;
        expect(audit).toMatchObject({
            action: 'PAYMENT_VOIDED',
            meta: expect.objectContaining({
                allocationsVoided: 2,
                fundEntriesVoided: 1,
                balanceBefore: '450.00',
                balanceAfter: '1900.00',
                reason: 'Typed the wrong flat',
            }),
        });
        await assertInvariant(db);
    });

    it('void policy: another accountant or a later day is refused; an admin may', async () => {
        const { service, out } = await posted();
        await expect(
            service.void(out.id, 'Not mine to void', otherAccountant)
        ).rejects.toThrow(
            new ForbiddenException('finance.error.voidNotAllowed')
        );
        jest.setSystemTime(new Date('2026-11-21T10:00:00Z'));
        await expect(
            service.void(out.id, 'A day too late', accountant)
        ).rejects.toThrow('finance.error.voidNotAllowed');
        const v = await service.void(out.id, 'Admin correction', admin);
        expect(v.status).toBe('VOID');
        await expect(
            service.void(out.id, 'Admin correction', admin)
        ).rejects.toThrow('finance.error.alreadyVoid');
    });

    it('refuses a closed period, an opening row and an unknown id', async () => {
        const { service, state, out } = await posted();
        state.raw.periods.set('2026-11', 'CLOSED');
        await expect(
            service.void(out.id, 'Closed month', admin)
        ).rejects.toThrow('finance.error.periodClosed');
        state.raw.periods.set('2026-11', 'OPEN');
        (state.payments[0] as Row).isOpening = true;
        await expect(
            service.void(out.id, 'Opening row', admin)
        ).rejects.toThrow('finance.error.voidImportInstead');
        await expect(service.void('nope', 'Unknown id', admin)).rejects.toThrow(
            new NotFoundException('finance.error.paymentNotFound')
        );
    });

    it('a payment whose month was closed afterwards cannot be voided', async () => {
        const { service, state } = build(s =>
            addCharge(s, {
                id: 'oct',
                amount: D('100'),
                accrualPeriod: '2026-10',
                dueDate: day('2026-10-10'),
            })
        );
        jest.setSystemTime(new Date('2026-10-20T10:00:00Z'));
        const p = await service.create(
            pay({ amount: '50', receivedAt: '2026-10-05' }),
            'key-00000001',
            accountant
        );
        expect(p.allocations).toHaveLength(1);
        state.raw.periods.set('2026-10', 'CLOSED');
        jest.setSystemTime(NOW);
        await expect(
            service.void(p.id, 'After the close', admin)
        ).rejects.toThrow('finance.error.periodClosed');
    });

    it('a failed audit leaves the payment and allocations untouched', async () => {
        const { service, state, db, out } = await posted();
        db.failAudit = true;
        await expect(
            service.void(out.id, 'Will roll back', accountant)
        ).rejects.toThrow();
        expect(state.payments[0]).toMatchObject({
            status: 'POSTED',
            voidedAt: null,
        });
        expect(live(state)).toHaveLength(2);
        expect(state.fundEntries[0]).toMatchObject({ status: 'POSTED' });
    });
});

describe('cheques (plan 3.8)', () => {
    async function cheque(seed = standardCharges) {
        const ctx = build(seed);
        const out = await ctx.service.create(
            pay({
                method: 'CHEQUE',
                reference: 'CHQ-100',
                amount: '1450',
                payFor: 'AUTO',
                allocations: [
                    { chargeId: 'dep', amount: '1000' },
                    { chargeId: 'oct', amount: '450' },
                ],
                receivedAt: '2026-11-05',
            }),
            'key-00000001',
            accountant
        );
        return { ...ctx, out };
    }

    it('cleared: dated, final, audited', async () => {
        const { service, state, out } = await cheque();
        const c = await service.chequeCleared(
            out.id,
            { date: '2026-11-18' },
            accountant
        );
        expect([c.chequeState, c.clearedAt]).toEqual(['CLEARED', '2026-11-18']);
        expect(state.audits.at(-1)).toMatchObject({
            action: 'CHEQUE_STATE_CHANGED',
            meta: expect.objectContaining({
                to: 'CLEARED',
                date: '2026-11-18',
            }),
        });
        await expect(
            service.chequeBounced(out.id, {}, accountant)
        ).rejects.toThrow(new ConflictException('finance.error.alreadyFinal'));
    });

    it('bounced: live before the bounce date, not from it; allocations and fund entries voided as of that date', async () => {
        const { service, state, db, out } = await cheque();
        const b = await service.chequeBounced(
            out.id,
            { date: '2026-11-18' },
            accountant
        );
        expect([b.status, b.chequeState, b.bouncedAt]).toEqual([
            'POSTED',
            'BOUNCED',
            '2026-11-18',
        ]);
        const effective = cairoDayStart(day('2026-11-18'));
        expect(
            state.allocations.every(
                a =>
                    (a.voidedAt as Date).getTime() === effective.getTime() &&
                    a.voidReason === BOUNCE_VOID_REASON
            )
        ).toBe(true);
        expect(state.fundEntries[0]).toMatchObject({
            status: 'VOID',
            voidedAt: effective,
        });

        const before = await summariseFlat(
            db as never,
            'flat-1',
            day('2026-11-17')
        );
        const after = await summariseFlat(
            db as never,
            'flat-1',
            day('2026-11-18')
        );
        expect(before.openCharges.map(c => c.id)).toEqual(['nov']);
        expect(after.openCharges.map(c => c.id)).toEqual(['dep', 'oct', 'nov']);
        expect(after.balance.toFixed(2)).toBe('1900.00');
        await assertInvariant(db);
    });

    it('a cheque from a closed month bounces in the open month; the closed month is unchanged', async () => {
        const { service, state, db } = build(standardCharges);
        jest.setSystemTime(new Date('2026-10-20T10:00:00Z'));
        const chq = await service.create(
            pay({ method: 'CHEQUE', amount: '450', receivedAt: '2026-10-15' }),
            'key-00000001',
            accountant
        );
        state.raw.periods.set('2026-10', 'CLOSED');
        const octEnd = day('2026-10-31');
        const snapshot = await summariseFlat(db as never, 'flat-1', octEnd);
        jest.setSystemTime(NOW);

        await expect(
            service.chequeBounced(chq.id, { date: '2026-10-30' }, accountant)
        ).rejects.toThrow('finance.error.periodClosed');
        await service.chequeBounced(chq.id, { date: '2026-11-03' }, accountant);

        const again = await summariseFlat(db as never, 'flat-1', octEnd);
        expect(again).toEqual(snapshot);
        const nov = await summariseFlat(
            db as never,
            'flat-1',
            day('2026-11-03')
        );
        expect(nov.openCharges.map(c => c.id)).toContain('oct');
        await assertInvariant(db);
    });

    it.each([
        ['a future date', { date: '2026-11-21' }, 'finance.error.futureDate'],
        [
            'a date before receipt',
            { date: '2026-11-04' },
            'finance.error.dateBeforeReceived',
        ],
    ])('400 for %s', async (_n, dto, key) => {
        const { service, out } = await cheque();
        await expect(
            service.chequeBounced(out.id, dto, accountant)
        ).rejects.toThrow(new BadRequestException(key));
    });

    it('refuses a non-cheque, a voided cheque and an unknown id', async () => {
        const { service, out } = await cheque();
        const cash = await service.create(pay(), 'key-00000002', accountant);
        await expect(
            service.chequeCleared(cash.id, {}, accountant)
        ).rejects.toThrow('finance.error.notACheque');
        await service.void(out.id, 'Cheque entered twice', accountant);
        await expect(
            service.chequeCleared(out.id, {}, accountant)
        ).rejects.toThrow('finance.error.alreadyVoid');
        await expect(
            service.chequeCleared('nope', {}, accountant)
        ).rejects.toThrow('finance.error.paymentNotFound');
    });
});

describe('apply-credit (plan 3.5)', () => {
    it('auto: allocates credit dated today, oldest due first, deposits skipped', async () => {
        const { service, state, db } = build(s =>
            addCharge(s, {
                id: 'oct',
                amount: D('450'),
                accrualPeriod: '2026-10',
                dueDate: day('2026-10-10'),
            })
        );
        await service.create(
            pay({ amount: '1000' }),
            'key-00000001',
            accountant
        );
        addCharge(state, {
            id: 'dep',
            kind: ChargeKind.MAINTENANCE_DEPOSIT,
            amount: D('1000'),
            accrualPeriod: '2026-09',
            dueDate: day('2026-09-10'),
        });
        addCharge(state, {
            id: 'nov',
            amount: D('450'),
            accrualPeriod: '2026-11',
            dueDate: day('2026-11-10'),
        });
        const out = await service.applyCredit('flat-1', {}, accountant);
        expect(out.applied).toBe(450);
        expect(out.allocations.map(a => [a.chargeId, a.allocatedAt])).toEqual([
            ['nov', '2026-11-20'],
        ]);
        expect(out.flatTotals.credit).toBe(100);
        expect(state.audits.at(-1)).toMatchObject({
            action: 'CREDIT_APPLIED',
            entity: 'Flat',
            entityId: 'flat-1',
        });
        await assertInvariant(db);
    });

    it('DEPOSIT mode feeds the fund; explicit over credit is insufficientCredit', async () => {
        const { service, state } = build(standardCharges);
        await service.create(
            pay({
                amount: '600',
                allocations: [{ chargeId: 'oct', amount: '450' }],
            }),
            'key-00000001',
            accountant
        );
        await expect(
            service.applyCredit(
                'flat-1',
                { allocations: [{ chargeId: 'dep', amount: '150.01' }] },
                accountant
            )
        ).rejects.toThrow(
            new ConflictException('finance.error.insufficientCredit')
        );
        const out = await service.applyCredit(
            'flat-1',
            { payFor: 'DEPOSIT' },
            accountant
        );
        expect(out.allocations.map(a => [a.chargeId, a.amount])).toEqual([
            ['dep', 150],
        ]);
        expect(state.fundEntries).toHaveLength(1);
        expect(state.fundEntries[0]).toMatchObject({
            entryDate: day('2026-11-20'),
        });
    });

    it('respects the amount cap', async () => {
        const { service } = build(standardCharges);
        await service.create(
            pay({
                amount: '500',
                allocations: [{ chargeId: 'dep', amount: '100' }],
            }),
            'key-00000001',
            accountant
        );
        const out = await service.applyCredit(
            'flat-1',
            { amount: '50' },
            accountant
        );
        expect(out.applied).toBe(50);
    });

    it('no credit, nothing open, and a part-settled charge from the only source', async () => {
        const { service, state } = build(standardCharges);
        await expect(
            service.applyCredit('flat-1', {}, accountant)
        ).rejects.toThrow('finance.error.insufficientCredit');
        await service.create(
            pay({
                amount: '500',
                allocations: [{ chargeId: 'oct', amount: '100' }],
            }),
            'key-00000001',
            accountant
        );
        await expect(
            service.applyCredit(
                'flat-1',
                { allocations: [{ chargeId: 'oct', amount: '50' }] },
                accountant
            )
        ).rejects.toThrow('finance.error.creditSourceConflict');
        state.charges
            .filter(c => c.id !== 'oct')
            .forEach(c => (c.status = 'VOID'));
        await expect(
            service.applyCredit('flat-1', {}, accountant)
        ).rejects.toThrow('finance.error.nothingToAllocate');
    });

    it('a later void of the source payment voids the credit allocations too', async () => {
        const { service, state, db } = build(standardCharges);
        const p = await service.create(
            pay({
                amount: '1000',
                allocations: [{ chargeId: 'oct', amount: '450' }],
            }),
            'key-00000001',
            accountant
        );
        await service.applyCredit('flat-1', {}, accountant);
        expect(live(state)).toHaveLength(2);
        await service.void(p.id, 'Wrong payer flat', accountant);
        expect(live(state)).toHaveLength(0);
        await assertInvariant(db);
    });
});

describe('reads', () => {
    it('list filters, search and cursor; detail; unknown ids', async () => {
        const { service } = build(standardCharges);
        const a = await service.create(
            pay({ amount: '10', reference: 'TRX-1', method: 'BANK_TRANSFER' }),
            'key-00000001',
            accountant
        );
        const b = await service.create(
            pay({ amount: '20' }),
            'key-00000002',
            otherAccountant
        );
        const page1 = await service.list({ limit: 1 });
        expect(page1.items.map(i => i.id)).toEqual([b.id]);
        const page2 = await service.list({
            limit: 1,
            cursor: page1.nextCursor,
        });
        expect(page2.items.map(i => i.id)).toEqual([a.id]);
        expect((await service.list({ q: 'trx' })).items.map(i => i.id)).toEqual(
            [a.id]
        );
        expect(
            (await service.list({ createdById: 'acc-2', method: 'CASH' })).items
        ).toHaveLength(1);
        expect(
            (await service.list({ from: '2026-11-16', to: '2026-11-30' })).items
        ).toHaveLength(0);
        await expect(service.list({ cursor: 'nope' })).rejects.toThrow(
            'finance.error.invalidCursor'
        );
        const detail = await service.detail(a.id);
        expect(detail.allocations).toHaveLength(1);
        expect(detail).not.toHaveProperty('attachmentPath');
        await expect(service.detail('nope')).rejects.toThrow(
            'finance.error.paymentNotFound'
        );
    });
});

describe('staging sweep (plan 5.3)', () => {
    it('promotes referenced stale uploads and deletes orphans', async () => {
        const { service, state, storage } = build(standardCharges);
        const stuck = `staging/acc-1/${NOW.getTime() - 1000}-stuck.jpg`;
        storage.copy.mockResolvedValueOnce(false);
        await service.create(
            pay({ attachmentPath: stuck }),
            'key-00000001',
            accountant
        );
        expect(state.payments[0]?.attachmentPath).toBe(stuck);

        storage.listStagingBefore.mockResolvedValueOnce([
            { path: stuck, createdAt: new Date(0) },
            { path: 'staging/acc-1/1-orphan.jpg', createdAt: new Date(0) },
        ]);
        storage.remove.mockClear();
        const out = await service.sweepStaging();
        expect(out).toEqual({ promoted: 1, deleted: 1 });
        expect(state.payments[0]?.attachmentPath).toMatch(
            /^receipts\/2026\/R-2026-000001\//
        );
        expect(storage.remove).toHaveBeenCalledWith([
            'staging/acc-1/1-orphan.jpg',
        ]);
    });

    it('never throws', async () => {
        const { service, storage } = build();
        storage.listStagingBefore.mockRejectedValueOnce(new Error('down'));
        await expect(service.sweepStaging()).resolves.toEqual({
            promoted: 0,
            deleted: 0,
        });
        await expect(service.sweepStaging()).resolves.toEqual({
            promoted: 0,
            deleted: 0,
        });
    });
});
