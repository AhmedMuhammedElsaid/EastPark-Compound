import { buildOrderMessage, buildWhatsAppAppUrl, buildWhatsAppUrl, formatOrderNumber, openWhatsAppChat, toWhatsAppDigits } from "./whatsapp";

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
  it("normalises every spelling of the production shop number to the same digits", () => {
    expect(toWhatsAppDigits("+201017134627")).toBe("201017134627");
    expect(toWhatsAppDigits("00201017134627")).toBe("201017134627");
    expect(toWhatsAppDigits("01017134627")).toBe("201017134627");
    expect(toWhatsAppDigits("+20 101 713 4627")).toBe("201017134627");
    expect(toWhatsAppDigits("0101-713-4627")).toBe("201017134627");
    expect(toWhatsAppDigits(" 0020 101 713 4627 ")).toBe("201017134627");
  });
  it("drops the trunk 0 after the country code", () => {
    expect(toWhatsAppDigits("+20 01017134627")).toBe("201017134627");
  });
  it("rejects numbers without a country code", () => {
    expect(toWhatsAppDigits("02 2345 6789")).toBeNull();
    expect(toWhatsAppDigits("0101713462")).toBeNull();
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
  it("builds wa.me and app-scheme links with digits only", () => {
    const digits = toWhatsAppDigits("+20 101 713 4627") as string;
    expect(buildWhatsAppUrl(digits)).toBe("https://wa.me/201017134627");
    expect(buildWhatsAppAppUrl(digits, "a&b")).toBe("whatsapp://send?phone=201017134627&text=a%26b");
    expect(buildWhatsAppAppUrl(digits)).toBe("whatsapp://send?phone=201017134627");
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

describe("openWhatsAppChat", () => {
  it("opens the app scheme first", async () => {
    const open = jest.fn(async () => true);
    await openWhatsAppChat("201017134627", "hi", open);
    expect(open).toHaveBeenCalledTimes(1);
    expect(open).toHaveBeenCalledWith("whatsapp://send?phone=201017134627&text=hi");
  });
  it("falls back to wa.me when the app scheme fails", async () => {
    const open = jest.fn()
      .mockRejectedValueOnce(new Error("no activity"))
      .mockResolvedValueOnce(true);
    await openWhatsAppChat("201017134627", "hi", open);
    expect(open).toHaveBeenLastCalledWith("https://wa.me/201017134627?text=hi");
  });
  it("rejects only when both fail", async () => {
    const open = jest.fn(async () => {
      throw new Error("nothing");
    });
    await expect(openWhatsAppChat("201017134627", undefined, open)).rejects.toThrow("nothing");
    expect(open).toHaveBeenCalledTimes(2);
  });
});
