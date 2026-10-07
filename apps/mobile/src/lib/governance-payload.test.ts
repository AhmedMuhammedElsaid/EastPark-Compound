import i18next from "i18next";

import { buildCandidatePayload } from "@/lib/governance-payload";
import ar from "@/translations/ar.json";
import en from "@/translations/en.json";

describe("candidate payload", () => {
  it("trims names and omits blank optional fields (backend @IsUrl rejects empty strings)", () => {
    const payload = buildCandidatePayload({ name: " Omar Adel ", nameAr: " عمر عادل ", statement: "  ", statementAr: "" });
    expect(payload).toEqual({ name: "Omar Adel", nameAr: "عمر عادل" });
    expect(JSON.stringify(payload)).not.toContain("photoUrl");
  });

  it("keeps statements and the uploaded photo url", () => {
    const payload = buildCandidatePayload(
      { name: "Omar", nameAr: "عمر", statement: " Clean parks ", statementAr: "حدائق نظيفة" },
      "https://cdn.test/candidates/omar.png",
    );
    expect(payload.statement).toBe("Clean parks");
    expect(payload.statementAr).toBe("حدائق نظيفة");
    expect(payload.photoUrl).toBe("https://cdn.test/candidates/omar.png");
  });

  it("drops a null or blank photo url", () => {
    expect(buildCandidatePayload({ name: "Omar", nameAr: "عمر" }, null)).not.toHaveProperty("photoUrl");
    expect(buildCandidatePayload({ name: "Omar", nameAr: "عمر" }, " ")).not.toHaveProperty("photoUrl");
  });
});

describe("admin.candidates_count plurals", () => {
  beforeAll(async () => {
    await i18next.init({
      lng: "en",
      compatibilityJSON: "v4",
      resources: { en: { translation: en }, ar: { translation: ar } },
    });
  });

  it("uses singular and plural in English", () => {
    expect(i18next.t("admin.candidates_count", { count: 1, total: "1", lng: "en" })).toBe("1 candidate");
    expect(i18next.t("admin.candidates_count", { count: 4, total: "4", lng: "en" })).toBe("4 candidates");
  });

  it("covers Arabic plural categories with locale digits", () => {
    const t = (count: number, total: string) => i18next.t("admin.candidates_count", { count, total, lng: "ar" });
    expect(t(0, "٠")).toBe("لا يوجد مرشحون بعد");
    expect(t(1, "١")).toBe("مرشح واحد");
    expect(t(2, "٢")).toBe("مرشحان");
    expect(t(5, "٥")).toBe("٥ مرشحين");
    expect(t(11, "١١")).toBe("١١ مرشحًا");
    expect(t(100, "١٠٠")).toBe("١٠٠ مرشح");
  });
});
