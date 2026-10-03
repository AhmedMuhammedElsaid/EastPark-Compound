import { client } from "./client";

export type OrderStatus
  = | "PLACED"
    | "CONFIRMED"
    | "PREPARING"
    | "READY"
    | "ON_THE_WAY"
    | "DELIVERED"
    | "CANCELLED";

export type PaymentMethod = "CASH" | "PAYMOB";

export type OrderItem = {
  id: string;
  productId: string;
  productNameSnapshot: string;
  productNameArSnapshot: string;
  quantity: number;
  unitPrice: number;
  /** Additive backend field — may be absent; use getOrderItemTotal(). */
  lineTotal?: number;
};

export type OrderShopSummary = { id: string; name: string; nameAr: string };
export type OrderResidentSummary = { id: string; name: string; unitNumber: string | null };

export type Order = {
  id: string;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  isPaid: boolean;
  totalAmount: number;
  notes: string | null;
  deliveryUnit: string;
  cancelledAt: string | null;
  createdAt: string;
  shopId: string;
  residentId: string;
  /** Additive backend field — may be absent on older responses. */
  shop?: OrderShopSummary | null;
  /** Merchant/admin responses only; may be absent. */
  resident?: OrderResidentSummary | null;
  items: OrderItem[];
};

/** Mirrors backend OrderCreateDto exactly (forbidNonWhitelisted). */
export type PlaceOrderPayload = {
  items: Array<{ productId: string; quantity: number }>;
  paymentMethod: PaymentMethod;
  deliveryUnit: string;
  notes?: string;
};

export function buildPlaceOrderPayload(input: {
  items: Array<{ productId: string; quantity: number }>;
  paymentMethod: PaymentMethod;
  deliveryUnit: string;
  notes?: string | null;
}): PlaceOrderPayload {
  const notes = input.notes?.trim();
  return {
    items: input.items.map(({ productId, quantity }) => ({ productId, quantity })),
    paymentMethod: input.paymentMethod,
    deliveryUnit: input.deliveryUnit.trim(),
    ...(notes ? { notes } : {}),
  };
}

/** Line total: backend `lineTotal` when present, otherwise unitPrice × quantity. */
export function getOrderItemTotal(item: { unitPrice?: number | null; quantity: number; lineTotal?: number | null }): number {
  if (typeof item.lineTotal === "number")
    return item.lineTotal;
  return (Number(item.unitPrice) || 0) * item.quantity;
}

/** Statuses after which no further live updates are expected. */
export const TERMINAL_ORDER_STATUSES: ReadonlySet<OrderStatus> = new Set(["DELIVERED", "CANCELLED"]);

export const ORDER_POLL_INTERVAL_MS = 15_000;

/**
 * Polling is only a fallback for a dropped socket: while the socket is
 * connected live updates arrive by push, and a terminal order never changes.
 */
export function getOrderPollInterval(status: OrderStatus | undefined, socketConnected: boolean): number | false {
  if (socketConnected)
    return false;
  return status && TERMINAL_ORDER_STATUSES.has(status) ? false : ORDER_POLL_INTERVAL_MS;
}

export const ordersApi = {
  placeOrder: (payload: PlaceOrderPayload) =>
    client.post<{ data: Order }>("/orders", payload),

  getOrders: (params?: { cursor?: string; limit?: number }) =>
    client.get<{ data: { items: Order[]; nextCursor: string | null } }>("/orders", { params }),

  getOrder: (orderId: string) =>
    client.get<{ data: Order }>(`/orders/${orderId}`),

  cancelOrder: (orderId: string) =>
    client.patch<{ data: Order }>(`/orders/${orderId}/cancel`),

  initiatePaymobPayment: (orderId: string) =>
    client.post<{ data: { paymentKey: string; iframeUrl: string } }>(`/orders/${orderId}/pay/paymob`),
};
