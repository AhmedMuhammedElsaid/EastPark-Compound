import ar from "@/translations/ar.json";
import en from "@/translations/en.json";

import { CART_MAX_LINES, CART_MAX_QUANTITY, cartAddBlock, cartAddBlockKey, ORDER_TOTAL_TOO_LARGE_CODE, productPriceSchema } from "./order-limits";

const line = (n: number, quantity = 1) => ({ productId: `p${n}`, quantity });
const fullCart = { items: Array.from({ length: CART_MAX_LINES }, (_, i) => line(i)) };

function lookup(dict: unknown, key: string): unknown {
  return key.split(".").reduce<any>((node, part) => node?.[part], dict);
}

describe("cart caps", () => {
  it("refuses a 51st distinct line but still allows more of an existing one", () => {
    expect(cartAddBlock(fullCart, "new")).toBe("lines");
    expect(cartAddBlock(fullCart, "p3")).toBeNull();
    expect(cartAddBlock({ items: [line(1)] }, "p2")).toBeNull();
  });

  it("refuses a 100th unit of one line", () => {
    expect(cartAddBlock({ items: [line(1, CART_MAX_QUANTITY)] }, "p1")).toBe("quantity");
    expect(cartAddBlock({ items: [line(1, CART_MAX_QUANTITY - 1)] }, "p1")).toBeNull();
  });
});

describe("product price", () => {
  const check = (v: unknown) => productPriceSchema.safeParse(v);

  it("accepts the bounds and two decimals", () => {
    expect(check("0.01").success).toBe(true);
    expect(check("100000").success).toBe(true);
    expect(check("19.99").success).toBe(true);
  });

  it.each([
    ["0", "validation.price_min"],
    ["", "validation.price_min"],
    ["100000.01", "validation.price_max"],
    ["1.234", "validation.price_decimals"],
  ])("rejects %j with %s", (value, message) => {
    const result = check(value);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe(message);
  });
});

describe("limit copy", () => {
  it("has Arabic and English text for every key", () => {
    const keys = [
      cartAddBlockKey("lines"),
      cartAddBlockKey("quantity"),
      "checkout.total_too_large",
      "validation.price_min",
      "validation.price_max",
      "validation.price_decimals",
    ];
    for (const key of keys) {
      expect(typeof lookup(en, key)).toBe("string");
      expect(typeof lookup(ar, key)).toBe("string");
    }
    expect(ORDER_TOTAL_TOO_LARGE_CODE).toBe("order.error.totalTooLarge");
  });
});
