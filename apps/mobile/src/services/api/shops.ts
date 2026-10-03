import { client } from "./client";

export type ShopCategory = "CAFE_AND_FOOD" | "GROCERY" | "BUTCHER" | "SERVICES" | "OTHER";

export type Shop = {
  id: string;
  name: string;
  nameAr: string;
  description: string | null;
  descriptionAr: string | null;
  category: ShopCategory;
  phone: string | null;
  whatsapp: string | null;
  isOpen: boolean;
  averageRating: number | null;
  reviewCount: number;
  photos: Array<{ id: string; url: string; order: number; isPrimary: boolean }>;
  workingHours: Record<string, { open: string; close: string; closed: boolean }> | null;
};

export type Product = {
  id: string;
  name: string;
  nameAr: string;
  description: string | null;
  descriptionAr: string | null;
  price: number;
  imageUrl: string | null;
  isAvailable: boolean;
};

export type Review = {
  id: string;
  rating: number;
  comment: string | null;
  user: { id: string; name: string };
  createdAt: string;
};

/** SavedShopResponseDto — the shop is nested, not the item itself. */
export type SavedShop = {
  userId: string;
  shopId: string;
  shop: Shop;
};

export type CursorPage<T> = {
  items: T[];
  nextCursor: string | null;
};

export const shopsApi = {
  getShops: (params: {
    cursor?: string;
    limit?: number;
    category?: ShopCategory;
    search?: string;
  }) =>
    client.get<{ data: CursorPage<Shop> }>("/shops", { params }),

  getShop: (shopId: string) =>
    client.get<{ data: Shop }>(`/shops/${shopId}`),

  getProducts: (shopId: string, params?: { cursor?: string; limit?: number }) =>
    client.get<{ data: CursorPage<Product> }>(`/shops/${shopId}/products`, { params }),

  getReviews: (shopId: string, params?: { cursor?: string; limit?: number }) =>
    client.get<{ data: CursorPage<Review> }>(`/shops/${shopId}/reviews`, { params }),

  submitReview: (shopId: string, rating: number, comment?: string) =>
    client.post<{ data: Review }>(`/shops/${shopId}/reviews`, { rating, comment }),

  // 204 No Content. Saving is idempotent; unsaving a shop that is not saved
  // returns 404. RESIDENT only (403 for merchants/admins).
  saveShop: (shopId: string) =>
    client.post<void>(`/shops/${shopId}/save`),

  unsaveShop: (shopId: string) =>
    client.delete<void>(`/shops/${shopId}/save`),

  // SavedShopQueryDto: limit 1-50.
  getSavedShops: (params?: { cursor?: string; limit?: number }) =>
    client.get<{ data: CursorPage<SavedShop> }>("/users/me/saved-shops", { params }),
};

const SAVED_SHOPS_PAGE_LIMIT = 50;
const MAX_SAVED_SHOP_PAGES = 10;

/** Ids of every shop the signed-in resident saved (follows the cursor). */
export async function getAllSavedShopIds(): Promise<string[]> {
  const ids: string[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < MAX_SAVED_SHOP_PAGES; page++) {
    const res = await shopsApi.getSavedShops({ cursor, limit: SAVED_SHOPS_PAGE_LIMIT });
    ids.push(...res.data.data.items.map(item => item.shopId));
    cursor = res.data.data.nextCursor ?? undefined;
    if (!cursor)
      break;
  }
  return ids;
}
