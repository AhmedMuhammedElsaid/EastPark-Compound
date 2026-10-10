import { describe, expect, it } from 'vitest';

import { relayBackendResponse } from '@/lib/api/bff-errors';
import { orderErrorKey } from '@/lib/api/order-errors';
import { translate } from '@/lib/i18n/resolve';
import ar from '@/translations/ar.json';
import en from '@/translations/en.json';

const CASES: Array<[string, string]> = [
  ['order.error.shopClosed', 'order_shop_closed'],
  ['order.error.paymentsDisabled', 'payments_disabled'],
  ['order.error.invalidStatusTransition', 'order_invalid_transition'],
  ['order.error.cannotCancelPaidOrder', 'order_paid_cannot_cancel'],
  ['order.error.statusChanged', 'order_status_changed'],
  ['payments.error.alreadyPaid', 'payment_already_paid'],
  ['payments.error.orderCancelled', 'payment_order_cancelled'],
];

describe('order 409 codes', () => {
  it.each(CASES)('relays %s as %s with copy in both languages', async (backendCode, bffCode) => {
    const response = await relayBackendResponse(
      new Response(JSON.stringify({ statusCode: 409, code: backendCode, message: backendCode }), { status: 409 }),
    );
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: bffCode });
    const key = orderErrorKey(bffCode);
    expect(key).toBeDefined();
    expect(translate(en, key!)).not.toBe(key);
    expect(translate(ar, key!)).not.toBe(key);
  });

  it('keeps an unknown 409 generic and ignores unknown codes', async () => {
    const response = await relayBackendResponse(new Response(JSON.stringify({ code: 'x.y' }), { status: 409 }));
    expect(await response.json()).toEqual({ error: 'conflict' });
    expect(orderErrorKey('nope')).toBeUndefined();
    expect(orderErrorKey('toString')).toBeUndefined();
  });
});
