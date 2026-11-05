import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';

import {
    isAdminRole,
    isFinanceRole,
    isSuperAdmin,
    resolveInvitedRole,
    roleSatisfies,
} from 'src/common/auth/utils/roles';
import { RolesGuard } from 'src/common/request/guards/roles.guard';

function contextFor(role: Role | undefined): ExecutionContext {
    return {
        getHandler: () => undefined,
        getClass: () => undefined,
        switchToHttp: () => ({
            getRequest: () => ({
                user: role ? { userId: 'u1', role } : undefined,
            }),
        }),
    } as unknown as ExecutionContext;
}

function guardAllowing(roles: Role[] | undefined): RolesGuard {
    const reflector = {
        getAllAndOverride: jest.fn().mockReturnValue(roles),
    } as unknown as Reflector;
    return new RolesGuard(reflector);
}

describe('RolesGuard role hierarchy', () => {
    it('lets SUPER_ADMIN through ADMIN routes', () => {
        expect(
            guardAllowing([Role.ADMIN]).canActivate(
                contextFor(Role.SUPER_ADMIN)
            )
        ).toBe(true);
        expect(
            guardAllowing([Role.MERCHANT, Role.ADMIN]).canActivate(
                contextFor(Role.SUPER_ADMIN)
            )
        ).toBe(true);
    });

    it('keeps SUPER_ADMIN out of RESIDENT-only and MERCHANT-only routes', () => {
        expect(() =>
            guardAllowing([Role.RESIDENT]).canActivate(
                contextFor(Role.SUPER_ADMIN)
            )
        ).toThrow(ForbiddenException);
        expect(() =>
            guardAllowing([Role.MERCHANT]).canActivate(
                contextFor(Role.SUPER_ADMIN)
            )
        ).toThrow(ForbiddenException);
    });

    it('keeps ADMIN out of SUPER_ADMIN-only routes', () => {
        expect(() =>
            guardAllowing([Role.SUPER_ADMIN]).canActivate(
                contextFor(Role.ADMIN)
            )
        ).toThrow(ForbiddenException);
        expect(
            guardAllowing([Role.SUPER_ADMIN]).canActivate(
                contextFor(Role.SUPER_ADMIN)
            )
        ).toBe(true);
    });

    it('still matches exact roles and allows unannotated routes', () => {
        expect(
            guardAllowing([Role.ADMIN]).canActivate(contextFor(Role.ADMIN))
        ).toBe(true);
        expect(() =>
            guardAllowing([Role.ADMIN]).canActivate(contextFor(Role.RESIDENT))
        ).toThrow(ForbiddenException);
        expect(guardAllowing(undefined).canActivate(contextFor(undefined))).toBe(
            true
        );
    });

    it('rejects a request without a role', () => {
        expect(() =>
            guardAllowing([Role.ADMIN]).canActivate(contextFor(undefined))
        ).toThrow(ForbiddenException);
    });
});

describe('role helpers', () => {
    it('treats ADMIN and SUPER_ADMIN as admin-like', () => {
        expect(isAdminRole(Role.ADMIN)).toBe(true);
        expect(isAdminRole(Role.SUPER_ADMIN)).toBe(true);
        expect(isAdminRole(Role.MERCHANT)).toBe(false);
        expect(isAdminRole(Role.RESIDENT)).toBe(false);
        expect(isAdminRole(undefined)).toBe(false);
    });

    it('identifies only SUPER_ADMIN as super admin', () => {
        expect(isSuperAdmin(Role.SUPER_ADMIN)).toBe(true);
        expect(isSuperAdmin(Role.ADMIN)).toBe(false);
    });

    it('SUPER_ADMIN satisfies ADMIN but not the reverse', () => {
        expect(roleSatisfies(Role.SUPER_ADMIN, Role.ADMIN)).toBe(true);
        expect(roleSatisfies(Role.ADMIN, Role.SUPER_ADMIN)).toBe(false);
        expect(roleSatisfies(Role.SUPER_ADMIN, Role.RESIDENT)).toBe(false);
    });
});

describe('ACCOUNTANT role', () => {
    it('is a finance role but never admin-like', () => {
        expect(isFinanceRole(Role.ACCOUNTANT)).toBe(true);
        expect(isFinanceRole(Role.ADMIN)).toBe(true);
        expect(isFinanceRole(Role.SUPER_ADMIN)).toBe(true);
        expect(isFinanceRole(Role.RESIDENT)).toBe(false);
        expect(isFinanceRole(Role.MERCHANT)).toBe(false);
        expect(isFinanceRole(undefined)).toBe(false);
        expect(isAdminRole(Role.ACCOUNTANT)).toBe(false);
    });

    it('ACCOUNTANT satisfies only ACCOUNTANT', () => {
        expect(roleSatisfies(Role.ACCOUNTANT, Role.ADMIN)).toBe(false);
        expect(roleSatisfies(Role.ACCOUNTANT, Role.RESIDENT)).toBe(false);
        expect(roleSatisfies(Role.ACCOUNTANT, Role.ACCOUNTANT)).toBe(true);
        expect(roleSatisfies(Role.SUPER_ADMIN, Role.ACCOUNTANT)).toBe(false);
        expect(roleSatisfies(Role.ADMIN, Role.ACCOUNTANT)).toBe(false);
    });

    it('is rejected by an ADMIN-only route', () => {
        expect(() =>
            guardAllowing([Role.ADMIN]).canActivate(contextFor(Role.ACCOUNTANT))
        ).toThrow(ForbiddenException);
        expect(
            guardAllowing([Role.ACCOUNTANT, Role.ADMIN]).canActivate(
                contextFor(Role.ACCOUNTANT)
            )
        ).toBe(true);
        expect(
            guardAllowing([Role.ACCOUNTANT, Role.ADMIN]).canActivate(
                contextFor(Role.SUPER_ADMIN)
            )
        ).toBe(true);
    });
});

describe('resolveInvitedRole', () => {
    const R = Role;
    const cases: [Role, Role, Role | 'conflict'][] = [
        // invited, existing, result
        [R.ACCOUNTANT, R.RESIDENT, R.ACCOUNTANT],
        [R.ACCOUNTANT, R.ACCOUNTANT, R.ACCOUNTANT],
        [R.ACCOUNTANT, R.MERCHANT, 'conflict'],
        [R.ACCOUNTANT, R.ADMIN, 'conflict'],
        [R.ACCOUNTANT, R.SUPER_ADMIN, 'conflict'],
        [R.MERCHANT, R.ACCOUNTANT, 'conflict'],
        [R.ADMIN, R.ACCOUNTANT, 'conflict'],
        [R.RESIDENT, R.ACCOUNTANT, R.ACCOUNTANT],
        // unchanged upgrade-only behaviour
        [R.MERCHANT, R.RESIDENT, R.MERCHANT],
        [R.ADMIN, R.MERCHANT, R.ADMIN],
        [R.RESIDENT, R.MERCHANT, R.MERCHANT],
        [R.MERCHANT, R.ADMIN, R.ADMIN],
        [R.ADMIN, R.SUPER_ADMIN, R.SUPER_ADMIN],
    ];
    it.each(cases)('%s invitation to an existing %s -> %s', (invited, existing, want) => {
        if (want === 'conflict') {
            expect(() => resolveInvitedRole(invited, existing)).toThrow(
                'invitation.error.roleConflict'
            );
        } else {
            expect(resolveInvitedRole(invited, existing)).toBe(want);
        }
    });
});
