import { buildOrderMessage, buildWhatsAppUrl, formatOrderNumber, toWhatsAppDigits } from "./whatsapp";

describe("toWhatsAppDigits", () => {
  it("converts Egyptian local numbers", () => {
    expect(toWhatsAppDigits("010 1234 5678")).toBe("201012345678");
  });
  it("keeps international numbers and strips + and 00", () => {
    expect(toWhatsAppDigits("+20 101 234 5678")).toBe("201012345678");
    expect(toWhatsAppDigits("00201012345678")).toBe("201012345678");
  });
  it("returns null for empty or junk", () => {
    expect(toWhatsAppDigits(null)).toBeNull();
    expect(toWhatsAppDigits("abc")).toBeNull();
  });
});

describe("buildOrderMessage", () => {
  const base = {
    isAr: false,
    orderId: "abcd1234-ef56-7890-abcd-123456abcdef",
    shopName: "Butcher",
    items: [{ quantity: 2, name: "Steak", lineTotal: "EGP 100" }],
    total: "EGP 100",
    paymentLabel: "Cash on delivery",
    deliveryLabel: "Unit 1-2-3",
  };
  it("formats the order number", () => {
    expect(formatOrderNumber(base.orderId)).toBe("#ABCDEF");
  });
  it("builds the english message and omits missing optional fields", () => {
    expect(buildOrderMessage(base)).toBe(
      "New EastPark order\n\nOrder: #ABCDEF\nShop: Butcher\n\nItems:\n2 × Steak — EGP 100\n\nTotal: EGP 100\nPayment: Cash on delivery\n\nDeliver to: Unit 1-2-3",
    );
  });
  it("includes customer details and notes, in Arabic", () => {
    const msg = buildOrderMessage({ ...base, isAr: true, customerName: "أحمد", phone: "0100", notes: "الجرس" });
    expect(msg.startsWith("طلب جديد من إيست بارك")).toBe(true);
    expect(msg).toContain("الاسم: أحمد");
    expect(msg).toContain("الهاتف: 0100");
    expect(msg).toContain("ملاحظات: الجرس");
  });
});

describe("buildWhatsAppUrl", () => {
  it("encodes the text", () => {
    expect(buildWhatsAppUrl("2010", "a b\nc")).toBe("https://wa.me/2010?text=a%20b%0Ac");
  });
  it("keeps the order number left-to-right in Arabic", () => {
    const msg = buildOrderMessage({
      isAr: true,
      orderId: "abcd1234-ef56-7890-abcd-123456abcdef",
      shopName: "جزارة",
      items: [{ quantity: 1, name: "لحم", lineTotal: "١٠٠ ج.م." }],
      total: "١٠٠ ج.م.",
      paymentLabel: "الدفع عند الاستلام",
      deliveryLabel: "وحدة 1-2-3",
    });
    expect(msg).toContain("رقم الطلب: ‎#ABCDEF");
  });
});
