import "server-only";

import type { Shop, ShopCategory, ShopPage } from "@/lib/api/shops";
import { parseShopDetail, parseShopPage } from "@/lib/api/shops";
import { backendFetch, type BackendContext } from "@/lib/auth/server";

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

async function fetchWithTransportRetry(path: string, context: BackendContext): Promise<Response> {
  try {
    return await backendFetch(path, {}, context);
  } catch {
    return backendFetch(path, {}, context);
  }
}

export async function getShops(query: ShopQuery = {}, context: BackendContext = {}): Promise<ShopPage> {
  const params = new URLSearchParams({ limit: "20" });
  if (query.category) params.set("category", query.category);
  if (query.cursor) params.set("cursor", query.cursor);
  if (query.search) params.set("search", query.search);

  const response = await fetchWithTransportRetry(`/shops?${params.toString()}`, context);
  if (!response.ok) throw new ShopRequestError(response.status);

  return parseShopPage(await response.json());
}

export async function getShopDetail(id: string, context: BackendContext = {}): Promise<Shop> {
  const response = await fetchWithTransportRetry(
    `/shops/${encodeURIComponent(id)}`,
    context,
  );
  if (!response.ok) throw new ShopRequestError(response.status);

  return parseShopDetail(await response.json());
}
