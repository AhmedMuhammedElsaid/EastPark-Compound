import type { OrderStatus } from "@/services/api/orders";
import { BRAND, SEMANTIC } from "@/theme/tokens";

/** Semantic accent per order status; pills render a tinted fill + readable theme text. */
export function getOrderStatusAccent(status: OrderStatus): string {
  switch (status) {
    case "PLACED":
    case "CONFIRMED":
      return SEMANTIC.info;
    case "PREPARING":
    case "READY":
      return SEMANTIC.warning;
    case "ON_THE_WAY":
      return BRAND.gold;
    case "DELIVERED":
      return SEMANTIC.success;
    case "CANCELLED":
      return SEMANTIC.error;
    default:
      return BRAND.gold;
  }
}
