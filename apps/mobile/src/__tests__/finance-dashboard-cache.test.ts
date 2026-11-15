import { financeKeys } from "@/services/api/finance";
import { isPersistableQueryKey, PERSISTED_QUERY_ROOTS } from "@/services/query/client";

jest.mock("@/services/api/client", () => ({ client: { get: jest.fn(), post: jest.fn() } }));

describe("finance dashboard offline cache (spec Q5)", () => {
  it("never persists the dashboard or the audit timeline (owner names and balances)", () => {
    expect(PERSISTED_QUERY_ROOTS.has("finance")).toBe(false);
    expect(isPersistableQueryKey(financeKeys.dashboard(6))).toBe(false);
    expect(isPersistableQueryKey(financeKeys.dashboard(12))).toBe(false);
    expect(isPersistableQueryKey(financeKeys.audit({ from: "2026-11-01", to: "2026-11-15" }))).toBe(false);
    expect(isPersistableQueryKey(financeKeys.flats({ building: "C1", hasBalance: true, sort: "balance" }))).toBe(false);
  });

  it("keys the flats list by every drilldown parameter so lists never mix", () => {
    const a = financeKeys.flats({ building: "C1", hasBalance: true, sort: "balance", asOf: "2026-11-15" });
    const b = financeKeys.flats({ building: "A1", hasBalance: true, sort: "balance", asOf: "2026-11-15" });
    const c = financeKeys.flats({ building: "C1", hasBalance: true, sort: "balance", asOf: "2026-11-14" });
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(c));
  });
});
