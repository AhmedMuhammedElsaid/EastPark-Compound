import type { AuthUser } from '@/lib/api/contracts';

import { NextResponse } from 'next/server';

import { PRIVATE_NO_STORE, relayBackendResponse } from '@/lib/api/bff-errors';
import { isAdminRole, isSuperAdminRole } from '@/lib/auth/roles';
import { backendFetch, bearer, getProfile, requestClientIp } from '@/lib/auth/server';

type AdminAuthResult =
  | { token: string; user: AuthUser; isSuperAdmin: boolean }
  | { response: NextResponse<{ error: string }> };

export type AdminSession =
  | { status: 'authenticated'; token: string; user: AuthUser; isSuperAdmin: boolean }
  | { status: 'unauthenticated' | 'refresh-required' | 'forbidden' | 'unavailable' | 'rate_limited' };

/**
 * `allowRefresh` must be `true` only in route handlers. Server Components (the admin layout) pass
 * `false` and redirect through `/api/auth/refresh` on `refresh-required`.
 *
 * Admin-like = ADMIN or SUPER_ADMIN. The backend stays the authority on every request.
 */
export async function getAdminSession(allowRefresh = false): Promise<AdminSession> {
  const profile = await getProfile({ mutateCookies: allowRefresh });
  if (profile.status !== 'authenticated') return { status: profile.status };
  if (!isAdminRole(profile.user.role)) return { status: 'forbidden' };
  return {
    status: 'authenticated',
    token: profile.accessToken,
    user: profile.user,
    isSuperAdmin: isSuperAdminRole(profile.user.role),
  };
}

export async function requireAdmin(): Promise<AdminAuthResult> {
  const session = await getAdminSession(true);
  if (session.status === 'authenticated') return session;
  if (session.status === 'forbidden') {
    return { response: NextResponse.json({ error: 'forbidden' }, { status: 403 }) };
  }
  if (session.status === 'rate_limited') {
    return { response: NextResponse.json({ error: 'rate_limited' }, { status: 429 }) };
  }
  return {
    response: NextResponse.json(
      { error: session.status === 'unavailable' ? 'network' : 'unauthorized' },
      { status: session.status === 'unavailable' ? 503 : 401 },
    ),
  };
}

/** Like `requireAdmin`, but a plain ADMIN gets 403 `super_admin_required` (distinct from a backend 403). */
export async function requireSuperAdmin(): Promise<AdminAuthResult> {
  const auth = await requireAdmin();
  if ('response' in auth) return auth;
  if (!auth.isSuperAdmin) {
    return {
      response: NextResponse.json({ error: 'super_admin_required' }, { status: 403, headers: PRIVATE_NO_STORE }),
    };
  }
  return auth;
}

/**
 * Backend failure statuses a route turns into its own explicit error code. The backend translates
 * its message keys into prose, so routes map by endpoint + status instead of parsing messages.
 */
export type UpstreamErrorCodes = Partial<Record<number, string>>;

async function forwardWith(
  auth: AdminAuthResult,
  path: string,
  init: RequestInit,
  errorCodes: UpstreamErrorCodes = {},
): Promise<NextResponse> {
  if ('response' in auth) return auth.response;
  const response = await backendFetch(
    path,
    { ...init, headers: { ...init.headers, ...bearer(auth.token) } },
    { clientIp: await requestClientIp() },
  );
  const code = response.ok ? undefined : errorCodes[response.status];
  if (code) return NextResponse.json({ error: code }, { status: response.status, headers: PRIVATE_NO_STORE });
  return relayBackendResponse(response);
}

export async function forwardAdminRequest(path: string, init: RequestInit = {}): Promise<NextResponse> {
  try {
    return await forwardWith(await requireAdmin(), path, init);
  } catch {
    return NextResponse.json({ error: 'network' }, { status: 503 });
  }
}

/** Forwards a SUPER_ADMIN-only request; the backend re-checks the role. */
export async function forwardSuperAdminRequest(
  path: string,
  init: RequestInit = {},
  errorCodes: UpstreamErrorCodes = {},
): Promise<NextResponse> {
  try {
    return await forwardWith(await requireSuperAdmin(), path, init, errorCodes);
  } catch {
    return NextResponse.json({ error: 'network' }, { status: 503 });
  }
}

export function forwardAdminWrite(path: string, body: unknown): Promise<NextResponse> {
  return forwardAdminRequest(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}
