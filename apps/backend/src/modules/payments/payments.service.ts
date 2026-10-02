import {
    BadGatewayException,
    BadRequestException,
    ConflictException,
    ForbiddenException,
    Injectable,
    Logger,
    NotFoundException,
    ServiceUnavailableException,
    UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'node:crypto';
import { OrderStatus, PaymentMethod } from '@prisma/client';

import { CacheService } from 'src/common/cache/services/cache.service';
import { DatabaseService } from 'src/common/database/services/database.service';
import { toMinorUnits } from 'src/common/helper/money';

/**
 * Paymob "transaction processed" callback body. The HMAC is NOT part of the
 * body — Paymob sends it as the `?hmac=` query parameter.
 */
export interface PaymobWebhookPayload {
    type: string;
    obj: {
        id: number;
        success: boolean;
        pending: boolean;
        amount_cents: number;
        currency: string;
        created_at?: string;
        error_occured?: boolean;
        has_parent_transaction?: boolean;
        integration_id?: number;
        is_3d_secure?: boolean;
        is_auth?: boolean;
        is_capture?: boolean;
        is_refunded?: boolean;
        is_standalone_payment?: boolean;
        is_voided?: boolean;
        owner?: number;
        order: { id: number; merchant_order_id?: string | null };
        source_data?: {
            pan?: string | null;
            sub_type?: string | null;
            type?: string | null;
        };
    };
}

@Injectable()
export class PaymentsService {
    private readonly logger = new Logger(PaymentsService.name);
    private readonly enabled: boolean;
    private readonly hmacSecret?: string;

    // Paymob transaction-callback HMAC fields, in Paymob's documented
    // (lexicographic) order. Nested values use dot paths — note `order.id`,
    // not `order` (an object would stringify to "[object Object]").
    // TODO(owner): verify against a real Paymob sandbox callback.
    static readonly HMAC_FIELDS: readonly string[] = [
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
        'order.id',
        'owner',
        'pending',
        'source_data.pan',
        'source_data.sub_type',
        'source_data.type',
        'success',
    ];

    constructor(
        private readonly db: DatabaseService,
        private readonly cache: CacheService,
        private readonly config: ConfigService
    ) {
        this.hmacSecret = this.config.get<string>('paymob.hmacSecret');
        this.enabled =
            this.config.get<boolean>('paymob.enabled') ??
            Boolean(this.hmacSecret);
    }

    private ensureEnabled(): void {
        if (!this.enabled || !this.hmacSecret) {
            throw new ServiceUnavailableException('payments.error.disabled');
        }
    }

    private paymobTxKey(txId: number): string {
        return `paymob:processed:${txId}`;
    }

    verifyHmac(
        body: Record<string, unknown>,
        hmac: string | undefined
    ): boolean {
        this.ensureEnabled();
        if (typeof hmac !== 'string' || hmac.length === 0) return false;
        const hmacSecret = this.hmacSecret!;
        const concatenated = PaymentsService.HMAC_FIELDS.map(field => {
            let value: unknown = body;
            for (const part of field.split('.')) {
                value = (value as Record<string, unknown> | null)?.[part];
            }
            if (value === null || value === undefined) return '';
            if (typeof value === 'object') return ''; // never "[object Object]"
            return String(value);
        }).join('');

        const computed = crypto
            .createHmac('sha512', hmacSecret)
            .update(concatenated)
            .digest('hex');

        // timingSafeEqual throws if buffers have different lengths
        try {
            return crypto.timingSafeEqual(
                Buffer.from(computed),
                Buffer.from(hmac.toLowerCase())
            );
        } catch {
            return false;
        }
    }

    async handleWebhook(
        payload: PaymobWebhookPayload,
        hmac: string | undefined
    ): Promise<void> {
        this.ensureEnabled();
        if (payload?.type !== 'TRANSACTION' || !payload.obj) return;

        const { obj } = payload;

        if (!this.verifyHmac(obj as unknown as Record<string, unknown>, hmac)) {
            this.logger.warn('Paymob HMAC verification failed');
            throw new UnauthorizedException('payments.error.invalidHmac');
        }

        if (!obj.success || obj.pending) {
            this.logger.log(
                `Paymob transaction ${obj.id} not successful — skipping`
            );
            return;
        }

        // Idempotency guard — Paymob may retry webhooks
        const idempotencyKey = this.paymobTxKey(obj.id);
        const alreadyProcessed = await this.cache.exists(idempotencyKey);
        if (alreadyProcessed) {
            this.logger.log(
                `Paymob transaction ${obj.id} already processed — skipping duplicate`
            );
            return;
        }

        const merchantOrderId = obj.order?.merchant_order_id;
        if (!merchantOrderId) {
            throw new BadRequestException('payments.error.missingOrderId');
        }

        const order = await this.db.order.findUnique({
            where: { id: merchantOrderId },
        });
        if (!order) throw new NotFoundException('payments.error.orderNotFound');

        // Idempotency — skip if already paid (e.g. duplicate Paymob transaction)
        if (order.isPaid) {
            await this.cache.set(idempotencyKey, '1', 86400);
            this.logger.log(
                `Order ${merchantOrderId} already paid — skipping duplicate webhook`
            );
            return;
        }

        // The callback must belong to the Paymob order registered for this
        // order at initiation, for the exact amount, in EGP.
        if (
            !order.paymobOrderId ||
            order.paymobOrderId !== String(obj.order.id)
        ) {
            this.logger.warn(
                `Paymob order mismatch for order ${merchantOrderId} (tx ${obj.id})`
            );
            throw new BadRequestException('payments.error.orderMismatch');
        }
        if (obj.currency !== 'EGP') {
            this.logger.warn(
                `Paymob currency mismatch for order ${merchantOrderId} (tx ${obj.id})`
            );
            throw new BadRequestException('payments.error.currencyMismatch');
        }
        if (Number(obj.amount_cents) !== toMinorUnits(order.totalAmount)) {
            this.logger.warn(
                `Paymob amount mismatch for order ${merchantOrderId} (tx ${obj.id})`
            );
            throw new BadRequestException('payments.error.amountMismatch');
        }

        // Atomic flip: only one concurrent delivery can mark it paid. The
        // stored paymobOrderId (Paymob ORDER id) is intentionally kept.
        await this.db.order.updateMany({
            where: { id: merchantOrderId, isPaid: false },
            data: { isPaid: true },
        });

        // Mark transaction as processed in Redis (TTL: 24 hours)
        await this.cache.set(idempotencyKey, '1', 86400);

        this.logger.log(
            `Order ${merchantOrderId} marked as paid (Paymob tx: ${obj.id})`
        );
    }

    private async registerPaymobOrder(
        authToken: string,
        amountCents: number,
        orderId: string
    ): Promise<number> {
        const orderRes = await fetch(
            'https://accept.paymob.com/api/ecommerce/orders',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${authToken}`,
                },
                body: JSON.stringify({
                    amount_cents: amountCents,
                    currency: 'EGP',
                    merchant_order_id: orderId,
                    items: [],
                }),
            }
        );
        if (!orderRes.ok)
            throw new BadGatewayException('payments.error.paymobUnavailable');
        const { id: paymobOrderId } = (await orderRes.json()) as { id: number };

        // Persist the Paymob ORDER id — the webhook verifies obj.order.id
        // against it before marking the order paid.
        await this.db.order.update({
            where: { id: orderId },
            data: { paymobOrderId: String(paymobOrderId) },
        });
        return paymobOrderId;
    }

    async initiatePayment(
        orderId: string,
        actorId: string
    ): Promise<{ paymentKey: string; iframeUrl: string }> {
        this.ensureEnabled();
        const order = await this.db.order.findUnique({
            where: { id: orderId },
            include: { resident: true },
        });
        if (!order) throw new NotFoundException('order.error.notFound');
        if (order.residentId !== actorId) throw new ForbiddenException();
        if (order.paymentMethod !== PaymentMethod.PAYMOB)
            throw new BadRequestException('order.error.notPaymobOrder');
        if (order.isPaid)
            throw new ConflictException('payments.error.alreadyPaid');
        if (order.status === OrderStatus.CANCELLED)
            throw new ConflictException('payments.error.orderCancelled');

        const apiKey = this.config.getOrThrow<string>('paymob.apiKey');
        const integrationId = this.config.getOrThrow<string>(
            'paymob.integrationId'
        );
        const iframeId = this.config.getOrThrow<string>('paymob.iframeId');
        const amountCents = toMinorUnits(order.totalAmount);
        const user = order.resident;

        // Step 1 — Auth token
        const authRes = await fetch(
            'https://accept.paymob.com/api/auth/tokens',
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ api_key: apiKey }),
            }
        );
        if (!authRes.ok)
            throw new BadGatewayException('payments.error.paymobUnavailable');
        const { token: authToken } = (await authRes.json()) as {
            token: string;
        };

        // Step 2 — Register order (once). A retry reuses the Paymob order
        // registered on the first attempt: the amount cannot change after the
        // order is placed, and the webhook only accepts callbacks for the
        // stored Paymob order id — re-registering would orphan a payment
        // completed in an earlier iframe.
        const paymobOrderId = order.paymobOrderId
            ? Number(order.paymobOrderId)
            : await this.registerPaymobOrder(
                  authToken,
                  amountCents,
                  order.id
              );

        // Step 3 — Payment key
        const nameParts = user.name.split(' ');
        const keyRes = await fetch(
            'https://accept.paymob.com/api/acceptance/payment_keys',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${authToken}`,
                },
                body: JSON.stringify({
                    amount_cents: amountCents,
                    currency: 'EGP',
                    order_id: paymobOrderId,
                    billing_data: {
                        first_name: nameParts[0] ?? user.name,
                        last_name: nameParts.slice(1).join(' ') || 'N/A',
                        email: user.email,
                        phone_number: user.phone ?? 'N/A',
                        apartment: 'N/A',
                        floor: 'N/A',
                        street: 'N/A',
                        building: 'N/A',
                        shipping_method: 'NA',
                        postal_code: 'N/A',
                        city: 'N/A',
                        country: 'EG',
                        state: 'N/A',
                    },
                    integration_id: Number(integrationId),
                    expiration: 3600,
                }),
            }
        );
        if (!keyRes.ok)
            throw new BadGatewayException('payments.error.paymobUnavailable');
        const { token: paymentKey } = (await keyRes.json()) as {
            token: string;
        };

        return {
            paymentKey,
            iframeUrl: `https://accept.paymob.com/api/acceptance/iframes/${iframeId}?payment_token=${paymentKey}`,
        };
    }
}
