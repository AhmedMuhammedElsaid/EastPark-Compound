const NON_DIGITS = /\D/g;
const DASHES = /-/g;

/**
 * wa.me only accepts digits in international format. Egyptian local numbers
 * (01XXXXXXXXX) become 201XXXXXXXXX; "+" and "00" prefixes are dropped.
 * Returns null when nothing usable is left.
 */
export function toWhatsAppDigits(raw: string | null | undefined): string | null {
  let digits = (raw ?? "").replace(NON_DIGITS, "");
  if (digits.startsWith("00"))
    digits = digits.slice(2);
  else if (digits.startsWith("0") && digits.length === 11)
    digits = `20${digits.slice(1)}`;
  return digits.length >= 8 ? digits : null;
}

/** Short, human-friendly order reference shown in chat and on the order screen. */
export function formatOrderNumber(orderId: string): string {
  return `#${orderId.replaceAll(DASHES, "").slice(-6).toUpperCase()}`;
}

export type OrderMessageInput = {
  isAr: boolean;
  orderId: string;
  shopName: string;
  items: Array<{ quantity: number; name: string; lineTotal: string }>;
  total: string;
  paymentLabel: string;
  customerName?: string | null;
  phone?: string | null;
  deliveryLabel: string;
  notes?: string | null;
};

const LABELS = {
  ar: { title: "طلب جديد من إيست بارك", order: "رقم الطلب", shop: "المتجر", items: "الطلبات", total: "الإجمالي", payment: "الدفع", name: "الاسم", phone: "الهاتف", delivery: "التوصيل إلى", notes: "ملاحظات" },
  en: { title: "New EastPark order", order: "Order", shop: "Shop", items: "Items", total: "Total", payment: "Payment", name: "Name", phone: "Phone", delivery: "Deliver to", notes: "Notes" },
} as const;

/** Plain-text WhatsApp message (no emoji). Lines for missing optional fields are omitted. */
export function buildOrderMessage(input: OrderMessageInput): string {
  const l = LABELS[input.isAr ? "ar" : "en"];
  const lines = [
    l.title,
    "",
    `${l.order}: ${formatOrderNumber(input.orderId)}`,
    `${l.shop}: ${input.shopName}`,
    "",
    `${l.items}:`,
    ...input.items.map(i => `${i.quantity} × ${i.name} — ${i.lineTotal}`),
    "",
    `${l.total}: ${input.total}`,
    `${l.payment}: ${input.paymentLabel}`,
  ];
  const customer = [
    input.customerName?.trim() ? `${l.name}: ${input.customerName.trim()}` : null,
    input.phone?.trim() ? `${l.phone}: ${input.phone.trim()}` : null,
    `${l.delivery}: ${input.deliveryLabel}`,
    input.notes?.trim() ? `${l.notes}: ${input.notes.trim()}` : null,
  ].filter((x): x is string => x !== null);
  return [...lines, "", ...customer].join("\n");
}

export function buildWhatsAppUrl(digits: string, message?: string): string {
  return message
    ? `https://wa.me/${digits}?text=${encodeURIComponent(message)}`
    : `https://wa.me/${digits}`;
}

export type OrderHandoff = {
  orderId: string;
  /** International digits of the shop's WhatsApp number, when it has one. */
  whatsappDigits: string | null;
  /** Shop landline/mobile for the "Call the shop" fallback. */
  shopPhone: string | null;
  message: string;
};

let lastHandoff: OrderHandoff | null = null;

/** Transient (in-memory, never persisted) hand-off between payment and confirmation. */
export function setOrderHandoff(handoff: OrderHandoff | null): void {
  lastHandoff = handoff;
}

export function getOrderHandoff(orderId?: string): OrderHandoff | null {
  return lastHandoff && (!orderId || lastHandoff.orderId === orderId) ? lastHandoff : null;
}
