import { normalizePreferences, NOTIFICATION_TYPES, withPreference } from "./notification-preferences";

describe("notification preferences", () => {
  it("lists every known type in a fixed order, defaulting to enabled", () => {
    const rows = normalizePreferences([{ type: "POLL", enabled: false }, { type: "ORDER_UPDATE", enabled: true }]);
    expect(rows.map(r => r.type)).toEqual([...NOTIFICATION_TYPES]);
    expect(rows.find(r => r.type === "POLL")?.enabled).toBe(false);
    expect(rows.filter(r => r.enabled)).toHaveLength(4);
  });

  it("drops unknown types and survives a missing body", () => {
    expect(normalizePreferences([{ type: "SOMETHING_NEW", enabled: false }]).every(r => r.enabled)).toBe(true);
    expect(normalizePreferences(undefined)).toHaveLength(NOTIFICATION_TYPES.length);
  });

  it("switches one type and leaves the others", () => {
    const rows = normalizePreferences([]);
    const next = withPreference(rows, "ELECTION", false);
    expect(next.find(r => r.type === "ELECTION")?.enabled).toBe(false);
    expect(next.filter(r => !r.enabled)).toHaveLength(1);
    expect(rows.every(r => r.enabled)).toBe(true);
  });
});
