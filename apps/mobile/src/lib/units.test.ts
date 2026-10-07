import type { AuthUser, ResidentUnit } from "@/store/slices/auth-slice";
import authReducer, { login, mergeUserKeepingUnits, updateUser } from "@/store/slices/auth-slice";
import { getDeliveryUnitOptions, getPrimaryUnit, getUnitLabels, resolveDeliveryUnit } from "./units";

function unit(label: string): ResidentUnit {
  const [building, floor, flatNumber] = label.split("-");
  return { id: `u-${label}`, building, floor, flatNumber, label, createdAt: "2026-10-07T00:00:00.000Z" };
}
const base: AuthUser = { id: "1", name: "A", email: "a@x.com", role: "RESIDENT", isVerified: true, avatarUrl: null };

describe("unit options", () => {
  it("falls back to unitNumber for legacy accounts", () => {
    const user = { ...base, unitNumber: "A1-3-2", units: [] };
    expect(getUnitLabels(user)).toEqual(["A1-3-2"]);
    expect(getDeliveryUnitOptions(user)).toEqual(["A1-3-2"]);
    expect(getDeliveryUnitOptions({ ...base, unitNumber: "A1-3-2" })).toEqual(["A1-3-2"]);
  });

  it("returns nothing without any flat", () => {
    expect(getDeliveryUnitOptions(base)).toEqual([]);
    expect(resolveDeliveryUnit(base)).toBe("");
  });

  it("puts the primary flat first and defaults to it", () => {
    const user = { ...base, unitNumber: "B2-1-4", units: [unit("A1-3-2"), unit("B2-1-4")] };
    expect(getPrimaryUnit(user)).toBe("B2-1-4");
    expect(getDeliveryUnitOptions(user)).toEqual(["B2-1-4", "A1-3-2"]);
    expect(resolveDeliveryUnit(user)).toBe("B2-1-4");
  });

  it("uses a valid choice and ignores an unknown one", () => {
    const user = { ...base, unitNumber: "B2-1-4", units: [unit("A1-3-2"), unit("B2-1-4")] };
    expect(resolveDeliveryUnit(user, " A1-3-2 ")).toBe("A1-3-2");
    expect(resolveDeliveryUnit(user, "Z9-9-9")).toBe("B2-1-4");
  });

  it("uses the first flat as primary when unitNumber is null", () => {
    const user = { ...base, unitNumber: null, units: [unit("A1-3-2")] };
    expect(getPrimaryUnit(user)).toBe("A1-3-2");
  });
});

describe("units preservation on user replace", () => {
  const prev = { ...base, units: [unit("A1-3-2")] };

  it("keeps previous units when the new user lacks them", () => {
    expect(mergeUserKeepingUnits(prev, { ...base, name: "B" }).units).toEqual(prev.units);
  });

  it("takes fresh units when present", () => {
    expect(mergeUserKeepingUnits(prev, { ...base, units: [] }).units).toEqual([]);
  });

  it("never carries units across accounts", () => {
    expect(mergeUserKeepingUnits(prev, { ...base, id: "2" }).units).toBeUndefined();
  });

  it("login keeps units for the same account; updateUser sets them", () => {
    const state = authReducer(undefined, login({ user: prev, accessToken: "a", refreshToken: "r" }));
    const relogin = authReducer(state, login({ user: { ...base }, accessToken: "a", refreshToken: "r" }));
    expect(relogin.user?.units).toHaveLength(1);
    const updated = authReducer(relogin, updateUser({ units: [unit("A1-3-2"), unit("B2-1-4")] }));
    expect(updated.user?.units).toHaveLength(2);
  });
});
