import { isAccountantRole, isAdminRole, isFinanceRole, isSuperAdminRole, roleLabelKey } from "./roles";

describe("isAdminRole", () => {
  it("accepts ADMIN and SUPER_ADMIN", () => {
    expect(isAdminRole("ADMIN")).toBe(true);
    expect(isAdminRole("SUPER_ADMIN")).toBe(true);
  });

  it("rejects other roles and missing values", () => {
    expect(isAdminRole("RESIDENT")).toBe(false);
    expect(isAdminRole("MERCHANT")).toBe(false);
    expect(isAdminRole("ACCOUNTANT")).toBe(false);
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

describe("roleLabelKey", () => {
  it("labels every role, residents included", () => {
    expect(roleLabelKey("RESIDENT")).toBe("profile.role_resident");
    expect(roleLabelKey("MERCHANT")).toBe("auth.role_merchant");
    expect(roleLabelKey("ADMIN")).toBe("auth.role_admin");
    expect(roleLabelKey("SUPER_ADMIN")).toBe("profile.role_super_admin");
    expect(roleLabelKey("ACCOUNTANT")).toBe("auth.role_accountant");
  });
});

describe("isAccountantRole (confinement)", () => {
  it("accepts only ACCOUNTANT, so admins are never confined", () => {
    expect(isAccountantRole("ACCOUNTANT")).toBe(true);
    expect(isAccountantRole("ADMIN")).toBe(false);
    expect(isAccountantRole("SUPER_ADMIN")).toBe(false);
    expect(isAccountantRole("RESIDENT")).toBe(false);
    expect(isAccountantRole("MERCHANT")).toBe(false);
    expect(isAccountantRole(undefined)).toBe(false);
    expect(isAccountantRole(null)).toBe(false);
  });
});

describe("isFinanceRole (finance desk access)", () => {
  it("admits ACCOUNTANT, ADMIN and SUPER_ADMIN only", () => {
    expect(isFinanceRole("ACCOUNTANT")).toBe(true);
    expect(isFinanceRole("ADMIN")).toBe(true);
    expect(isFinanceRole("SUPER_ADMIN")).toBe(true);
    expect(isFinanceRole("RESIDENT")).toBe(false);
    expect(isFinanceRole("MERCHANT")).toBe(false);
    expect(isFinanceRole(undefined)).toBe(false);
    expect(isFinanceRole(null)).toBe(false);
  });
});
