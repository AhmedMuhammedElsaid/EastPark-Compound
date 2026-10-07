/**
 * Card payments (Paymob) are off for the first release: checkout offers Cash on delivery only, and the
 * backend rejects PAYMOB orders with 409 `order.error.paymentsDisabled` while `PAYMENTS_ENABLED` is
 * off. Flip this (with the backend flag and Paymob credentials) to bring the card option back.
 */
export const CARD_PAYMENTS_ENABLED = false;

/**
 * Release behaviour: after the order is saved, open WhatsApp to the shop's number with the order
 * pre-filled (the shop confirms by chat; tracking and the merchant dashboard are unchanged).
 * Set to false to place orders silently, exactly as before.
 */
export const WHATSAPP_ORDER_HANDOFF = true;
