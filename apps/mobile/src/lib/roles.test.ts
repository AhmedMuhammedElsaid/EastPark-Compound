import { isAdminRole } from "./roles";

describe("isAdminRole", () => {
  it("accepts ADMIN and SUPER_ADMIN", () => {
    expect(isAdminRole("ADMIN")).toBe(true);
    expect(isAdminRole("SUPER_ADMIN")).toBe(true);
  });

  it("rejects other roles and missing values", () => {
    expect(isAdminRole("RESIDENT")).toBe(false);
    expect(isAdminRole("MERCHANT")).toBe(false);
    expect(isAdminRole(undefined)).toBe(false);
    expect(isAdminRole(null)).toBe(false);
    expect(isAdminRole("admin")).toBe(false);
  });
});
