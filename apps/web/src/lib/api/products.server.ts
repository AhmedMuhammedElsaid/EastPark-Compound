import "server-only";

import type { ProductPage } from "@/lib/api/products";
import { parseProductPage } from "@/lib/api/products";
import { backendFetch } from "@/lib/auth/server";

export type ProductAvailability = "all" | "available" | "unavailable";

type ProductQuery = {
  availability?: ProductAvailability;
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

export async function getProducts(
  shopId: string,
  query: ProductQuery = {},
): Promise<ProductPage> {
  const params = new URLSearchParams({ limit: "20" });
  if (query.cursor) params.set("cursor", query.cursor);
  if (query.search) params.set("search", query.search);
  if (query.availability === "available") params.set("isAvailable", "true");
  if (query.availability === "unavailable")
    params.set("isAvailable", "false");

  const response = await fetchWithTransportRetry(
    `/shops/${encodeURIComponent(shopId)}/products?${params.toString()}`,
  );
  if (!response.ok)
    throw new Error(`Products request failed with ${response.status}`);

  return parseProductPage(await response.json());
}

export function isProductAvailability(
  value: string | null | undefined,
): value is ProductAvailability {
  return value === "all" || value === "available" || value === "unavailable";
}