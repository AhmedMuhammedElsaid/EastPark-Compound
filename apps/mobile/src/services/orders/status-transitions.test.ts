import type { OrderStatus } from "@/services/api/orders";
import { canCancelOrder, canTransitionOrder, getNextOrderStatus } from "@/services/orders/status-transitions";

describe("order status transitions (mirror backend)", () => {
  it("lets the merchant drive the full chain one step at a time", () => {
    const chain: OrderStatus[] = ["PLACED", "CONFIRMED", "PREPARING", "READY", "ON_THE_WAY", "DELIVERED"];
    for (let i = 0; i < chain.length - 1; i++)
      expect(getNextOrderStatus(chain[i])).toBe(chain[i + 1]);
    expect(getNextOrderStatus("DELIVERED")).toBeNull();
    expect(getNextOrderStatus("CANCELLED")).toBeNull();
  });

  it("rejects skips, reversals and terminal moves", () => {
    expect(canTransitionOrder("PLACED", "READY")).toBe(false);
    expect(canTransitionOrder("READY", "PREPARING")).toBe(false);
    expect(canTransitionOrder("DELIVERED", "CANCELLED")).toBe(false);
    expect(canTransitionOrder("CANCELLED", "PLACED")).toBe(false);
    expect(canTransitionOrder("ON_THE_WAY", "CANCELLED")).toBe(true);
  });

  it("never offers cancel for paid or finished orders", () => {
    expect(canCancelOrder({ status: "READY", isPaid: false })).toBe(true);
    expect(canCancelOrder({ status: "READY", isPaid: true })).toBe(false);
    expect(canCancelOrder({ status: "DELIVERED", isPaid: false })).toBe(false);
  });
});
