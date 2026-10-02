import * as crypto from 'node:crypto';

import {
    BadRequestException,
    ConflictException,
    NotFoundException,
    ServiceUnavailableException,
    UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { OrderStatus, PaymentMethod, Prisma } from '@prisma/client';

import { CacheService } from 'src/common/cache/services/cache.service';
import { DatabaseService } from 'src/common/database/services/database.service';
import {
    PaymentsService,
    PaymobWebhookPayload,
} from 'src/modules/payments/payments.service';

// ─── Fixture ──────────────────────────────────────────────────────────────────

const HMAC_SECRET = 'test-hmac-secret-for-unit-tests';
const ORDER_ID = 'order-abc-123';
const PAYMOB_ORDER_ID = 4455667;

/**
 * Realistic Paymob "transaction processed" callback `obj` (shape taken from
 * Paymob's docs; extra fields Paymob sends but does not sign are included to
 * prove they are ignored).
 */
function realisticObj(): PaymobWebhookPayload['obj'] & Record<string, unknown> {
    return {
        id: 192036465,
        pending: false,
        amount_cents: 12550,
        success: true,
        is_auth: false,
        is_capture: false,
        is_standalone_payment: true,
        is_voided: false,
        is_refunded: false,
        is_3d_secure: true,
        integration_id: 4097558,
        profile_id: 164295,
        has_parent_transaction: false,
        order: {
            id: PAYMOB_ORDER_ID,
            created_at: '2024-05-06T15:38:51.140530',
            merchant_order_id: ORDER_ID,
            amount_cents: 12550,
            currency: 'EGP',
        } as PaymobWebhookPayload['obj']['order'],
        created_at: '2024-05-06T15:39:15.785914',
        currency: 'EGP',
        source_data: { pan: '2346', type: 'card', sub_type: 'MasterCard' },
        error_occured: false,
        owner: 302852,
        data: { message: 'Approved' },
    };
}

/**
 * The exact string Paymob signs for `realisticObj()`, written out by hand in
 * Paymob's documented field order — deliberately NOT produced by walking the
 * fields, so a wrong field list in the service cannot also "fix" the test:
 * amount_cents, created_at, currency, error_occured, has_parent_transaction,
 * id, integration_id, is_3d_secure, is_auth, is_capture, is_refunded,
 * is_standalone_payment, is_voided, order.id, owner, pending,
 * source_data.pan, source_data.sub_type, source_data.type, success
 */
const EXPECTED_SIGNED_STRING =
    '12550' +
    '2024-05-06T15:39:15.785914' +
    'EGP' +
    'false' +
    'false' +
    '192036465' +
    '4097558' +
    'true' +
    'false' +
    'false' +
    'false' +
    'true' +
    'false' +
    '4455667' +
    '302852' +
    'false' +
    '2346' +
    'MasterCard' +
    'card' +
    'true';

const sign = (text: string) =>
    crypto.createHmac('sha512', HMAC_SECRET).update(text).digest('hex');

const VALID_HMAC = sign(EXPECTED_SIGNED_STRING);

const payload = (
    obj: Record<string, unknown> = realisticObj(),
    type = 'TRANSACTION'
): PaymobWebhookPayload =>
    ({ type, obj }) as unknown as PaymobWebhookPayload;

const paymobOrderRow = (overrides: Record<string, unknown> = {}) => ({
    id: ORDER_ID,
    isPaid: false,
    status: OrderStatus.PLACED,
    paymentMethod: PaymentMethod.PAYMOB,
    paymobOrderId: String(PAYMOB_ORDER_ID),
    totalAmount: new Prisma.Decimal('125.50'),
    residentId: 'resident-1',
    ...overrides,
});

// ─── Mocks ────────────────────────────────────────────────────────────────────

const db = {
    order: {
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
    },
};

const configValues: Record<string, unknown> = {
    'paymob.enabled': true,
    'paymob.hmacSecret': HMAC_SECRET,
    'paymob.apiKey': 'api-key',
    'paymob.integrationId': '123',
    'paymob.iframeId': '456',
};

const configService = {
    get: jest.fn((key: string) => configValues[key]),
    getOrThrow: jest.fn((key: string) => {
        if (key in configValues) return configValues[key];
        throw new Error(`Unexpected config key: ${key}`);
    }),
};

const cache = {
    exists: jest.fn(),
    set: jest.fn(),
    get: jest.fn(),
    del: jest.fn(),
};

// ─── Test suite ───────────────────────────────────────────────────────────────

describe('PaymentsService', () => {
    let service: PaymentsService;

    beforeEach(async () => {
        jest.clearAllMocks();
        cache.exists.mockResolvedValue(false);
        cache.set.mockResolvedValue(undefined);
        db.order.updateMany.mockResolvedValue({ count: 1 });

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                PaymentsService,
                { provide: DatabaseService, useValue: db },
                { provide: CacheService, useValue: cache },
                { provide: ConfigService, useValue: configService },
            ],
        }).compile();

        service = module.get(PaymentsService);
    });

    // ── verifyHmac ────────────────────────────────────────────────────────────

    describe('verifyHmac', () => {
        it('fails closed when Paymob is disabled', () => {
            const disabledService = new PaymentsService(
                db as unknown as DatabaseService,
                cache as unknown as CacheService,
                { get: jest.fn(() => undefined) } as unknown as ConfigService
            );

            expect(() => disabledService.verifyHmac({}, 'signature')).toThrow(
                ServiceUnavailableException
            );
        });

        it('accepts the signature of the hand-built Paymob concatenation', () => {
            expect(service.verifyHmac(realisticObj(), VALID_HMAC)).toBe(true);
        });

        it('accepts an upper-case hex signature', () => {
            expect(
                service.verifyHmac(realisticObj(), VALID_HMAC.toUpperCase())
            ).toBe(true);
        });

        it('signs order.id — not "[object Object]"', () => {
            const buggyString = EXPECTED_SIGNED_STRING.replace(
                '4455667',
                '[object Object]'
            );
            expect(service.verifyHmac(realisticObj(), sign(buggyString))).toBe(
                false
            );
        });

        it('rejects a missing or tampered signature', () => {
            expect(service.verifyHmac(realisticObj(), undefined)).toBe(false);
            expect(service.verifyHmac(realisticObj(), '')).toBe(false);
            expect(service.verifyHmac(realisticObj(), 'a'.repeat(128))).toBe(
                false
            );
        });

        it('rejects when a signed field is altered after signing', () => {
            expect(
                service.verifyHmac(
                    { ...realisticObj(), amount_cents: 1 },
                    VALID_HMAC
                )
            ).toBe(false);
            expect(
                service.verifyHmac(
                    {
                        ...realisticObj(),
                        order: { id: 1, merchant_order_id: ORDER_ID },
                    },
                    VALID_HMAC
                )
            ).toBe(false);
        });
    });

    // ── handleWebhook ─────────────────────────────────────────────────────────

    describe('handleWebhook', () => {
        it('ignores non-TRANSACTION callbacks without DB access', async () => {
            await service.handleWebhook(
                payload(realisticObj(), 'TOKEN'),
                VALID_HMAC
            );
            expect(db.order.findUnique).not.toHaveBeenCalled();
        });

        it('reads the signature from the query param, not the body', async () => {
            // A body-embedded hmac must not be honoured.
            const obj = { ...realisticObj(), hmac: VALID_HMAC };
            await expect(
                service.handleWebhook(payload(obj), undefined)
            ).rejects.toBeInstanceOf(UnauthorizedException);
        });

        it('throws UnauthorizedException when HMAC is invalid', async () => {
            await expect(
                service.handleWebhook(payload(), 'a'.repeat(128))
            ).rejects.toBeInstanceOf(UnauthorizedException);
        });

        it('skips unsuccessful and pending transactions', async () => {
            const failed = { ...realisticObj(), success: false };
            const failedString = EXPECTED_SIGNED_STRING.replace(/true$/, 'false');
            await service.handleWebhook(payload(failed), sign(failedString));

            const pending = { ...realisticObj(), pending: true };
            const pendingString =
                EXPECTED_SIGNED_STRING.slice(0, -'false2346MasterCardcardtrue'.length) +
                'true2346MasterCardcardtrue';
            await service.handleWebhook(payload(pending), sign(pendingString));

            expect(db.order.findUnique).not.toHaveBeenCalled();
        });

        it('skips a transaction already processed (Redis idempotency)', async () => {
            cache.exists.mockResolvedValue(true);
            await service.handleWebhook(payload(), VALID_HMAC);
            expect(db.order.findUnique).not.toHaveBeenCalled();
            expect(db.order.updateMany).not.toHaveBeenCalled();
        });

        it('throws BadRequestException when merchant_order_id is missing', async () => {
            const obj = realisticObj();
            obj.order = { id: PAYMOB_ORDER_ID, merchant_order_id: '' };
            await expect(
                service.handleWebhook(payload(obj), VALID_HMAC)
            ).rejects.toBeInstanceOf(BadRequestException);
        });

        it('throws NotFoundException when order does not exist', async () => {
            db.order.findUnique.mockResolvedValue(null);
            await expect(
                service.handleWebhook(payload(), VALID_HMAC)
            ).rejects.toBeInstanceOf(NotFoundException);
        });

        it('does not re-mark an already paid order', async () => {
            db.order.findUnique.mockResolvedValue(
                paymobOrderRow({ isPaid: true })
            );
            await service.handleWebhook(payload(), VALID_HMAC);
            expect(db.order.updateMany).not.toHaveBeenCalled();
            expect(cache.set).toHaveBeenCalled();
        });

        it.each([
            ['no Paymob order id stored', { paymobOrderId: null }],
            ['a different Paymob order id', { paymobOrderId: '999' }],
            [
                'a different amount',
                { totalAmount: new Prisma.Decimal('125.49') },
            ],
        ])('rejects a callback for %s', async (_label, overrides) => {
            db.order.findUnique.mockResolvedValue(paymobOrderRow(overrides));
            await expect(
                service.handleWebhook(payload(), VALID_HMAC)
            ).rejects.toBeInstanceOf(BadRequestException);
            expect(db.order.updateMany).not.toHaveBeenCalled();
        });

        it('rejects a non-EGP callback', async () => {
            db.order.findUnique.mockResolvedValue(paymobOrderRow());
            const obj = { ...realisticObj(), currency: 'USD' };
            const usdString = EXPECTED_SIGNED_STRING.replace('EGP', 'USD');
            await expect(
                service.handleWebhook(payload(obj), sign(usdString))
            ).rejects.toBeInstanceOf(BadRequestException);
            expect(db.order.updateMany).not.toHaveBeenCalled();
        });

        it('marks the order paid atomically and keeps the Paymob order id', async () => {
            db.order.findUnique.mockResolvedValue(paymobOrderRow());

            await service.handleWebhook(payload(), VALID_HMAC);

            expect(db.order.updateMany).toHaveBeenCalledWith({
                where: { id: ORDER_ID, isPaid: false },
                data: { isPaid: true },
            });
            expect(cache.set).toHaveBeenCalledWith(
                'paymob:processed:192036465',
                '1',
                86400
            );
        });
    });

    // ── initiatePayment ───────────────────────────────────────────────────────

    describe('initiatePayment', () => {
        const fetchMock = jest.fn();
        const originalFetch = global.fetch;

        beforeEach(() => {
            fetchMock.mockReset();
            global.fetch = fetchMock as unknown as typeof fetch;
        });
        afterAll(() => {
            global.fetch = originalFetch;
        });

        const jsonResponse = (body: unknown) => ({
            ok: true,
            json: () => Promise.resolve(body),
        });

        it('rejects an already paid order', async () => {
            db.order.findUnique.mockResolvedValue(
                paymobOrderRow({ isPaid: true })
            );
            await expect(
                service.initiatePayment(ORDER_ID, 'resident-1')
            ).rejects.toBeInstanceOf(ConflictException);
        });

        it('rejects a cancelled order', async () => {
            db.order.findUnique.mockResolvedValue(
                paymobOrderRow({ status: OrderStatus.CANCELLED })
            );
            await expect(
                service.initiatePayment(ORDER_ID, 'resident-1')
            ).rejects.toBeInstanceOf(ConflictException);
        });

        it('persists the Paymob ORDER id and sends exact amount_cents', async () => {
            db.order.findUnique.mockResolvedValue({
                ...paymobOrderRow({ paymobOrderId: null }),
                totalAmount: new Prisma.Decimal('0.29'),
                resident: {
                    name: 'Test Resident',
                    email: 'r@example.test',
                    phone: null,
                },
            });
            db.order.update.mockResolvedValue({});
            fetchMock
                .mockResolvedValueOnce(jsonResponse({ token: 'auth' }))
                .mockResolvedValueOnce(jsonResponse({ id: PAYMOB_ORDER_ID }))
                .mockResolvedValueOnce(jsonResponse({ token: 'pay-key' }));

            const result = await service.initiatePayment(
                ORDER_ID,
                'resident-1'
            );

            expect(db.order.update).toHaveBeenCalledWith({
                where: { id: ORDER_ID },
                data: { paymobOrderId: String(PAYMOB_ORDER_ID) },
            });
            // Decimal minor units: 0.29 EGP -> exactly 29 piastres.
            const orderBody = JSON.parse(fetchMock.mock.calls[1][1].body);
            expect(orderBody.amount_cents).toBe(29);
            expect(result.paymentKey).toBe('pay-key');
        });

        it('reuses the stored Paymob order on retry instead of re-registering', async () => {
            db.order.findUnique.mockResolvedValue({
                ...paymobOrderRow(),
                resident: {
                    name: 'Test Resident',
                    email: 'r@example.test',
                    phone: null,
                },
            });
            fetchMock
                .mockResolvedValueOnce(jsonResponse({ token: 'auth' }))
                .mockResolvedValueOnce(jsonResponse({ token: 'pay-key-2' }));

            const result = await service.initiatePayment(
                ORDER_ID,
                'resident-1'
            );

            expect(fetchMock).toHaveBeenCalledTimes(2);
            expect(fetchMock.mock.calls[1][0]).toContain('payment_keys');
            const keyBody = JSON.parse(fetchMock.mock.calls[1][1].body);
            expect(keyBody.order_id).toBe(PAYMOB_ORDER_ID);
            expect(keyBody.amount_cents).toBe(12550);
            expect(db.order.update).not.toHaveBeenCalled();
            expect(result.paymentKey).toBe('pay-key-2');
        });
    });
});
