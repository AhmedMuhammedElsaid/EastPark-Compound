import * as crypto from 'node:crypto';

import {
    BadRequestException,
    NotFoundException,
    UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';

import { CacheService } from 'src/common/cache/services/cache.service';
import { DatabaseService } from 'src/common/database/services/database.service';
import { PaymentsService } from 'src/modules/payments/payments.service';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const HMAC_SECRET = 'test-hmac-secret-for-unit-tests';

/**
 * Build a valid Paymob obj and compute the correct HMAC so tests can verify
 * the happy path without hard-coding a pre-computed digest.
 */
function buildObjWithValidHmac(overrides: Record<string, unknown> = {}) {
    const obj: Record<string, unknown> = {
        amount_cents: 5000,
        created_at: '2024-01-01T00:00:00Z',
        currency: 'EGP',
        error_occured: false,
        has_parent_transaction: false,
        id: 99999,
        integration_id: 1,
        is_3d_secure: false,
        is_auth: false,
        is_capture: false,
        is_refunded: false,
        is_standalone_payment: true,
        is_voided: false,
        order: { id: 1, merchant_order_id: 'order-abc-123' },
        owner: 1,
        pending: false,
        source_data: { pan: '1234', sub_type: 'CARD', type: 'card' },
        success: true,
        ...overrides,
    };

    // Mirror the service's HMAC_FIELDS list
    const HMAC_FIELDS = [
        'amount_cents',
        'created_at',
        'currency',
        'error_occured',
        'has_parent_transaction',
        'id',
        'integration_id',
        'is_3d_secure',
        'is_auth',
        'is_capture',
        'is_refunded',
        'is_standalone_payment',
        'is_voided',
        'order',
        'owner',
        'pending',
        'source_data.pan',
        'source_data.sub_type',
        'source_data.type',
        'success',
    ];

    const concatenated = HMAC_FIELDS.map(field => {
        const parts = field.split('.');
        let value: unknown = obj;
        for (const part of parts) {
            value = (value as Record<string, unknown>)?.[part];
        }
        return value ?? '';
    }).join('');

    const hmac = crypto
        .createHmac('sha512', HMAC_SECRET)
        .update(concatenated)
        .digest('hex');

    return { ...obj, hmac };
}

// ─── Mocks ────────────────────────────────────────────────────────────────────

const db = {
    order: {
        findUnique: jest.fn(),
        update: jest.fn(),
    },
};

const configService = {
    getOrThrow: jest.fn((key: string) => {
        if (key === 'paymob.hmacSecret') return HMAC_SECRET;
        throw new Error(`Unexpected config key: ${key}`);
    }),
};

const cache = {
    exists: jest.fn().mockResolvedValue(false),
    set: jest.fn().mockResolvedValue(undefined),
    get: jest.fn(),
    del: jest.fn(),
};

// ─── Test suite ───────────────────────────────────────────────────────────────

describe('PaymentsService', () => {
    let service: PaymentsService;

    beforeEach(async () => {
        jest.clearAllMocks();

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
        it('returns true for a correctly signed payload', () => {
            const obj = buildObjWithValidHmac();
            expect(service.verifyHmac(obj, obj.hmac as string)).toBe(true);
        });

        it('returns false when hmac is tampered', () => {
            const obj = buildObjWithValidHmac();
            // SHA-512 hex digest = 128 chars; must match length for timingSafeEqual
            expect(service.verifyHmac(obj, 'a'.repeat(128))).toBe(false);
        });

        it('returns false when a field value is altered after signing', () => {
            const obj = buildObjWithValidHmac();
            const hmac = obj.hmac as string;
            // Alter amount after signing
            const tampered = { ...obj, amount_cents: 1 };
            expect(service.verifyHmac(tampered, hmac)).toBe(false);
        });
    });

    // ── handleWebhook ─────────────────────────────────────────────────────────

    describe('handleWebhook', () => {
        it('returns early without DB access for non-TRANSACTION type', async () => {
            await service.handleWebhook({
                type: 'TOKEN',
                obj: buildObjWithValidHmac() as any,
            });
            expect(db.order.findUnique).not.toHaveBeenCalled();
        });

        it('throws UnauthorizedException when HMAC is invalid', async () => {
            const obj = buildObjWithValidHmac();
            // Use a wrong 128-char hex string (same length as SHA-512 output)
            await expect(
                service.handleWebhook({
                    type: 'TRANSACTION',
                    obj: { ...obj, hmac: 'a'.repeat(128) } as any,
                })
            ).rejects.toBeInstanceOf(UnauthorizedException);
        });

        it('returns early for unsuccessful transaction (success=false)', async () => {
            const obj = buildObjWithValidHmac({ success: false });
            await service.handleWebhook({
                type: 'TRANSACTION',
                obj: obj as any,
            });
            expect(db.order.findUnique).not.toHaveBeenCalled();
        });

        it('returns early for pending transaction', async () => {
            const obj = buildObjWithValidHmac({ pending: true });
            await service.handleWebhook({
                type: 'TRANSACTION',
                obj: obj as any,
            });
            expect(db.order.findUnique).not.toHaveBeenCalled();
        });

        it('throws BadRequestException when merchant_order_id is missing', async () => {
            const obj = buildObjWithValidHmac({
                order: { id: 1, merchant_order_id: '' },
            });
            await expect(
                service.handleWebhook({
                    type: 'TRANSACTION',
                    obj: obj as any,
                })
            ).rejects.toBeInstanceOf(BadRequestException);
        });

        it('throws NotFoundException when order does not exist in DB', async () => {
            const obj = buildObjWithValidHmac();
            db.order.findUnique.mockResolvedValue(null);

            await expect(
                service.handleWebhook({
                    type: 'TRANSACTION',
                    obj: obj as any,
                })
            ).rejects.toBeInstanceOf(NotFoundException);
        });

        it('marks order as paid on a valid successful transaction', async () => {
            const obj = buildObjWithValidHmac();
            db.order.findUnique.mockResolvedValue({ id: 'order-abc-123' });
            db.order.update.mockResolvedValue({});

            await service.handleWebhook({
                type: 'TRANSACTION',
                obj: obj as any,
            });

            expect(db.order.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        isPaid: true,
                        paymobOrderId: String(obj.id),
                    }),
                })
            );
        });
    });
});
