import type { TranslationKey } from '@/lib/i18n/types';

/** BFF error codes (see `KNOWN_BACKEND_CODES`) → translation keys, for order and payment failures. */
const ORDER_ERROR_KEYS: Record<string, TranslationKey> = {
  order_shop_closed: 'orders.errors.shop_closed',
  payments_disabled: 'orders.errors.payments_disabled',
  order_invalid_transition: 'orders.errors.invalid_transition',
  order_paid_cannot_cancel: 'orders.errors.paid_cannot_cancel',
  order_status_changed: 'orders.errors.status_changed',
  payment_already_paid: 'orders.errors.already_paid',
  payment_order_cancelled: 'orders.errors.order_cancelled',
};

/** The translation key for a known order/payment error code, or undefined for anything else. */
export function orderErrorKey(code: string | undefined): TranslationKey | undefined {
  return code !== undefined && Object.hasOwn(ORDER_ERROR_KEYS, code) ? ORDER_ERROR_KEYS[code] : undefined;
}
