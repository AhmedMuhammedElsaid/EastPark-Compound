/**
 * Temporary access lockdown.
 *
 * While RESIDENT_HOME_ONLY is true, signed-in RESIDENT accounts (and any other
 * non-staff role) are confined to /home, /profile and the shops directory (/directory/**) (owner
 * decisions 2026-10-03: residents manage their own profile and may browse shops; ordering stays
 * locked): navigation to any other section shows a
 * "Coming soon" popup instead of navigating, and direct requests to other app
 * routes are redirected to /home by `src/proxy.ts`. ADMIN, SUPER_ADMIN and MERCHANT accounts are never restricted
 * (owner decision, REV-45): merchants must reach /merchant/* and /api/merchant/*
 * to run their shops. Guests are not restricted either. ACCOUNTANT is NOT unrestricted: it gets its
 * own explicit allow-list (`FINANCE_ROLE_OPEN_PREFIXES`) and nothing else. Set the flag to false to
 * restore full access everywhere.
 *
 * This file is dependency-free so the proxy, server code and client UI share it.
 */
export const RESIDENT_HOME_ONLY = true;

export const HOME_PATH = '/home';

export const ACCESS_COOKIE_NAME = 'eastpark_access';
export const REFRESH_COOKIE_NAME = 'eastpark_refresh';

/** Roles that keep full access during the lockdown. */
const UNRESTRICTED_ROLES = new Set(['ADMIN', 'SUPER_ADMIN', 'MERCHANT']);

/** True when the signed-in role must stay on the home page. Guests, admins and merchants are not restricted. */
export function isRestrictedRole(role: string | null | undefined): boolean {
  return RESIDENT_HOME_ONLY && Boolean(role) && !UNRESTRICTED_ROLES.has(role as string);
}

/** App route prefixes a restricted user may not open directly. */
const BLOCKED_PAGE_PREFIXES = [
  '/admin',
  '/announcements',
  '/cart',
  '/checkout',
  '/feedback',
  '/finance',
  '/governance',
  '/merchant',
  '/notifications',
  '/orders',
  '/reports',
];

/**
 * BFF routes that only serve the gated sections. Auth (session, logout), uploads and `/api/profile`
 * stay open because the profile page needs them; `/api/shops/**` (list, detail, products, reviews, save)
 * stays open for the directory. Ordering (`/api/orders`, `/cart`, `/checkout`, `/orders`) stays locked.
 */
const BLOCKED_API_PREFIXES = [
  '/api/admin',
  '/api/announcements',
  '/api/feedback',
  '/api/finance',
  '/api/governance',
  '/api/merchant',
  '/api/notifications',
  '/api/orders',
  '/api/reports',
];

function matches(pathname: string, prefixes: string[]): boolean {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

/** In-app pages a restricted user may open; navigation to anything else shows Coming soon. */
const OPEN_PAGE_PREFIXES = [HOME_PATH, '/profile', '/directory'];

/**
 * ACCOUNTANT's explicit allow-list (never `OPEN_PAGE_PREFIXES`: `/finance` must stay closed to residents).
 * Pages: finance desk, home, profile, notifications. BFF: finance, the resident finance prefix
 * (`/api/me/finance`, a separate prefix from the blocked `/api/reports`/`/api/admin`), auth, profile,
 * uploads (avatar) and notifications. Everything else (directory, orders, cart, checkout, merchant,
 * admin, announcements, ...) is denied for this role.
 */
export const FINANCE_ROLE_OPEN_PREFIXES = {
  page: ['/finance', HOME_PATH, '/profile', '/notifications'],
  api: [
    '/api/finance',
    '/api/me/finance',
    '/api/auth',
    '/api/profile',
    '/api/uploads',
    '/api/notifications',
  ],
};

/** ACCOUNTANT: finance desk access, but NOT admin-like and NOT unrestricted. */
export function isAccountantRole(role: string | null | undefined): boolean {
  return role === 'ACCOUNTANT';
}

/**
 * Whether `role` may open `pathname`. Unrestricted roles and guests: always. ACCOUNTANT: only inside
 * `FINANCE_ROLE_OPEN_PREFIXES`. Other restricted roles (RESIDENT): unless the path is on the deny lists.
 */
export function isPathAllowedForRole(
  role: string | null | undefined,
  pathname: string,
  kind: 'page' | 'api',
): boolean {
  if (!isRestrictedRole(role)) return true;
  if (isAccountantRole(role)) return matches(pathname, FINANCE_ROLE_OPEN_PREFIXES[kind]);
  return !(kind === 'api' ? isBlockedApiPath(pathname) : isBlockedPagePath(pathname));
}

/**
 * True when a restricted user may navigate to `href` (query string and hash are ignored). Pass the
 * role so ACCOUNTANT is judged against its own allow-list; without it the resident list applies.
 */
export function isOpenToRestricted(href: string, role?: string | null): boolean {
  const pathname = href.split(/[?#]/, 1)[0] ?? '';
  if (isAccountantRole(role)) return matches(pathname, FINANCE_ROLE_OPEN_PREFIXES.page);
  return matches(pathname, OPEN_PAGE_PREFIXES);
}

export function isBlockedPagePath(pathname: string): boolean {
  return matches(pathname, BLOCKED_PAGE_PREFIXES);
}

export function isBlockedApiPath(pathname: string): boolean {
  return matches(pathname, BLOCKED_API_PREFIXES);
}

/**
 * Reads the role claim from a JWT without verifying it. Only for routing
 * decisions; the backend remains the authority on every data request.
 */
export function roleFromToken(token: string | undefined): string | null {
  if (!token) return null;
  const part = token.split('.')[1];
  if (!part) return null;
  try {
    const base64 = part.replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='));
    const role = (JSON.parse(json) as { role?: unknown }).role;
    return typeof role === 'string' ? role : null;
  } catch {
    return null;
  }
}
