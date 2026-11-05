/**
 * Role helpers. SUPER_ADMIN (the owner) can do everything ADMIN can, so every
 * admin check goes through isAdminRole(). RESIDENT-only and MERCHANT-only
 * checks stay strict equality and never match SUPER_ADMIN.
 */

export type UserRole = "RESIDENT" | "MERCHANT" | "ADMIN" | "SUPER_ADMIN" | "ACCOUNTANT";

export function isAdminRole(role: string | null | undefined): role is "ADMIN" | "SUPER_ADMIN" {
  return role === "ADMIN" || role === "SUPER_ADMIN";
}

export function isSuperAdminRole(role: string | null | undefined): role is "SUPER_ADMIN" {
  return role === "SUPER_ADMIN";
}

/**
 * ACCOUNTANT only. Use this for every confinement check (locked tabs, gated cart, hidden Home tiles):
 * admins must never be confined.
 */
export function isAccountantRole(role: string | null | undefined): role is "ACCOUNTANT" {
  return role === "ACCOUNTANT";
}

/** Roles that reach the finance desk: ACCOUNTANT plus the admins. NOT a confinement check. */
export function isFinanceRole(role: string | null | undefined): role is "ACCOUNTANT" | "ADMIN" | "SUPER_ADMIN" {
  return isAccountantRole(role) || isAdminRole(role);
}

/** Translation key for a role's display name (badges). */
export function roleLabelKey(role: string): string {
  if (role === "SUPER_ADMIN")
    return "profile.role_super_admin";
  if (role === "ADMIN")
    return "auth.role_admin";
  if (role === "MERCHANT")
    return "auth.role_merchant";
  if (role === "ACCOUNTANT")
    return "auth.role_accountant";
  return "profile.role_resident";
}
