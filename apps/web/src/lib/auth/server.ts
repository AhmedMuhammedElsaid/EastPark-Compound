import 'server-only';

import type { AuthTokens, AuthUser } from '@/lib/api/contracts';

import { createHash } from 'node:crypto';
import { isIP } from 'node:net';
import { cookies, headers } from 'next/headers';

import { authTokensEnvelopeSchema, authUserEnvelopeSchema } from '@/lib/api/auth-schemas';

/**
 * The single BFF -> backend client.
 *
 * - `backendFetch` is the transport: base URL, `/v1` prefix, no-store, timeout, and the browser's
 *   client IP as `X-Forwarded-For` so backend rate limiting is per user, not per Vercel instance.
 * - `sessionFetch` / `authenticatedBackendFetch` / `getProfile` add the session cookies.
 *   `mutateCookies` is explicit: route handlers pass `true` (refresh rotates and stores tokens);
 *   Server Components pass `false` and receive `refresh-required` instead, because Next forbids
 *   cookie writes during render. Those pages redirect through `/api/auth/refresh` (see
 *   `sessionRefreshPath`).
 */

const ACCESS_COOKIE = 'eastpark_access';
const REFRESH_COOKIE = 'eastpark_refresh';
const ACCESS_MAX_AGE = 15 * 60;
const REFRESH_MAX_AGE = 7 * 24 * 60 * 60;
const API_TIMEOUT_MS = 25_000;
const WAKE_TIMEOUT_MS = 8_000;
const WAKE_INTERVAL_MS = 60_000;
const REFRESH_SHARE_MS = 10_000;

export type BackendContext = {
  /** Browser IP forwarded as `X-Forwarded-For`; `null`/absent sends no header. */
  clientIp?: string | null;
};

export type SessionOptions = {
  /** `true` only in route handlers. Server Components must pass `false`. */
  mutateCookies: boolean;
  /** Defaults to the IP read from the incoming request headers. */
  clientIp?: string | null;
};

export type SessionFetchResult =
  | { status: 'ok'; response: Response; accessToken: string }
  | { status: 'unauthenticated' }
  | { status: 'refresh-required' };

export type ProfileResult =
  | { status: 'authenticated'; user: AuthUser; accessToken: string }
  | { status: 'unauthenticated' | 'refresh-required' | 'unavailable' };

export class BackendContractError extends Error {
  constructor(readonly endpoint: string) {
    super(`Backend response for ${endpoint} did not match the expected contract`);
    this.name = 'BackendContractError';
  }
}

export class BackendUnavailableError extends Error {
  constructor(readonly status: number) {
    super(`Backend responded with ${status}`);
    this.name = 'BackendUnavailableError';
  }
}

/** Thrown by RSC loaders when only the refresh cookie can restore the session. */
export class SessionRefreshRequiredError extends Error {
  constructor() {
    super('Session refresh required');
    this.name = 'SessionRefreshRequiredError';
  }
}

function apiBase(): string {
  const value = process.env.NEXT_PUBLIC_API_URL;
  if (!value) throw new Error('NEXT_PUBLIC_API_URL is not configured');
  return value.replace(/\/+$/, '');
}

/** First valid IP from `x-forwarded-for`, else `x-real-ip` (both set by Vercel's edge). */
export function clientIpFrom(source: Headers | null | undefined): string | null {
  if (!source) return null;
  const forwarded = source.get('x-forwarded-for')?.split(',')[0]?.trim();
  if (forwarded && isIP(forwarded)) return forwarded;
  const real = source.get('x-real-ip')?.trim();
  return real && isIP(real) ? real : null;
}

/**
 * Reads the client IP from the current request. Only call it from request-bound code (route
 * handlers or cookie-reading render paths); public loaders receive the IP explicitly so static
 * pages are not forced into dynamic rendering.
 */
export async function requestClientIp(): Promise<string | null> {
  try {
    return clientIpFrom(await headers());
  } catch {
    return null;
  }
}

