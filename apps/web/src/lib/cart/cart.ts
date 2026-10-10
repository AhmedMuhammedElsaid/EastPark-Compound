export const CART_STORAGE_KEY = 'eastpark_cart_v1';

/** Distinct products per order; the backend rejects more than this. */
export const CART_MAX_LINES = 50;

/** True when adding this product would open a new line beyond the cap. */
export function cartLineLimitReached(state: Pick<CartState, 'items'>, productId: string): boolean {
  return state.items.length >= CART_MAX_LINES && !state.items.some((item) => item.productId === productId);
}

export type CartItem = {
  productId: string;
  name: string;
  nameAr: string;
  price: number;
  quantity: number;
  imageUrl: string | null;
};

export type PendingCartItem = {
  item: CartItem;
  shopId: string;
  shopName: string;
} | null;

export type CartState = {
  items: CartItem[];
  shopId: string | null;
  shopName: string | null;
  pending: PendingCartItem;
};

export type CartAction =
  | { type: 'add'; item: CartItem; shopId: string; shopName: string }
  | { type: 'accept-conflict' }
  | { type: 'dismiss-conflict' }
  | { type: 'remove'; productId: string }
  | { type: 'set-quantity'; productId: string; quantity: number }
  | { type: 'clear' }
  | { type: 'hydrate'; state: CartState };

export const emptyCart: CartState = {
  items: [],
  shopId: null,
  shopName: null,
  pending: null,
};

function withoutItem(state: CartState, productId: string): CartState {
  const items = state.items.filter((item) => item.productId !== productId);
  return items.length > 0
    ? { ...state, items }
    : { ...emptyCart };
}

export function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'add': {
      if (state.shopId && state.shopId !== action.shopId && state.items.length > 0) {
        return {
          ...state,
          pending: { item: action.item, shopId: action.shopId, shopName: action.shopName },
        };
      }

      if (cartLineLimitReached(state, action.item.productId)) return state;

      const existing = state.items.find((item) => item.productId === action.item.productId);
      const items = existing
        ? state.items.map((item) =>
            item.productId === action.item.productId
              ? { ...item, quantity: item.quantity + action.item.quantity }
              : item,
          )
        : [...state.items, action.item];

      return { items, shopId: action.shopId, shopName: action.shopName, pending: null };
    }
    case 'accept-conflict':
      return state.pending
        ? {
            items: [state.pending.item],
            shopId: state.pending.shopId,
            shopName: state.pending.shopName,
            pending: null,
          }
        : state;
    case 'dismiss-conflict':
      return { ...state, pending: null };
    case 'remove':
      return withoutItem(state, action.productId);
    case 'set-quantity':
      return action.quantity <= 0
        ? withoutItem(state, action.productId)
        : {
            ...state,
            items: state.items.map((item) =>
              item.productId === action.productId
                ? { ...item, quantity: Math.max(1, Math.floor(action.quantity)) }
                : item,
            ),
          };
    case 'clear':
      return { ...emptyCart };
    case 'hydrate':
      return action.state;
  }
}

export function cartTotal(state: CartState): number {
  return state.items.reduce((total, item) => total + item.price * item.quantity, 0);
}

export function parseStoredCart(value: string | null): CartState {
  if (!value) return { ...emptyCart };

  try {
    const parsed = JSON.parse(value) as Partial<CartState>;
    if (!Array.isArray(parsed.items)) return { ...emptyCart };

    const items = parsed.items.filter(
      (item): item is CartItem =>
        typeof item === 'object' &&
        item !== null &&
        typeof item.productId === 'string' &&
        typeof item.name === 'string' &&
        typeof item.nameAr === 'string' &&
        typeof item.price === 'number' &&
        Number.isFinite(item.price) &&
        item.price >= 0 &&
        typeof item.quantity === 'number' &&
        Number.isInteger(item.quantity) &&
        item.quantity > 0 &&
        (typeof item.imageUrl === 'string' || item.imageUrl === null),
    );

    items.length = Math.min(items.length, CART_MAX_LINES);
    if (items.length === 0 || typeof parsed.shopId !== 'string') return { ...emptyCart };
    return {
      items,
      shopId: parsed.shopId,
      shopName: typeof parsed.shopName === 'string' ? parsed.shopName : null,
      pending: null,
    };
  } catch {
    return { ...emptyCart };
  }
}