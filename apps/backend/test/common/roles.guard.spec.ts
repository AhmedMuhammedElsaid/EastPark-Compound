import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';

import {
    isAdminRole,
    isSuperAdmin,
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
