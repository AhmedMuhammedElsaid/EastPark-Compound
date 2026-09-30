import type { PayloadAction } from "@reduxjs/toolkit";

import { createSlice } from "@reduxjs/toolkit";

export type CartItem = {
  productId: string;
  name: string;
  nameAr: string;
  price: number;
  quantity: number;
  imageUrl: string | null;
};

type CartState = {
  items: CartItem[];
  shopId: string | null;
  shopName: string | null;
  // Pending item waiting for multi-shop conflict resolution
  pendingItem: CartItem | null;
  pendingShopId: string | null;
  pendingShopName: string | null;
  showConflictSheet: boolean;
};

const initialState: CartState = {
  items: [],
  shopId: null,
  shopName: null,
  pendingItem: null,
  pendingShopId: null,
  pendingShopName: null,
  showConflictSheet: false,
};

export const cartSlice = createSlice({
  name: "cart",
  initialState,
  reducers: {
    /**
     * Add item — if cart has items from a different shop, show conflict sheet.
     * Never silently replace; always ask the user.
     */
    addItem(
      state,
      action: PayloadAction<{
        item: CartItem;
        shopId: string;
        shopName: string;
      }>,
    ) {
      const { item, shopId, shopName } = action.payload;

      // Multi-shop conflict guard
      if (state.shopId && state.shopId !== shopId && state.items.length > 0) {
        state.pendingItem = item;
        state.pendingShopId = shopId;
        state.pendingShopName = shopName;
        state.showConflictSheet = true;
        return;
      }

      state.shopId = shopId;
      state.shopName = shopName;

      const existing = state.items.find(i => i.productId === item.productId);
      if (existing) {
        existing.quantity += item.quantity;
      }
      else {
        state.items.push(item);
      }
    },
    /** User chose "Clear & Add" in conflict sheet */
    clearAndAdd(state) {
      if (!state.pendingItem || !state.pendingShopId)
        return;
      state.items = [state.pendingItem];
      state.shopId = state.pendingShopId;
      state.shopName = state.pendingShopName;
      state.pendingItem = null;
      state.pendingShopId = null;
      state.pendingShopName = null;
      state.showConflictSheet = false;
    },
    /** User chose "Cancel" in conflict sheet */
    dismissConflict(state) {
      state.pendingItem = null;
      state.pendingShopId = null;
      state.pendingShopName = null;
      state.showConflictSheet = false;
    },
    removeItem(state, action: PayloadAction<string>) {
      state.items = state.items.filter(i => i.productId !== action.payload);
      if (state.items.length === 0) {
        state.shopId = null;
        state.shopName = null;
      }
    },
    updateQuantity(
      state,
      action: PayloadAction<{ productId: string; quantity: number }>,
    ) {
      const item = state.items.find(
        i => i.productId === action.payload.productId,
      );
      if (item) {
        if (action.payload.quantity <= 0) {
          state.items = state.items.filter(
            i => i.productId !== action.payload.productId,
          );
          if (state.items.length === 0) {
            state.shopId = null;
            state.shopName = null;
          }
        }
        else {
          item.quantity = action.payload.quantity;
        }
      }
    },
    clearCart(state) {
      state.items = [];
      state.shopId = null;
      state.shopName = null;
      state.pendingItem = null;
      state.pendingShopId = null;
      state.pendingShopName = null;
      state.showConflictSheet = false;
    },
  },
});

export const {
  addItem,
  clearAndAdd,
  dismissConflict,
  removeItem,
  updateQuantity,
  clearCart,
} = cartSlice.actions;

export default cartSlice.reducer;
