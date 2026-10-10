import { z } from "zod";

/** Mirrors the backend caps (order.create.dto.ts, product.create.dto.ts). */
export const CART_MAX_LINES = 50;
export const CART_MAX_QUANTITY = 99;
export const PRODUCT_MIN_PRICE = 0.01;
export const PRODUCT_MAX_PRICE = 100_000;

type CartLike = { items: { productId: string; quantity: number }[] };

/** Why adding one more of this product is refused, or null when it fits. */
export function cartAddBlock(cart: CartLike, productId: string): "lines" | "quantity" | null {
  const existing = cart.items.find(item => item.productId === productId);
  if (!existing)
    return cart.items.length >= CART_MAX_LINES ? "lines" : null;
  return existing.quantity >= CART_MAX_QUANTITY ? "quantity" : null;
}

/** Translation key for a refused add. */
export function cartAddBlockKey(block: "lines" | "quantity"): string {
  return block === "lines" ? "cart.line_limit" : "cart.quantity_limit";
}

/** Product price: 0.01 to 100,000 with at most two decimals. Messages are translation keys. */
export const productPriceSchema = z.coerce
  .number({ error: "validation.invalid_price" })
  .min(PRODUCT_MIN_PRICE, "validation.price_min")
  .max(PRODUCT_MAX_PRICE, "validation.price_max")
  .refine(value => Math.round(value * 100) / 100 === value, "validation.price_decimals");

/** 400 from POST /orders when the computed total is above the backend cap. */
export const ORDER_TOTAL_TOO_LARGE_CODE = "order.error.totalTooLarge";
