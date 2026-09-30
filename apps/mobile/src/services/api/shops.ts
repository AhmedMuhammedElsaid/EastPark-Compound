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
  user: { name: string; avatarUrl: string | null };
  createdAt: string;
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

  saveShop: (shopId: string) =>
    client.post<{ data: { success: boolean } }>(`/shops/${shopId}/save`),

  unsaveShop: (shopId: string) =>
    client.delete<{ data: { success: boolean } }>(`/shops/${shopId}/save`),

  getSavedShops: (params?: { cursor?: string; limit?: number }) =>
    client.get<{ data: CursorPage<Shop> }>("/users/me/saved-shops", { params }),
};
