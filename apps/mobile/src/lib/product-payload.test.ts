import { buildProductCreatePayload, buildProductUpdatePayload } from "@/lib/product-payload";

const base = { name: "Tea", nameAr: "شاي", price: 10 };

describe("product payload", () => {
  it("sends null for cleared optional fields on update", () => {
    const payload = buildProductUpdatePayload({ ...base, description: "", descriptionAr: "  ", imageUrl: "" });
    expect(payload.description).toBeNull();
    expect(payload.descriptionAr).toBeNull();
    expect(payload.imageUrl).toBeNull();
    expect(JSON.parse(JSON.stringify(payload))).toHaveProperty("imageUrl", null);
  });

  it("keeps filled values on update", () => {
    const payload = buildProductUpdatePayload({ ...base, description: "Hot", imageUrl: "https://x.test/a.png" });
    expect(payload.description).toBe("Hot");
    expect(payload.imageUrl).toBe("https://x.test/a.png");
  });

  it("omits cleared optional fields on create", () => {
    const payload = buildProductCreatePayload({ ...base, description: "", imageUrl: "" });
    expect(payload.description).toBeUndefined();
    expect(payload.imageUrl).toBeUndefined();
  });
});
