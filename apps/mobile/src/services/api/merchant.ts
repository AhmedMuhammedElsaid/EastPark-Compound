import type { Order } from "./orders";

import { client } from "./client";

export type MerchantShop = {
  id: string;
  name: string;
  nameAr: string;
  description: string | null;
  descriptionAr: string | null;
  isOpen: boolean;
  phone: string | null;
  whatsapp?: string | null;
  workingHours?: Record<string, WorkingHoursDay> | null;
};

export type WorkingHoursDay = {
  open: string; // HH:MM format e.g. "09:00"
  close: string; // HH:MM format e.g. "22:00"
  closed: boolean;
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

/**
 * Merchant order = backend OrderResponseDto. `resident` (name/unitNumber) is
 * an additive field; fall back to `deliveryUnit` when it is absent.
 */
export type MerchantOrder = Order;

export function getOrderResidentName(order: Pick<Order, "resident">): string | null {
  return order.resident?.name ?? null;
}

export function getOrderUnit(order: Pick<Order, "resident" | "deliveryUnit">): string {
  // The flat the resident picked for this order, not their profile primary.
  return order.deliveryUnit || order.resident?.unitNumber || "";
}

/** ProductQueryDto max page size. */
export const PRODUCT_PAGE_LIMIT = 50;
const MAX_PRODUCT_PAGES = 20;

export type ShopUpdatePayload = {
  name?: string;
  nameAr?: string;
  // null clears an optional field (the backend DTO accepts null via
  // @IsOptional); undefined leaves it unchanged.
  description?: string | null;
  descriptionAr?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  workingHours?: Record<string, WorkingHoursDay>;
};

export const merchantApi = {
  // Shop
  getMyShop: () =>
    client.get<{ data: MerchantShop }>("/merchant/shop"),

  toggleShopOpen: (isOpen: boolean) =>
    client.patch<{ data: MerchantShop }>("/merchant/shop", { isOpen }),

  // PATCH /merchant/shop resolves the shop from the JWT (same ShopUpdateDto
  // as PATCH /shops/:id), so no shop id is needed.
  updateShop: (data: ShopUpdatePayload) =>
    client.patch<{ data: MerchantShop }>("/merchant/shop", data),

  // Products
  // ProductQueryDto: cursor, limit (1-50), search, isAvailable. Omitting
  // isAvailable returns available AND unavailable products. Never send
  // isAvailable=false: the backend's @Type(() => Boolean) coerces "false" to true.
  getMyProducts: (params?: { cursor?: string; limit?: number; search?: string }) =>
    client.get<{ data: { items: Product[]; nextCursor: string | null } }>("/merchant/products", { params }),

  /** Follows the cursor until every product is loaded (no GET-by-id route exists). */
  getAllMyProducts: async (): Promise<Product[]> => {
    const all: Product[] = [];
    let cursor: string | undefined;
    for (let page = 0; page < MAX_PRODUCT_PAGES; page++) {
      const res = await merchantApi.getMyProducts({ cursor, limit: PRODUCT_PAGE_LIMIT });
      all.push(...res.data.data.items);
      cursor = res.data.data.nextCursor ?? undefined;
      if (!cursor)
        break;
    }
    return all;
  },

  createProduct: (data: {
    name: string;
    nameAr: string;
    description?: string;
    descriptionAr?: string;
    price: number;
    imageUrl?: string;
  }) => client.post<{ data: Product }>("/merchant/products", data),

  updateProduct: (productId: string, data: Partial<{
    name: string;
    nameAr: string;
    // null clears an optional field; undefined leaves it unchanged.
    description: string | null;
    descriptionAr: string | null;
    price: number;
    imageUrl: string | null;
    isAvailable: boolean;
  }>) => client.patch<{ data: Product }>(`/merchant/products/${productId}`, data),

  deleteProduct: (productId: string) =>
    client.delete(`/merchant/products/${productId}`),

  // Orders (incoming to my shop)
  getIncomingOrders: (params?: { cursor?: string; limit?: number; status?: string }) =>
    client.get<{ data: { items: MerchantOrder[]; nextCursor: string | null } }>("/merchant/orders", { params }),

  getOrder: (orderId: string) =>
    client.get<{ data: MerchantOrder }>(`/merchant/orders/${orderId}`),

  updateOrderStatus: (orderId: string, status: string) =>
    client.patch<{ data: MerchantOrder }>(`/merchant/orders/${orderId}/status`, { status }),
};
