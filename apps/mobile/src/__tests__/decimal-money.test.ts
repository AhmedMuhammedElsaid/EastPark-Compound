import { compactParts, compareMoney, percentInt, percentTenths, piastersToDecimal, ratioGreater, sumMoney, toPiasters } from "@/lib/decimal-money";
import { formatMoney } from "@/lib/format-money";

jest.mock("@/lib/format-currency", () => ({ formatCurrency: (n: number) => `EGP ${n}` }));

describe("exact decimal money (spec rule 3)", () => {
  it("parses decimal strings into whole piasters, half away from zero at the third decimal", () => {
    expect(toPiasters("12.50")).toBe(BigInt(1250));
    expect(toPiasters("-0.05")).toBe(BigInt(-5));
    expect(toPiasters("0.004")).toBe(BigInt(0));
    expect(toPiasters("0.005")).toBe(BigInt(1));
    expect(toPiasters("-0.005")).toBe(BigInt(-1));
    expect(toPiasters("10.1")).toBe(BigInt(1010));
    expect(toPiasters(null)).toBe(BigInt(0));
    expect(toPiasters("abc")).toBe(BigInt(0));
  });

  it("sums without float drift and never prints -0.00", () => {
    expect(sumMoney(["0.10", "0.20"])).toBe("0.30");
    expect(sumMoney(Array.from<string>({ length: 10 }).fill("0.10"))).toBe("1.00");
    expect(sumMoney(["0.05", "-0.05"])).toBe("0.00");
    expect(piastersToDecimal(BigInt(-1250))).toBe("-12.50");
  });

  it("keeps large aggregates exact past 2^53", () => {
    expect(sumMoney(["9007199254740992.00", "0.01"])).toBe("9007199254740992.01");
    expect(sumMoney(["9007199254740993.01", "9007199254740993.01"])).toBe("18014398509481986.02");
    expect(formatMoney("9007199254740993.01")).toBe("EGP 9,007,199,254,740,993.01");
    expect(formatMoney("12500.50")).toBe("EGP 12500.5");
    expect(formatMoney("-0.00")).toBe("EGP 0");
  });

  it("compares and rates exactly at fractional-piaster boundaries", () => {
    expect(compareMoney("0.30", "0.30")).toBe(0);
    expect(compareMoney("1284000.01", "1284000.00")).toBe(1);
    // 1 / 8 = 12.5 %: half up to 13 whole, 12.5 tenths exact
    expect(percentInt("1.00", "8.00")).toBe("13");
    expect(percentTenths("1.00", "8.00")).toBe("12.5");
    expect(percentTenths("1.00", "3.00")).toBe("33.3");
    expect(percentTenths("2.00", "3.00")).toBe("66.7");
    expect(percentInt("0.005", "1.00")).toBe("1");
    expect(percentInt("343000.00", "1284000.00")).toBe("27");
    expect(percentInt("5.00", "0.00")).toBeNull();
    // 0.07 / 0.14 = 50 % exactly; floats would drift on 0.1 / 0.3 style ratios
    expect(percentTenths("0.10", "0.30")).toBe("33.3");
  });

  it("compares ratios by cross-multiplication", () => {
    expect(ratioGreater({ amount: "100.00", flats: 10 }, { amount: "99.99", flats: 10 })).toBe(true);
    expect(ratioGreater({ amount: "0.30", flats: 3 }, { amount: "0.10", flats: 1 })).toBe(false);
  });

  it("splits compact amounts exactly", () => {
    expect(compactParts("1250000.00")).toEqual({ negative: false, whole: "1", tenth: "3", unit: "M" });
    expect(compactParts("-2500.00")).toEqual({ negative: true, whole: "2", tenth: "5", unit: "K" });
    expect(compactParts("840.40")).toEqual({ negative: false, whole: "840", tenth: "0", unit: "" });
  });
});
