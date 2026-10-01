'use client';

import * as React from 'react';

import {
  CART_STORAGE_KEY,
  cartReducer,
  emptyCart,
  parseStoredCart,
  type CartAction,
  type CartState,
} from '@/lib/cart/cart';

type CartContextValue = {
  state: CartState;
  dispatch: React.Dispatch<CartAction>;
  isHydrated: boolean;
};

const CartContext = React.createContext<CartContextValue | null>(null);

function subscribeHydration(): () => void {
  return () => undefined;
}

function getClientHydrationSnapshot(): boolean {
  return true;
}

function getServerHydrationSnapshot(): boolean {
  return false;
}

function initializeCart(): CartState {
  return typeof window === 'undefined'
    ? { ...emptyCart }
    : parseStoredCart(window.localStorage.getItem(CART_STORAGE_KEY));
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = React.useReducer(cartReducer, emptyCart, initializeCart);
  const isHydrated = React.useSyncExternalStore(
    subscribeHydration,
    getClientHydrationSnapshot,
    getServerHydrationSnapshot,
  );

  React.useEffect(() => {
    if (!isHydrated) return;
    window.localStorage.setItem(
      CART_STORAGE_KEY,
      JSON.stringify({ items: state.items, shopId: state.shopId, shopName: state.shopName }),
    );
  }, [isHydrated, state.items, state.shopId, state.shopName]);

  return <CartContext.Provider value={{ state, dispatch, isHydrated }}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const context = React.useContext(CartContext);
  if (!context) throw new Error('useCart must be used within CartProvider');
  return context;
}