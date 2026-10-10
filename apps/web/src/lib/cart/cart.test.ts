import { describe, expect, it } from 'vitest';

import { CART_MAX_LINES, cartLineLimitReached, cartReducer, emptyCart, parseStoredCart, type CartItem, type CartState } from './cart';

const item = (n: number, quantity = 1): CartItem => ({
  productId: `p${n}`,
  name: `P${n}`,
  nameAr: `م${n}`,
  price: 10,
  quantity,
  imageUrl: null,
});

const full: CartState = {
  items: Array.from({ length: CART_MAX_LINES }, (_, i) => item(i)),
  shopId: 's1',
  shopName: 'Shop',
  pending: null,
};

describe('cart line cap', () => {
  it('ignores a new product once 50 lines are in the cart', () => {
    const next = cartReducer(full, { type: 'add', item: item(999), shopId: 's1', shopName: 'Shop' });
    expect(next).toBe(full);
    expect(cartLineLimitReached(full, 'p999')).toBe(true);
  });

  it('still raises the quantity of a line already in a full cart', () => {
    const next = cartReducer(full, { type: 'add', item: item(3), shopId: 's1', shopName: 'Shop' });
    expect(next.items).toHaveLength(CART_MAX_LINES);
    expect(next.items.find((entry) => entry.productId === 'p3')?.quantity).toBe(2);
    expect(cartLineLimitReached(full, 'p3')).toBe(false);
  });

  it('adds up to the cap and trims an oversized stored cart', () => {
    let state: CartState = { ...emptyCart };
    for (let i = 0; i < CART_MAX_LINES + 5; i++) state = cartReducer(state, { type: 'add', item: item(i), shopId: 's1', shopName: 'Shop' });
    expect(state.items).toHaveLength(CART_MAX_LINES);

    const stored = JSON.stringify({ items: Array.from({ length: 60 }, (_, i) => item(i)), shopId: 's1', shopName: 'Shop' });
    expect(parseStoredCart(stored).items).toHaveLength(CART_MAX_LINES);
  });
});
