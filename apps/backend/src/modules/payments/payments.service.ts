import {
    BadGatewayException,
    BadRequestException,
    ForbiddenException,
    Injectable,
    Logger,
    NotFoundException,
    UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'node:crypto';
import { PaymentMethod } from '@prisma/client';

import { CacheService } from 'src/common/cache/services/cache.service';
import { DatabaseService } from 'src/common/database/services/database.service';

export interface PaymobWebhookPayload {
    type: string;
    obj: {
        id: number;
        success: boolean;
        amount_cents: number;
        currency: string;
        order: { id: number; merchant_order_id: string };
        pending: boolean;
        source_data: { type: string };
        hmac: string;
    };
}

@Injectable()
export class PaymentsService {
    private readonly logger = new Logger(PaymentsService.name);
    private readonly hmacSecret: string;

    // Paymob hashed keys used for HMAC-SHA512 signature
    private static readonly HMAC_FIELDS = [
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

    constructor(
        private readonly db: DatabaseService,
        private readonly cache: CacheService,
        private readonly config: ConfigService
    ) {
        this.hmacSecret = this.config.getOrThrow<string>('paymob.hmacSecret');
    }

    private paymobTxKey(txId: number): string {
        return `paymob:processed:${txId}`;
    }

    verifyHmac(body: Record<string, unknown>, hmac: string): boolean {
        const concatenated = PaymentsService.HMAC_FIELDS.map(field => {
            const parts = field.split('.');
            let value: unknown = body;
            for (const part of parts) {
                value = (value as Record<string, unknown>)?.[part];
            }
            return value ?? '';
        }).join('');

        const computed = crypto
            .createHmac('sha512', this.hmacSecret)
            .update(concatenated)
            .digest('hex');

        // timingSafeEqual throws if buffers have different lengths
        try {
            return crypto.timingSafeEqual(
                Buffer.from(computed),
                Buffer.from(hmac)
            );
        } catch {
            return false;
        }
    }

    async handleWebhook(payload: PaymobWebhookPayload): Promise<void> {
        if (payload.type !== 'TRANSACTION') return;

        const { obj } = payload;
        const hmac = obj.hmac;

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

        const merchantOrderId = obj.order.merchant_order_id;
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
            this.logger.log(`Order ${merchantOrderId} already paid — skipping duplicate webhook`);
            return;
        }

        await this.db.order.update({
            where: { id: merchantOrderId },
            data: {
                isPaid: true,
                paymobOrderId: String(obj.id),
            },
        });

        // Mark transaction as processed in Redis (TTL: 24 hours)
        await this.cache.set(idempotencyKey, '1', 86400);

        this.logger.log(
            `Order ${merchantOrderId} marked as paid (Paymob tx: ${obj.id})`
        );
    }

    async initiatePayment(
        orderId: string,
        actorId: string,
    ): Promise<{ paymentKey: string; iframeUrl: string }> {
        const order = await this.db.order.findUnique({
            where: { id: orderId },
            include: { resident: true },
        });
        if (!order) throw new NotFoundException('order.error.notFound');
        if (order.residentId !== actorId) throw new ForbiddenException();
        if (order.paymentMethod !== PaymentMethod.PAYMOB)
            throw new BadRequestException('order.error.notPaymobOrder');

        const apiKey        = this.config.getOrThrow<string>('paymob.apiKey');
        const integrationId = this.config.getOrThrow<string>('paymob.integrationId');
        const iframeId      = this.config.getOrThrow<string>('paymob.iframeId');
        const amountCents   = Math.round(order.totalAmount * 100);
        const user          = order.resident;

        // Step 1 — Auth token
        const authRes = await fetch('https://accept.paymob.com/api/auth/tokens', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ api_key: apiKey }),
        });
        if (!authRes.ok) throw new BadGatewayException('payments.error.paymobUnavailable');
        const { token: authToken } = await authRes.json() as { token: string };

        // Step 2 — Register order
        const orderRes = await fetch('https://accept.paymob.com/api/ecommerce/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
            body: JSON.stringify({
                amount_cents: amountCents,
                currency: 'EGP',
                merchant_order_id: order.id,
                items: [],
            }),
        });
        if (!orderRes.ok) throw new BadGatewayException('payments.error.paymobUnavailable');
        const { id: paymobOrderId } = await orderRes.json() as { id: number };

        // Step 3 — Payment key
        const nameParts = user.name.split(' ');
        const keyRes = await fetch('https://accept.paymob.com/api/acceptance/payment_keys', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
            body: JSON.stringify({
                amount_cents: amountCents,
                currency: 'EGP',
                order_id: paymobOrderId,
                billing_data: {
                    first_name:      nameParts[0] ?? user.name,
                    last_name:       nameParts.slice(1).join(' ') || 'N/A',
                    email:           user.email,
                    phone_number:    user.phone ?? 'N/A',
                    apartment: 'N/A', floor: 'N/A', street: 'N/A',
                    building: 'N/A', shipping_method: 'NA',
                    postal_code: 'N/A', city: 'N/A', country: 'EG', state: 'N/A',
                },
                integration_id: Number(integrationId),
                expiration: 3600,
            }),
        });
        if (!keyRes.ok) throw new BadGatewayException('payments.error.paymobUnavailable');
        const { token: paymentKey } = await keyRes.json() as { token: string };

        return {
            paymentKey,
            iframeUrl: `https://accept.paymob.com/api/acceptance/iframes/${iframeId}?payment_token=${paymentKey}`,
        };
    }
}
