import type { OrderStatus } from "@/services/api/orders";

/**
 * Mirrors the backend's ORDER_STATUS_TRANSITIONS (orders.service.ts):
 * strictly one step forward, and CANCELLED from any non-terminal state.
 * A paid order can never be cancelled (409 order.error.cannotCancelPaidOrder).
 */
export const FORWARD_STATUS: Readonly<Record<OrderStatus, OrderStatus | null>> = {
  PLACED: "CONFIRMED",
  CONFIRMED: "PREPARING",
  PREPARING: "READY",
  READY: "ON_THE_WAY",
  ON_THE_WAY: "DELIVERED",
  DELIVERED: null,
  CANCELLED: null,
};

export function getNextOrderStatus(status: OrderStatus): OrderStatus | null {
  return FORWARD_STATUS[status] ?? null;
}

export function isTerminalOrderStatus(status: OrderStatus): boolean {
  return status === "DELIVERED" || status === "CANCELLED";
}

export function canCancelOrder(order: { status: OrderStatus; isPaid: boolean }): boolean {
  return !isTerminalOrderStatus(order.status) && !order.isPaid;
}

export function canTransitionOrder(from: OrderStatus, to: OrderStatus): boolean {
  if (to === "CANCELLED")
    return !isTerminalOrderStatus(from);
  return FORWARD_STATUS[from] === to;
}
