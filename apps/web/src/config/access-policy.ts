/**
 * Temporary access lockdown.
 *
 * While RESIDENT_HOME_ONLY is true, signed-in RESIDENT accounts (and any other
 * non-staff role) are confined to /home, /profile and the shops directory (/directory/**) (owner
 * decisions 2026-10-03: residents manage their own profile and may browse shops; ordering stays
 * locked): navigation to any other section shows a
 * "Coming soon" popup instead of navigating, and direct requests to other app
 * routes are redirected to /home by `src/proxy.ts`. ADMIN and MERCHANT accounts are never restricted
 * (owner decision, REV-45): merchants must reach /merchant/* and /api/merchant/*
 * to run their shops. Guests are not restricted either. Set the flag to false to
 * restore full access everywhere.
 *
 * This file is dependency-free so the proxy, server code and client UI share it.
 */
export const RESIDENT_HOME_ONLY = true;

export const HOME_PATH = '/home';

export const ACCESS_COOKIE_NAME = 'eastpark_access';
export const REFRESH_COOKIE_NAME = 'eastpark_refresh';

/** Roles that keep full access during the lockdown. */
const UNRESTRICTED_ROLES = new Set(['ADMIN', 'MERCHANT']);

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

/** True when a restricted user may navigate to `href` (query string and hash are ignored). */
export function isOpenToRestricted(href: string): boolean {
  const pathname = href.split(/[?#]/, 1)[0] ?? '';
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
