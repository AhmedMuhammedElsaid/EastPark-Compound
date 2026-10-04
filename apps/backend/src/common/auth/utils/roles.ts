import { Role } from '@prisma/client';

/**
 * "Admin-like" roles. SUPER_ADMIN can do everything ADMIN can, plus the
 * super-admin-only actions (granting ADMIN, deleting an ADMIN, the activity
 * log). RESIDENT-only and MERCHANT-only behaviour never applies to either.
 */
export const ADMIN_ROLES: readonly Role[] = [Role.ADMIN, Role.SUPER_ADMIN];

export function isAdminRole(role: Role | string | null | undefined): boolean {
    return role === Role.ADMIN || role === Role.SUPER_ADMIN;
}

export function isSuperAdmin(role: Role | string | null | undefined): boolean {
    return role === Role.SUPER_ADMIN;
}

/**
 * Whether `userRole` satisfies a route that allows `allowed`. Exact match,
 * except that SUPER_ADMIN also satisfies ADMIN.
 */
export function roleSatisfies(userRole: Role | string, allowed: Role): boolean {
    if (userRole === allowed) return true;
    return allowed === Role.ADMIN && userRole === Role.SUPER_ADMIN;
}
