import { canOpenResults, resultsStatusKey } from "@/lib/election-results";

describe("election results action", () => {
  it("is offered only for a sealed ADMIN_CONTROLLED election", () => {
    expect(canOpenResults({ visibilityMode: "ADMIN_CONTROLLED", resultsOpen: false })).toBe(true);
    expect(canOpenResults({ visibilityMode: "ADMIN_CONTROLLED", resultsOpen: true })).toBe(false);
    expect(canOpenResults({ visibilityMode: "SEALED_UNTIL_DEADLINE", resultsOpen: false })).toBe(false);
    expect(canOpenResults({ visibilityMode: "LIVE_COUNT", resultsOpen: false })).toBe(false);
  });

  it("describes when residents see the results", () => {
    expect(resultsStatusKey({ visibilityMode: "ADMIN_CONTROLLED", resultsOpen: true })).toBe("admin.results_published");
    expect(resultsStatusKey({ visibilityMode: "ADMIN_CONTROLLED", resultsOpen: false })).toBe("admin.results_sealed_admin");
    expect(resultsStatusKey({ visibilityMode: "SEALED_UNTIL_DEADLINE", resultsOpen: false })).toBe("admin.results_at_deadline");
    expect(resultsStatusKey({ visibilityMode: "LIVE_COUNT", resultsOpen: false })).toBe("admin.results_live");
  });
});
