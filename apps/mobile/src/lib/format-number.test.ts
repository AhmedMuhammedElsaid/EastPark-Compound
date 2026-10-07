import { formatNumber } from "./format-number";

describe("formatNumber", () => {
  it("uses Latin digits for English", () => {
    expect(formatNumber(12, "en")).toBe("12");
  });

  it("uses Arabic-Indic digits for Arabic", () => {
    expect(formatNumber(12, "ar")).toBe("١٢");
    expect(formatNumber(5, "ar")).toBe("٥");
  });
});
