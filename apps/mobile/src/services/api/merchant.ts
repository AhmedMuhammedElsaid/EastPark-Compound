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

export type MerchantOrder = {
  id: string;
  status: string;
  totalAmount: number;
  paymentMethod: string;
  notes: string | null;
  createdAt: string;
  items: Array<{
    id: string;
    productNameSnapshot: string;
    productNameArSnapshot: string;
    quantity: number;
    totalPrice: number;
  }>;
  user: { name: string; unitNumber: string };
};

export type ShopUpdatePayload = {
  name?: string;
  nameAr?: string;
  description?: string;
  descriptionAr?: string;
  phone?: string;
  whatsapp?: string;
  workingHours?: Record<string, WorkingHoursDay>;
};

export const merchantApi = {
  // Shop
  getMyShop: () =>
    client.get<{ data: MerchantShop }>("/merchant/shop"),

  toggleShopOpen: (isOpen: boolean) =>
    client.patch<{ data: MerchantShop }>("/merchant/shop", { isOpen }),

  // TODO: backend endpoint is PATCH /shops/:id (merchant can update own shop).
  // The frontend calls this as /shops/:shopId — get the shopId from getMyShop() first.
  // There is no dedicated /merchant/shop PATCH route; the generic PATCH /shops/:id
  // accepts MERCHANT role for their own shop.
  updateShop: (shopId: string, data: ShopUpdatePayload) =>
    client.patch<{ data: MerchantShop }>(`/shops/${shopId}`, data),

  // Products
  getMyProducts: (params?: { cursor?: string; limit?: number; includeUnavailable?: boolean }) =>
    client.get<{ data: { items: Product[]; nextCursor: string | null } }>("/merchant/products", { params }),

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
    description: string;
    descriptionAr: string;
    price: number;
    imageUrl: string;
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
