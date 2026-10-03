export const residentOrderingEnabled = false;

/**
 * Card payments (Paymob) are off for the first release: checkout offers Cash on delivery only, and the
 * backend rejects PAYMOB orders with 409 `order.error.paymentsDisabled` while `PAYMENTS_ENABLED` is
 * off. Flip this (with the backend flag and Paymob credentials) to bring the card option back.
 */
export const cardPaymentsEnabled = false;
