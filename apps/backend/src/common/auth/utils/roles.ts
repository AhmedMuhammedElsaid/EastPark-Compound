import { ConflictException } from '@nestjs/common';
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

/**
 * Roles that reach the finance desk: ACCOUNTANT plus the admin roles. This is
 * NOT a satisfaction rule (`roleSatisfies` never lets ACCOUNTANT pass an ADMIN
 * route); finance routes list `[Role.ACCOUNTANT, Role.ADMIN]` explicitly.
 */
export function isFinanceRole(role: Role | string | null | undefined): boolean {
    return role === Role.ACCOUNTANT || isAdminRole(role);
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

/** Privilege order used so an invitation can upgrade but never downgrade. */
const ROLE_RANK: Record<Role, number> = {
    [Role.GUEST]: -1,
    [Role.RESIDENT]: 0,
    [Role.MERCHANT]: 1,
    [Role.ADMIN]: 2,
    [Role.SUPER_ADMIN]: 3,
    // Not comparable: ACCOUNTANT is never ranked above or below another role.
    // `resolveInvitedRole` handles it explicitly; 0 only keeps the record total.
    [Role.ACCOUNTANT]: 0,
};

/**
 * Role an existing account ends up with after accepting an invitation.
 * ACCOUNTANT is non-comparable: it is granted only to a RESIDENT, and a
 * MERCHANT/ADMIN/ACCOUNTANT invitation to an existing accountant is refused,
 * as is an ACCOUNTANT invitation to any other existing role (never a silent
 * upgrade or downgrade). Everything else upgrades by rank, never downgrades.
 */
export function resolveInvitedRole(invited: Role, existing: Role): Role {
    if (invited === Role.ACCOUNTANT) {
        if (existing === Role.RESIDENT) return Role.ACCOUNTANT;
        if (existing === Role.ACCOUNTANT) return existing;
        throw new ConflictException('invitation.error.roleConflict');
    }
    if (existing === Role.ACCOUNTANT) {
        // A RESIDENT invitation only attaches flats; the accountant keeps the role.
        if (invited === Role.RESIDENT) return existing;
        throw new ConflictException('invitation.error.roleConflict');
    }
    return ROLE_RANK[invited] > ROLE_RANK[existing] ? invited : existing;
}
