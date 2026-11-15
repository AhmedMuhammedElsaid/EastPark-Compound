import { auditLabelKey, deltaView, deriveAttention, deriveChecks, FINANCE_AUDIT_ACTIONS, flatsHref, formatMoney, furthestBehind, parseMoney } from "@/lib/finance-dashboard";

import { makeDashboard } from "./fixtures/finance-dashboard";

jest.mock("@/lib/format-currency", () => ({ formatCurrency: (n: number) => `EGP ${n}` }));

describe("finance dashboard adapter", () => {
  it("parses decimal strings only at the edge and tolerates junk", () => {
    expect(parseMoney("12500.50")).toBe(12500.5);
    expect(parseMoney("-5000.00")).toBe(-5000);
    expect(parseMoney(null)).toBe(0);
    expect(formatMoney("3750.00")).toBe("EGP 3750");
  });

  it("builds the drilldown href with every route parameter", () => {
    expect(flatsHref()).toBe("/finance/flats");
    expect(flatsHref({ building: "C1", hasBalance: true, sort: "balance", asOf: "2026-11-15" })).toBe("/finance/flats?building=C1&hasBalance=true&sort=balance&asOf=2026-11-15");
    expect(flatsHref({ hasBalance: true, overdueDays: 91, sort: "balance", asOf: "2026-11-15" })).toBe("/finance/flats?hasBalance=true&overdueDays=91&sort=balance&asOf=2026-11-15");
  });

  it("shows a null delta as an em dash and signs the rest", () => {
    expect(deltaView(null, "en")).toEqual({ text: "—", direction: "none" });
    expect(deltaView("3.2", "en")).toEqual({ text: "3.2%", direction: "up" });
    expect(deltaView("-1.5", "en")).toEqual({ text: "1.5%", direction: "down" });
  });
});

describe("attention cards (spec 4.1)", () => {
  it("lists unapplied, over-90, the building furthest behind and the period, with drilldowns", () => {
    const items = deriveAttention(makeDashboard(), "en");
    expect(items.map(i => i.kind)).toEqual(["unapplied", "over90", "building", "period"]);
    expect(items[1].href).toBe("/finance/flats?hasBalance=true&overdueDays=91&sort=balance&asOf=2026-11-15");
    expect(items[2].params.code).toBe("C1");
    expect(items[2].href).toBe("/finance/flats?building=C1&hasBalance=true&sort=balance&asOf=2026-11-15");
  });

  it("swaps the period card for pending cheques, and hides cards with nothing to show", () => {
    const items = deriveAttention(makeDashboard({ unapplied: { count: 0, total: "0.00", oldest: [] }, aging: { current: "1.00", d31_60: "0.00", d61_90: "0.00", over90: "0.00" }, byBuilding: [], pendingCheques: { count: 2, total: "900.00" } }), "en");
    expect(items.map(i => i.kind)).toEqual(["cheques"]);
  });

  it("picks the highest outstanding per flat, ties broken by code", () => {
    const d = makeDashboard({
      byBuilding: [
        { building: "B1", totalFlats: 10, owingFlats: 1, outstanding: "100.00", floors: [] },
        { building: "A1", totalFlats: 10, owingFlats: 1, outstanding: "100.00", floors: [] },
      ],
    });
    expect(furthestBehind(d)?.building).toBe("A1");
    expect(furthestBehind(makeDashboard({ byBuilding: [{ building: "A1", totalFlats: 5, owingFlats: 0, outstanding: "0.00", floors: [] }] }))).toBeNull();
  });
});

describe("period checks (spec 4.1, Q3)", () => {
  it("is all ok on a clean open period", () => {
    const checks = deriveChecks(makeDashboard({ unapplied: { count: 0, total: "0.00", oldest: [] } }));
    expect(checks).toHaveLength(5);
    expect(checks.every(c => c.ok)).toBe(true);
  });

  it("puts strong warnings first and never fails", () => {
    const checks = deriveChecks(makeDashboard({
      period: { period: "2026-11", status: "CLOSED" },
      checks: { previewBillingRuns: 1, previewImportBatches: 1, operatingChargesInMonth: 0 },
      pendingCheques: { count: 1, total: "10.00" },
    }));
    expect(checks.slice(0, 2).map(c => c.key)).toEqual(["period_not_open", "preview_runs"]);
    expect(checks.find(c => c.key === "preview_runs")?.count).toBe(2);
    expect(checks.filter(c => !c.ok).length).toBe(5);
    expect(checks.find(c => c.key === "no_charges")?.href).toBe("/finance/flats");
  });
});

describe("timeline labels", () => {
  it("maps all 27 finance audit actions and never shows a raw code", () => {
    expect(FINANCE_AUDIT_ACTIONS).toHaveLength(27);
    expect(auditLabelKey("PAYMENT_RECORDED")).toBe("finance.dash.audit.PAYMENT_RECORDED");
    expect(auditLabelKey("SOMETHING_NEW")).toBe("finance.dash.audit_generic");
  });

  it("has Arabic and English copy for every action", () => {
    for (const lang of ["en", "ar"]) {
      const dash = require(`@/translations/${lang}.json`).finance.dash;
      for (const action of FINANCE_AUDIT_ACTIONS)
        expect(typeof dash.audit[action]).toBe("string");
      expect(typeof dash.audit_generic).toBe("string");
    }
  });
});
