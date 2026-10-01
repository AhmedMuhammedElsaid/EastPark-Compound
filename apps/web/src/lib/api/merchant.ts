import type { z } from 'zod';

import {
  merchantOrderSchema,
  merchantProductSchema,
  merchantShopSchema,
  orderPageSchema,
  productPageSchema,
  type ProductInput,
  type OrderStatus,
} from '@/lib/schemas/merchant';

type Envelope<T> = { data: T };

async function request<T>(path: string, schema: z.ZodType<T>, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/merchant${path}`, {
    ...init,
    headers: { ...(init?.body ? { 'Content-Type': 'application/json' } : {}), ...init?.headers },
    cache: 'no-store',
    signal: AbortSignal.timeout(12_000),
  });
  const payload = (await response.json().catch(() => null)) as Envelope<unknown> | null;
  if (!response.ok || !payload) throw new Error(response.status === 403 ? 'forbidden' : 'request_failed');
  return schema.parse(payload.data);
}

function queryString(values: Record<string, string | number | boolean | undefined>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== '') query.set(key, String(value));
  }
  const result = query.toString();
  return result ? `?${result}` : '';
}

export const merchantApi = {
  shop: () => request('', merchantShopSchema),
  updateShop: (input: Record<string, unknown>) => request('', merchantShopSchema, { method: 'PATCH', body: JSON.stringify(input) }),
  products: (params: { cursor?: string; limit?: number; search?: string; isAvailable?: boolean } = {}) =>
    request(`/products${queryString(params)}`, productPageSchema),
  createProduct: (input: ProductInput) => request('/products', merchantProductSchema, { method: 'POST', body: JSON.stringify(input) }),
  updateProduct: (id: string, input: Partial<ProductInput>) => request(`/products/${encodeURIComponent(id)}`, merchantProductSchema, { method: 'PATCH', body: JSON.stringify(input) }),
  deleteProduct: async (id: string) => {
    const response = await fetch(`/api/merchant/products/${encodeURIComponent(id)}`, { method: 'DELETE', signal: AbortSignal.timeout(12_000) });
    if (!response.ok) throw new Error('request_failed');
  },
  orders: (params: { cursor?: string; limit?: number; status?: OrderStatus } = {}) =>
    request(`/orders${queryString(params)}`, orderPageSchema),
  order: (id: string) => request(`/orders/${encodeURIComponent(id)}`, merchantOrderSchema),
  updateOrderStatus: (id: string, status: Exclude<OrderStatus, 'PLACED'>) =>
    request(`/orders/${encodeURIComponent(id)}/status`, merchantOrderSchema, { method: 'PATCH', body: JSON.stringify({ status }) }),
};
