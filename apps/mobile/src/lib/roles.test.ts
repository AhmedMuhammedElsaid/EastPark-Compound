import { isAdminRole, isSuperAdminRole } from "./roles";

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

describe("isSuperAdminRole", () => {
  it("accepts only SUPER_ADMIN", () => {
    expect(isSuperAdminRole("SUPER_ADMIN")).toBe(true);
    expect(isSuperAdminRole("ADMIN")).toBe(false);
    expect(isSuperAdminRole("MERCHANT")).toBe(false);
    expect(isSuperAdminRole("RESIDENT")).toBe(false);
    expect(isSuperAdminRole(undefined)).toBe(false);
    expect(isSuperAdminRole(null)).toBe(false);
  });
});
