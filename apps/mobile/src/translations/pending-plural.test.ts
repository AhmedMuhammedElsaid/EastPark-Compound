import i18next from "i18next";

import ar from "./ar.json";
import en from "./en.json";

describe("merchant.pending_count_waiting plurals", () => {
  beforeAll(async () => {
    await i18next.init({
      lng: "en",
      compatibilityJSON: "v4",
      resources: { en: { translation: en }, ar: { translation: ar } },
    });
  });

  it("uses singular and plural in English", () => {
    expect(i18next.t("merchant.pending_count_waiting", { count: 1, lng: "en" })).toBe("1 new order waiting");
    expect(i18next.t("merchant.pending_count_waiting", { count: 3, lng: "en" })).toBe("3 new orders waiting");
  });

  it("covers Arabic plural categories", () => {
    const t = (count: number) => i18next.t("merchant.pending_count_waiting", { count, lng: "ar" });
    expect(t(1)).toBe("طلب جديد بانتظارك");
    expect(t(2)).toBe("طلبان جديدان بانتظارك");
    expect(t(5)).toBe("5 طلبات جديدة بانتظارك");
    expect(t(11)).toBe("11 طلبًا جديدًا بانتظارك");
  });
});