export async function backendFetch(
  path: string,
  init: RequestInit = {},
  context: BackendContext = {},
): Promise<Response> {
  const requestHeaders = new Headers(init.headers);
  if (context.clientIp) requestHeaders.set('X-Forwarded-For', context.clientIp);
  return fetch(`${apiBase()}/v1${path}`, {
    ...init,
    headers: requestHeaders,
    cache: 'no-store',
    signal: init.signal ?? AbortSignal.timeout(API_TIMEOUT_MS),
  });
}

let lastWakeAt = Number.NEGATIVE_INFINITY;

/**
 * Best-effort Render cold-start wake-up, throttled to one `/health` ping per minute per instance so
 * anonymous GETs cannot amplify into backend traffic. Returns whether a ping was sent.
 */
export async function wakeBackend(now: number = Date.now()): Promise<boolean> {
  if (now - lastWakeAt < WAKE_INTERVAL_MS) return false;
  lastWakeAt = now;
  try {
    await fetch(`${apiBase()}/health`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(WAKE_TIMEOUT_MS),
    });
  } catch {
    // The real request reports its own result.
  }
  return true;
}

export function bearer(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

export async function authCookies(): Promise<{ accessToken?: string; refreshToken?: string }> {
  const store = await cookies();
  return {
    accessToken: store.get(ACCESS_COOKIE)?.value || undefined,
    refreshToken: store.get(REFRESH_COOKIE)?.value || undefined,
  };
}

/** Route handlers only. */
export async function setAuthCookies(tokens: AuthTokens): Promise<void> {
  const store = await cookies();
  const shared = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    path: '/',
  };
  store.set(ACCESS_COOKIE, tokens.accessToken, { ...shared, maxAge: ACCESS_MAX_AGE });
  store.set(REFRESH_COOKIE, tokens.refreshToken, { ...shared, maxAge: REFRESH_MAX_AGE });
}

/** Route handlers only. */
export async function clearAuthCookies(): Promise<void> {
  const store = await cookies();
  store.delete(ACCESS_COOKIE);
  store.delete(REFRESH_COOKIE);
}

export type RefreshOutcome = { status: 'refreshed'; tokens: AuthTokens } | { status: 'rejected' };

// The backend blacklists a refresh token on use. Parallel requests that arrive with the same expired
// session must share one rotation, otherwise the second refresh is rejected and logs the user out.
const refreshesInFlight = new Map<string, { promise: Promise<RefreshOutcome>; expiresAt: number }>();

/**
 * Exchanges a refresh token for a new pair. Pure: never touches cookies. Rejection by the backend
 * resolves to `rejected`; transport failures and 5xx throw so callers do not log users out on an
 * outage.
 */
export function refreshTokens(refreshToken: string, context: BackendContext = {}): Promise<RefreshOutcome> {
  const now = Date.now();
  for (const [key, entry] of refreshesInFlight) {
    if (entry.expiresAt <= now) refreshesInFlight.delete(key);
  }

  const key = createHash('sha256').update(refreshToken).digest('hex');
  const shared = refreshesInFlight.get(key);
  if (shared) return shared.promise;

  const promise = requestRefresh(refreshToken, context);
  refreshesInFlight.set(key, { promise, expiresAt: now + REFRESH_SHARE_MS });
  promise.catch(() => refreshesInFlight.delete(key));
  return promise;
}

