import { z } from 'zod';

export const paymentMethods = ['CASH', 'PAYMOB'] as const;
export type PaymentMethod = (typeof paymentMethods)[number];

export const orderStatuses = [
  'PLACED',
  'CONFIRMED',
  'PREPARING',
  'READY',
  'ON_THE_WAY',
  'DELIVERED',
  'CANCELLED',
] as const;

export type OrderStatus = (typeof orderStatuses)[number];

export const createOrderSchema = z
  .object({
    items: z
      .array(
        z
          .object({
            productId: z.string().min(1),
            quantity: z.number().int().min(1),
          })
          .strict(),
      )
      .min(1),
    notes: z.string().max(1000).optional(),
    deliveryUnit: z.string().trim().min(1).max(100),
    paymentMethod: z.enum(paymentMethods),
  })
  .strict();

export type CreateOrderInput = z.infer<typeof createOrderSchema>;

const orderItemSchema = z.object({
  id: z.string(),
  productId: z.string(),
  productNameSnapshot: z.string(),
  productNameArSnapshot: z.string(),
  quantity: z.number().int().positive(),
  unitPrice: z.number().nonnegative(),
});

export const orderSchema = z.object({
  id: z.string(),
  status: z.enum(orderStatuses),
  totalAmount: z.number().nonnegative(),
  notes: z.string().nullish().transform((value) => value ?? null),
  deliveryUnit: z.string(),
  paymentMethod: z.enum(paymentMethods),
  isPaid: z.boolean(),
  paymobOrderId: z.string().nullish().transform((value) => value ?? null),
  cancelledAt: z.string().nullish().transform((value) => value ?? null),
  residentId: z.string(),
  shopId: z.string(),
  items: z.array(orderItemSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const orderEnvelopeSchema = z.object({ data: orderSchema });
const orderPageEnvelopeSchema = z.object({
  data: z.object({
    items: z.array(orderSchema),
    nextCursor: z.string().nullish().transform((value) => value ?? undefined),
  }),
});

export type Order = z.infer<typeof orderSchema>;
export type OrderPage = z.infer<typeof orderPageEnvelopeSchema>['data'];

export type PaymobInitiation = { paymentKey: string; iframeUrl: string };

export async function placeOrder(input: CreateOrderInput): Promise<Order> {
  const response = await fetch('/api/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(22_000),
  });
  const payload = (await response.json()) as { data?: Order; error?: string };
  if (!response.ok || !payload.data) throw new OrderRequestError(response.status, payload.error);
  return payload.data;
}

export async function initiatePaymob(orderId: string): Promise<PaymobInitiation> {
  const response = await fetch(`/api/orders/${encodeURIComponent(orderId)}/pay/paymob`, {
    method: 'POST',
    signal: AbortSignal.timeout(22_000),
  });
  const payload = (await response.json()) as { data?: PaymobInitiation; error?: string };
  if (!response.ok || !payload.data) throw new OrderRequestError(response.status, payload.error);
  return payload.data;
}

export class OrderRequestError extends Error {
  constructor(public readonly status: number, message = 'Order request failed') {
    super(message);
  }
}

export function parseOrder(payload: unknown): Order {
  return orderEnvelopeSchema.parse(payload).data;
}

export function parseOrderPage(payload: unknown): OrderPage {
  return orderPageEnvelopeSchema.parse(payload).data;
}

export function isOrderStatus(value: string | null | undefined): value is OrderStatus {
  return orderStatuses.some((status) => status === value);
}

export function isTerminalOrderStatus(status: OrderStatus): boolean {
  return status === 'DELIVERED' || status === 'CANCELLED';
}