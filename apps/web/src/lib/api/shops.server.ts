import 'server-only';

import type { ShopCategory, ShopPage } from '@/lib/api/shops';
import { parseShopPage } from '@/lib/api/shops';
import { backendFetch } from '@/lib/auth/server';

type ShopQuery = {
  category?: ShopCategory;
  cursor?: string;
  search?: string;
};

async function fetchWithTransportRetry(path: string): Promise<Response> {
  try {
    return await backendFetch(path);
  } catch {
    return backendFetch(path);
  }
}

export async function getShops(query: ShopQuery = {}): Promise<ShopPage> {
  const params = new URLSearchParams({ limit: '20' });
  if (query.category) params.set('category', query.category);
  if (query.cursor) params.set('cursor', query.cursor);
  if (query.search) params.set('search', query.search);

  const response = await fetchWithTransportRetry(`/shops?${params.toString()}`);
  if (!response.ok) throw new Error(`Shops request failed with ${response.status}`);

  return parseShopPage(await response.json());
}