import { layoutCompound } from "./compound-layout";
import { barsLayout, compactMoney, donutSegments, mapLayout, mixHex, niceScale, num, percentLabel, ringFraction, sparkPoints, stackSegments } from "./geometry";

describe("chart geometry", () => {
  it("parses decimal strings for geometry only", () => {
    expect(num("12500.00")).toBe(12500);
    expect(num("-3.50")).toBe(-3.5);
    expect(num(null)).toBe(0);
    expect(num("abc")).toBe(0);
  });

  it("formats compact money and percentages", () => {
    expect(compactMoney(441000, "en")).toBe("441K");
    expect(compactMoney(1_250_000, "en")).toBe("1.3M");
    expect(compactMoney(-2500, "en")).toBe("-2.5K");
    expect(percentLabel("87.4", "en")).toBe("87.4%");
    expect(percentLabel(null, "en")).toBe("—");
  });

  it("clamps the ring arc but not the label", () => {
    expect(ringFraction("87.4")).toBeCloseTo(0.874);
    expect(ringFraction("140.0")).toBe(1);
    expect(ringFraction("-5.0")).toBe(0);
    expect(ringFraction(null)).toBe(0);
  });

  it("places sparkline points inside the box", () => {
    const pts = sparkPoints([1, 3, 2], 110, 34);
    expect(pts).toHaveLength(3);
    expect(pts[0].x).toBe(3);
    expect(pts[2].x).toBe(107);
    expect(pts[1].y).toBeLessThan(pts[0].y);
    expect(sparkPoints([5, 5], 110, 34).every(p => Number.isFinite(p.y))).toBe(true);
    expect(sparkPoints([], 110, 34)).toEqual([]);
  });

  it("builds a nice scale that always contains zero", () => {
    const pos = niceScale(0, 480000);
    expect(pos.lo).toBe(0);
    expect(pos.hi).toBeGreaterThanOrEqual(480000);
    const mixed = niceScale(-120000, 300000);
    expect(mixed.lo).toBeLessThan(0);
    expect(mixed.ticks).toContain(0);
    expect(niceScale(0, 0).ticks).toEqual([0, 1]);
  });

  it("grows bars up for positive and down for negative values from a zero baseline", () => {
    const layout = barsLayout([100, -50], [40, 0], { w: 300, h: 200 });
    const [first, second] = layout.columns;
    expect(first.billed.y + first.billed.height).toBeCloseTo(layout.zeroY);
    expect(second.billed.y).toBeCloseTo(layout.zeroY);
    expect(second.billed.height).toBeGreaterThan(0);
    expect(second.collected.height).toBe(0);
  });

  it("draws gross only in the donut and survives all-zero input", () => {
    const methods = [
      { method: "CASH", gross: "300.00", reversed: "-50.00", net: "250.00" },
      { method: "CHEQUE", gross: "100.00", reversed: "0.00", net: "100.00" },
      { method: "INSTAPAY", gross: "0.00", reversed: "0.00", net: "0.00" },
    ] as const;
    const { total, segments } = donutSegments(methods, 100);
    expect(total).toBe(400);
    expect(segments[0].length).toBe(75);
    expect(segments[1].offset).toBe(75);
    expect(donutSegments(methods.map(m => ({ ...m, gross: "0.00" })), 100).total).toBe(0);
  });

  it("splits a stacked bar proportionally and ignores negatives", () => {
    const segs = stackSegments([{ key: "a", value: 50 }, { key: "b", value: -10 }, { key: "c", value: 50 }], 200);
    expect(segs.map(s => s.width)).toEqual([100, 0, 100]);
    expect(stackSegments([{ key: "a", value: 0 }], 200)[0].width).toBe(0);
  });

  it("orders the compound grid by building code, 4 per row", () => {
    const slots = layoutCompound(["B1", "A2", "A1", "C1", "D1", "A10"]);
    expect(slots.get("A1")).toEqual({ row: 0, col: 0 });
    expect(slots.get("A2")).toEqual({ row: 0, col: 1 });
    expect(slots.get("A10")).toEqual({ row: 0, col: 2 });
    expect(slots.get("D1")).toEqual({ row: 1, col: 1 });
  });

  it("lays out the map with the worst building the most intense", () => {
    const b = (building: string, totalFlats: number, outstanding: string) => ({ building, totalFlats, owingFlats: 1, outstanding, floors: [] });
    const { items } = mapLayout([b("A1", 60, "6000.00"), b("B1", 40, "100.00")], 360);
    expect(items[0].intensity).toBe(55);
    expect(items[1].intensity).toBeLessThan(items[0].intensity);
    expect(mixHex("#ff0000", "#000000", 50)).toBe("#800000");
  });
});
