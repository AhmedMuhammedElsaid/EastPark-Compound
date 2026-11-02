import 'reflect-metadata';

import { Role } from '@prisma/client';
import { globSync } from 'node:fs';
import { join } from 'node:path';

import { roleSatisfies } from 'src/common/auth/utils/roles';
import { ROLES_DECORATOR_KEY } from 'src/common/request/constants/request.constant';

interface RouteRow {
    id: string;
    /** `@Controller` path, e.g. `/finance/flats`. */
    base: string;
    roles: readonly Role[] | undefined;
}

type Ctor = { name: string; prototype: Record<string, unknown> };

/** Every `@Controller` route with its effective `@AllowedRoles` (method over class). */
function collectRoutes(): RouteRow[] {
    const root = join(__dirname, '../../src');
    const files = globSync('**/*.controller.ts', { cwd: root }).sort();
    const rows: RouteRow[] = [];
    for (const file of files) {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const mod = require(join(root, file)) as Record<string, unknown>;
        for (const exported of Object.values(mod)) {
            if (typeof exported !== 'function') continue;
            const cls = exported as unknown as Ctor;
            if (Reflect.getMetadata('path', cls) === undefined) continue;
            const classRoles = Reflect.getMetadata(ROLES_DECORATOR_KEY, cls) as
                | Role[]
                | undefined;
            for (const name of Object.getOwnPropertyNames(cls.prototype)) {
                const handler = cls.prototype[name];
                if (typeof handler !== 'function') continue;
                const method = Reflect.getMetadata('method', handler);
                if (method === undefined) continue;
                const path = Reflect.getMetadata('path', handler) as string;
                const roles =
                    (Reflect.getMetadata(ROLES_DECORATOR_KEY, handler) as
                        | Role[]
                        | undefined) ?? classRoles;
                rows.push({
                    id: `${cls.name}.${name} (${String(path)})`,
                    base: String(Reflect.getMetadata('path', cls)),
                    roles,
                });
            }
        }
    }
    return rows;
}

const admits = (row: RouteRow, role: Role): boolean =>
    row.roles === undefined || row.roles.some(r => roleSatisfies(role, r));

/** The finance desk: every controller under `/finance`. */
const isFinance = (row: RouteRow): boolean =>
    row.base === '/finance' || row.base.startsWith('/finance/');

/**
 * REVIEWED differences: routes a RESIDENT may call that an ACCOUNTANT may not,
 * on purpose (8.1). A new RESIDENT route that is not on this list fails the
 * test until someone decides whether the accountant needs it.
 */
const RESIDENT_ONLY_BY_DESIGN: readonly string[] = [
    // Orders: accountants do not order as accountants.
    'OrdersController.',
    // Comments: left out in v1 (web denies /announcements, mobile locks Community).
    'AnnouncementsController.',
    // Governance: residents vote, accountants are staff.
    'PollsController.',
    'ElectionsController.',
    // Shop reviews/bookmarks and the user's own saved shops are marketplace features.
    'ReviewsController.',
    'SavedShopsController.',
    'UserSavedShopsController.',
    'PaymentsInitiateController.',
    // Flat listings are resident-and-admin only.
    'ListingsController.',
    // Public self-delete is not offered to staff accounts (ADMIN cannot either).
    'UserPublicController.',
];

const reviewed = (id: string): boolean =>
    RESIDENT_ONLY_BY_DESIGN.some(prefix => id.startsWith(prefix));

describe('role matrix over every @AllowedRoles', () => {
    const routes = collectRoutes();

    it('finds the routes (guards the collector itself)', () => {
        expect(routes.length).toBeGreaterThan(80);
    });

    it('no ADMIN route admits ACCOUNTANT (it never satisfies ADMIN)', () => {
        const leaks = routes
            .filter(r => r.roles?.includes(Role.ADMIN))
            .filter(r => admits(r, Role.ACCOUNTANT) && !r.roles?.includes(Role.ACCOUNTANT))
            .map(r => r.id);
        expect(leaks).toEqual([]);
    });

    it('ACCOUNTANT is never on an admin-only route outside /finance', () => {
        const wrong = routes
            .filter(r => r.roles?.includes(Role.ACCOUNTANT))
            .filter(
                r =>
                    !r.roles?.includes(Role.RESIDENT) &&
                    !r.roles?.includes(Role.MERCHANT)
            )
            .filter(r => !isFinance(r))
            .map(r => r.id);
        expect(wrong).toEqual([]);
    });

    it('every /finance route is exactly [ACCOUNTANT, ADMIN] (plan 3.6, 7)', () => {
        const finance = routes.filter(isFinance);
        // flats list/detail/ownership, charges create/void, audit, periods, settings
        expect(finance.length).toBeGreaterThanOrEqual(8);
        const wrong = finance
            .filter(
                r =>
                    r.roles === undefined ||
                    [...r.roles].sort().join(',') !==
                        [Role.ACCOUNTANT, Role.ADMIN].sort().join(',')
            )
            .map(r => r.id);
        expect(wrong).toEqual([]);
        for (const r of finance) {
            expect(admits(r, Role.ACCOUNTANT)).toBe(true);
            expect(admits(r, Role.ADMIN)).toBe(true);
            expect(admits(r, Role.SUPER_ADMIN)).toBe(true);
            expect(admits(r, Role.RESIDENT)).toBe(false);
            expect(admits(r, Role.MERCHANT)).toBe(false);
        }
    });

    it('ACCOUNTANT reaches no /admin route', () => {
        const leaks = routes
            .filter(r => r.base.startsWith('/admin'))
            .filter(r => r.roles !== undefined && admits(r, Role.ACCOUNTANT))
            .map(r => r.id);
        expect(leaks).toEqual([]);
    });

    it('every RESIDENT route that excludes ACCOUNTANT is reviewed', () => {
        const unreviewed = routes
            .filter(r => r.roles !== undefined)
            .filter(r => admits(r, Role.RESIDENT) && !admits(r, Role.ACCOUNTANT))
            .filter(r => !reviewed(r.id))
            .map(r => r.id);
        expect(unreviewed).toEqual([]);
    });

    it('the reviewed list has no stale entries', () => {
        const stale = RESIDENT_ONLY_BY_DESIGN.filter(
            prefix =>
                !routes.some(
                    r =>
                        r.id.startsWith(prefix) &&
                        r.roles !== undefined &&
                        admits(r, Role.RESIDENT) &&
                        !admits(r, Role.ACCOUNTANT)
                )
        );
        expect(stale).toEqual([]);
    });

    it('notification and feedback member routes admit ACCOUNTANT (8.1)', () => {
        const member = routes.filter(
            r =>
                r.id.startsWith('NotificationsController.') ||
                (r.id.startsWith('FeedbackController.') &&
                    r.roles?.includes(Role.RESIDENT))
        );
        expect(member.length).toBeGreaterThanOrEqual(8);
        for (const r of member) expect(admits(r, Role.ACCOUNTANT)).toBe(true);
    });

    it('SUPER_ADMIN still satisfies every ADMIN route', () => {
        for (const r of routes.filter(x => x.roles?.includes(Role.ADMIN)))
            expect(admits(r, Role.SUPER_ADMIN)).toBe(true);
    });
});
