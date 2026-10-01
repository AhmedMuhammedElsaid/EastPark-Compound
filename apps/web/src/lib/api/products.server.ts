import 'server-only';

import type { ProductPage } from '@/lib/api/products';
import { parseProductPage } from '@/lib/api/products';
import { backendFetch } from '@/lib/auth/server';

export async function getProducts(shopId: string): Promise<ProductPage> {
  const response = await backendFetch(
    `/shops/${encodeURIComponent(shopId)}/products?limit=50&isAvailable=true`,
  );
  if (!response.ok) throw new Error(`Products request failed with ${response.status}`);
  return parseProductPage(await response.json());
}