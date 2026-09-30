import "server-only";

import type { Shop, ShopCategory, ShopPage } from "@/lib/api/shops";
import { parseShopDetail, parseShopPage } from "@/lib/api/shops";
import { backendFetch } from "@/lib/auth/server";

type ShopQuery = {
  category?: ShopCategory;
  cursor?: string;
  search?: string;
};

export class ShopRequestError extends Error {
  constructor(public readonly status: number) {
    super(`Shop request failed with ${status}`);
  }
}

async function fetchWithTransportRetry(path: string): Promise<Response> {
  try {
    return await backendFetch(path);
  } catch {
    return backendFetch(path);
  }
}

export async function getShops(query: ShopQuery = {}): Promise<ShopPage> {
  const params = new URLSearchParams({ limit: "20" });
  if (query.category) params.set("category", query.category);
  if (query.cursor) params.set("cursor", query.cursor);
  if (query.search) params.set("search", query.search);

  const response = await fetchWithTransportRetry(`/shops?${params.toString()}`);
  if (!response.ok)
    throw new Error(`Shops request failed with ${response.status}`);

  return parseShopPage(await response.json());
}

export async function getShopDetail(id: string): Promise<Shop> {
  const response = await fetchWithTransportRetry(
    `/shops/${encodeURIComponent(id)}`,
  );
  if (!response.ok) throw new ShopRequestError(response.status);

  return parseShopDetail(await response.json());
}