async function requestRefresh(refreshToken: string, context: BackendContext): Promise<RefreshOutcome> {
  // The backend treats the Bearer header as the authoritative refresh token; the body is optional.
  const response = await backendFetch(
    '/auth/refresh',
    {
      method: 'POST',
      headers: { ...bearer(refreshToken), 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    },
    context,
  );
  if (response.status === 400 || response.status === 401 || response.status === 403) {
    return { status: 'rejected' };
  }
  if (!response.ok) throw new BackendUnavailableError(response.status);

  const parsed = authTokensEnvelopeSchema.safeParse(await response.json().catch(() => null));
  if (!parsed.success) throw new BackendContractError('/auth/refresh');
  return { status: 'refreshed', tokens: parsed.data.data };
}

/** Refreshes and persists the session (route handlers). Returns the new access token or `null`. */
async function refreshAndStore(refreshToken: string, context: BackendContext): Promise<string | null> {
  const outcome = await refreshTokens(refreshToken, context);
  if (outcome.status === 'rejected') {
    // Refresh tokens are single-use. A rejection is often a race: another request (or tab) already
    // rotated this token and the browser holds the new pair. If this request has meanwhile stored a
    // newer pair, use it; otherwise report "signed out" for this request only and never delete the
    // cookies, because that Set-Cookie would wipe the newer pair the other response just set.
    const current = await authCookies();
    if (current.refreshToken && current.refreshToken !== refreshToken && current.accessToken) {
      return current.accessToken;
    }
    return null;
  }
  await setAuthCookies(outcome.tokens);
  return outcome.tokens.accessToken;
}

function withBearer(init: RequestInit, accessToken: string): RequestInit {
  const merged = new Headers(init.headers);
  merged.set('Authorization', `Bearer ${accessToken}`);
  return { ...init, headers: merged };
}

/**
 * Sends an authenticated backend request with the session cookies.
 *
 * - `mutateCookies: true` (route handlers): a missing/expired access token is refreshed once
 *   (single-flight per refresh token) and cookies are rotated. A rejected refresh is reported as
 *   unauthenticated without deleting cookies (it may be a lost rotation race).
 * - `mutateCookies: false` (Server Components): cookies are never written. A session that needs a
 *   refresh yields `refresh-required` without contacting the backend when the access cookie is
 *   simply absent (the normal state 15 minutes after login).
 */
export async function sessionFetch(
  path: string,
  init: RequestInit,
  options: SessionOptions,
): Promise<SessionFetchResult> {
  const tokens = await authCookies();
  if (!tokens.accessToken && !tokens.refreshToken) return { status: 'unauthenticated' };
  if (!tokens.accessToken && !options.mutateCookies) return { status: 'refresh-required' };

  const context: BackendContext = {
    clientIp: options.clientIp !== undefined ? options.clientIp : await requestClientIp(),
  };
  const send = (token: string) => backendFetch(path, withBearer(init, token), context);

  if (tokens.accessToken) {
    const response = await send(tokens.accessToken);
    if (response.status !== 401) return { status: 'ok', response, accessToken: tokens.accessToken };
    if (!tokens.refreshToken) {
      if (options.mutateCookies) await clearAuthCookies();
      return { status: 'unauthenticated' };
    }
    if (!options.mutateCookies) return { status: 'refresh-required' };
  }

  const accessToken = await refreshAndStore(tokens.refreshToken!, context);
  if (!accessToken) return { status: 'unauthenticated' };

  const response = await send(accessToken);
  if (response.status === 401) {
    await clearAuthCookies();
    return { status: 'unauthenticated' };
  }
  return { status: 'ok', response, accessToken };
}

/**
 * Convenience wrapper: the backend response, `null` when there is no usable session, or
 * `SessionRefreshRequiredError` (read-only mode only).
 */
export async function authenticatedBackendFetch(
  path: string,
  init: RequestInit,
  options: SessionOptions,
): Promise<Response | null> {
  const result = await sessionFetch(path, init, options);
  if (result.status === 'ok') return result.response;
  if (result.status === 'refresh-required') throw new SessionRefreshRequiredError();
  return null;
}

/** The one profile lookup used by session, admin, merchant and governance checks. */
export async function getProfile(options: SessionOptions): Promise<ProfileResult> {
  try {
    const result = await sessionFetch('/user/profile', {}, options);
    if (result.status !== 'ok') return { status: result.status };

    const { response } = result;
    if (response.status === 403 || response.status === 404) {
      if (options.mutateCookies) await clearAuthCookies();
      return { status: 'unauthenticated' };
    }
    if (!response.ok) return { status: 'unavailable' };

    const parsed = authUserEnvelopeSchema.safeParse(await response.json().catch(() => null));
    if (!parsed.success) {
      console.error('Profile response contract mismatch');
      return { status: 'unavailable' };
    }
    return { status: 'authenticated', user: parsed.data.data, accessToken: result.accessToken };
  } catch {
    return { status: 'unavailable' };
  }
}
