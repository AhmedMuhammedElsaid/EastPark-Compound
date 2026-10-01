import { z } from 'zod';

export const paymentMethods = ['CASH', 'PAYMOB'] as const;
export type PaymentMethod = (typeof paymentMethods)[number];

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

export type Order = {
  id: string;
  status: 'PLACED' | 'CONFIRMED' | 'PREPARING' | 'READY' | 'ON_THE_WAY' | 'DELIVERED' | 'CANCELLED';
  totalAmount: number;
  notes: string | null;
  deliveryUnit: string;
  paymentMethod: PaymentMethod;
  isPaid: boolean;
  paymobOrderId: string | null;
  cancelledAt: string | null;
  residentId: string;
  shopId: string;
  items: Array<{
    id: string;
    productId: string;
    productNameSnapshot: string;
    productNameArSnapshot: string;
    quantity: number;
    unitPrice: number;
  }>;
  createdAt: string;
  updatedAt: string;
};

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