import type { CartItem } from "../cart-slice";
import { login, logout } from "../auth-slice";
import reducer, { addItem, clearAndAdd, clearCart, dismissConflict, removeItem, updateQuantity } from "../cart-slice";

function item(productId: string, quantity = 1): CartItem {
  return {
    productId,
    name: `P ${productId}`,
    nameAr: `م ${productId}`,
    price: 10,
    quantity,
    imageUrl: null,
  };
}

describe("cart slice", () => {
  const empty = reducer(undefined, { type: "@@init" });

  it("adds items from one shop and merges quantities", () => {
    let s = reducer(empty, addItem({ item: item("a"), shopId: "s1", shopName: "Shop 1" }));
    s = reducer(s, addItem({ item: item("a", 2), shopId: "s1", shopName: "Shop 1" }));
    expect(s.shopId).toBe("s1");
    expect(s.items).toHaveLength(1);
    expect(s.items[0].quantity).toBe(3);
  });

  it("opens the conflict sheet instead of mixing shops", () => {
    let s = reducer(empty, addItem({ item: item("a"), shopId: "s1", shopName: "Shop 1" }));
    s = reducer(s, addItem({ item: item("b"), shopId: "s2", shopName: "Shop 2" }));
    expect(s.showConflictSheet).toBe(true);
    expect(s.items.map(i => i.productId)).toEqual(["a"]);
    expect(s.pendingShopId).toBe("s2");

    const dismissed = reducer(s, dismissConflict());
    expect(dismissed.showConflictSheet).toBe(false);
    expect(dismissed.items.map(i => i.productId)).toEqual(["a"]);

    const replaced = reducer(s, clearAndAdd());
    expect(replaced.shopId).toBe("s2");
    expect(replaced.items.map(i => i.productId)).toEqual(["b"]);
    expect(replaced.pendingItem).toBeNull();
  });

  it("drops the shop when the last item is removed or set to zero", () => {
    let s = reducer(empty, addItem({ item: item("a"), shopId: "s1", shopName: "Shop 1" }));
    expect(reducer(s, removeItem("a")).shopId).toBeNull();
    s = reducer(s, updateQuantity({ productId: "a", quantity: 0 }));
    expect(s.items).toHaveLength(0);
    expect(s.shopId).toBeNull();
  });

  it("ignores a 51st line and clamps quantity at 99", () => {
    let s = empty;
    for (let i = 0; i < 52; i++)
      s = reducer(s, addItem({ item: item(`p${i}`), shopId: "s1", shopName: "Shop 1" }));
    expect(s.items).toHaveLength(50);
    s = reducer(s, addItem({ item: item("p0", 200), shopId: "s1", shopName: "Shop 1" }));
    expect(s.items[0].quantity).toBe(99);
    s = reducer(s, updateQuantity({ productId: "p1", quantity: 150 }));
    expect(s.items[1].quantity).toBe(99);
  });

  it("clears the cart", () => {
    const s = reducer(empty, addItem({ item: item("a"), shopId: "s1", shopName: "Shop 1" }));
    expect(reducer(s, clearCart()).items).toHaveLength(0);
  });

  describe("session boundaries", () => {
    const user = (id: string) => ({ id, name: "U", email: "u@x.com", role: "RESIDENT" as const, isVerified: true, avatarUrl: null });
    const signIn = (id: string) => login({ user: user(id), accessToken: "a", refreshToken: "r" });
    const filled = () => reducer(empty, addItem({ item: item("a"), shopId: "s1", shopName: "Shop 1" }));

    it("empties the cart on logout", () => {
      const s = reducer(reducer(filled(), signIn("u1")), logout());
      expect(s.items).toHaveLength(0);
      expect(s.shopId).toBeNull();
      expect(s.ownerId).toBeNull();
    });

    it("keeps a guest cart when someone signs in", () => {
      const s = reducer(filled(), signIn("u1"));
      expect(s.items).toHaveLength(1);
      expect(s.ownerId).toBe("u1");
    });

    it("keeps the cart when the same account signs in again", () => {
      const s = reducer(reducer(filled(), signIn("u1")), signIn("u1"));
      expect(s.items).toHaveLength(1);
    });

    it("empties the cart when a different account signs in", () => {
      const s = reducer(reducer(filled(), signIn("u1")), signIn("u2"));
      expect(s.items).toHaveLength(0);
      expect(s.ownerId).toBe("u2");
    });
  });
});
