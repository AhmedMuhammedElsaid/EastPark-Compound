/**
 * Shared, isomorphic validation for post-login / post-refresh return paths.
 *
 * Every `?next=` value is untrusted input. A value is only honoured when it parses as a same-origin
 * path; anything else (absolute URLs, protocol-relative `//host`, backslash tricks such as
 * `/\evil.com`, control characters the URL parser would silently strip, `javascript:` URLs, or BFF
 * `/api/*` routes) falls back to a known in-app path.
 */

import { isAdminRole } from './roles';

const PLACEHOLDER_ORIGIN = 'https://eastpark.invalid';
const MAX_RETURN_PATH_LENGTH = 2048;
// Backslashes are treated as `/` by the WHATWG URL parser; tab/CR/LF (and other C0 controls) are
// removed before parsing, so `/\t/evil.com` would otherwise become `//evil.com`.
const UNSAFE_CHARACTERS = /[\\\u0000-\u001F\u007F]/;

export const DEFAULT_RETURN_PATH = '/home';

export function safeReturnPath(
  raw: string | null | undefined,
  fallback: string = DEFAULT_RETURN_PATH,
): string {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > MAX_RETURN_PATH_LENGTH) return fallback;
  if (!raw.startsWith('/') || raw.startsWith('//')) return fallback;
  if (UNSAFE_CHARACTERS.test(raw)) return fallback;

  let url: URL;
  try {
    url = new URL(raw, PLACEHOLDER_ORIGIN);
  } catch {
    return fallback;
  }
  if (url.origin !== PLACEHOLDER_ORIGIN) return fallback;

  const path = `${url.pathname}${url.search}${url.hash}`;
  // Dot-segment normalisation can still produce a protocol-relative path (`/.//evil.com`).
  if (!path.startsWith('/') || path.startsWith('//')) return fallback;
  if (path === '/api' || path.startsWith('/api/')) return fallback;
  return path;
}

/** `/login?next=<safe path>` for redirecting an unauthenticated visitor. */
export function loginPath(next?: string | null): string {
  if (!next) return '/login';
  return `/login?next=${encodeURIComponent(safeReturnPath(next))}`;
}

/**
 * Route handler that refreshes the session cookies and bounces back to `next`. Server Components
 * cannot write cookies, so they redirect here when only the refresh token is still valid.
 * `optional` pages (public pages that merely personalise for a session) return to `next` as a guest
 * when the refresh is rejected instead of being sent to login.
 */
export function sessionRefreshPath(next: string, options: { optional?: boolean } = {}): string {
  const params = new URLSearchParams({ next: safeReturnPath(next) });
  if (options.optional) params.set('optional', '1');
  return `/api/auth/refresh?${params.toString()}`;
}

/**
 * Where a signed-in user goes from `/login`: the safe `next` path, else the role's home. Shared by
 * the post-submit redirect and the "already signed in" redirect so both agree. `next` pointing back
 * at an auth page would loop, so it falls back to the role default.
 */
export function postLoginPath(role: string | null | undefined, next: string | null | undefined): string {
  const fallback = isAdminRole(role) ? '/admin' : DEFAULT_RETURN_PATH;
  const path = safeReturnPath(next, fallback);
  return /^\/login(?:[/?#]|$)/.test(path) ? fallback : path;
}
