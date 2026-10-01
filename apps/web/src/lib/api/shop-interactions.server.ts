import "server-only";

import { z } from "zod";

import { authenticatedBackendFetch } from "@/lib/api/authenticated.server";
import type { ReviewInput, ReviewPage } from "@/lib/api/shop-interactions";
import { parseReview, parseReviewPage } from "@/lib/api/shop-interactions";
import { backendFetch } from "@/lib/auth/server";

const savedPageSchema = z.object({
  data: z.object({
    items: z.array(z.object({ shopId: z.string() })),
    nextCursor: z.string().nullish().transform((value) => value ?? undefined),
  }),
});

export async function getReviews(
  shopId: string,
  cursor?: string,
): Promise<ReviewPage> {
  const params = new URLSearchParams({ limit: "10" });
  if (cursor) params.set("cursor", cursor);
  const response = await backendFetch(
    `/shops/${encodeURIComponent(shopId)}/reviews?${params.toString()}`,
  );
  if (!response.ok) throw new Error(`Reviews request failed with ${response.status}`);
  return parseReviewPage(await response.json());
}

export async function upsertReview(shopId: string, input: ReviewInput) {
  const response = await authenticatedBackendFetch(
    `/shops/${encodeURIComponent(shopId)}/reviews`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  );
  if (!response.ok) throw new Error(`Review request failed with ${response.status}`);
  return parseReview(await response.json());
}

export async function deleteReview(shopId: string): Promise<void> {
  const response = await authenticatedBackendFetch(
    `/shops/${encodeURIComponent(shopId)}/reviews`,
    { method: "DELETE" },
  );
  if (!response.ok && response.status !== 404) {
    throw new Error(`Review delete failed with ${response.status}`);
  }
}

export async function setShopSaved(shopId: string, saved: boolean): Promise<void> {
  const response = await authenticatedBackendFetch(
    `/shops/${encodeURIComponent(shopId)}/save`,
    { method: saved ? "POST" : "DELETE" },
  );
  if (!response.ok) throw new Error(`Saved shop request failed with ${response.status}`);
}

export async function getShopSaved(shopId: string): Promise<boolean> {
  let cursor: string | undefined;
  do {
    const params = new URLSearchParams({ limit: "50" });
    if (cursor) params.set("cursor", cursor);
    const response = await authenticatedBackendFetch(
      `/users/me/saved-shops?${params.toString()}`,
    );
    if (!response.ok) throw new Error(`Saved shops request failed with ${response.status}`);
    const page = savedPageSchema.parse(await response.json()).data;
    if (page.items.some((item) => item.shopId === shopId)) return true;
    cursor = page.nextCursor;
  } while (cursor);
  return false;
}