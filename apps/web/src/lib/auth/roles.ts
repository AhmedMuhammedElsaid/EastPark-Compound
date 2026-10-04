/**
 * Role helpers shared by the proxy, server code and client UI (dependency-free).
 *
 * "Admin-like" = ADMIN or SUPER_ADMIN: every staff-admin surface accepts both. RESIDENT-only and
 * MERCHANT-only surfaces must keep comparing against their exact role.
 */
export const ROLES = ['GUEST', 'RESIDENT', 'MERCHANT', 'ADMIN', 'SUPER_ADMIN'] as const;
export type RoleName = (typeof ROLES)[number];

/** Roles the super admin may assign through the role-change endpoint. SUPER_ADMIN/GUEST are never assignable. */
export const ASSIGNABLE_ROLES = ['RESIDENT', 'MERCHANT', 'ADMIN'] as const;
export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

export function isAdminRole(role: string | null | undefined): boolean {
  return role === 'ADMIN' || role === 'SUPER_ADMIN';
}

export function isSuperAdminRole(role: string | null | undefined): boolean {
  return role === 'SUPER_ADMIN';
}
