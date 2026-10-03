import type { AuthUser } from '@/lib/api/contracts';

import { NextResponse } from 'next/server';

import { relayBackendResponse } from '@/lib/api/bff-errors';
import { backendFetch, bearer, getProfile, requestClientIp } from '@/lib/auth/server';

type AdminAuthResult =
  | { token: string; user: AuthUser }
  | { response: NextResponse<{ error: string }> };

export type AdminSession =
  | { status: 'authenticated'; token: string; user: AuthUser }
  | { status: 'unauthenticated' | 'refresh-required' | 'forbidden' | 'unavailable' | 'rate_limited' };

/**
 * `allowRefresh` must be `true` only in route handlers. Server Components (the admin layout) pass
 * `false` and redirect through `/api/auth/refresh` on `refresh-required`.
 */
export async function getAdminSession(allowRefresh = false): Promise<AdminSession> {
  const profile = await getProfile({ mutateCookies: allowRefresh });
  if (profile.status !== 'authenticated') return { status: profile.status };
  if (profile.user.role !== 'ADMIN') return { status: 'forbidden' };
  return { status: 'authenticated', token: profile.accessToken, user: profile.user };
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

export async function forwardAdminRequest(path: string, init: RequestInit = {}): Promise<NextResponse> {
  try {
    const auth = await requireAdmin();
    if ('response' in auth) return auth.response;

    const response = await backendFetch(
      path,
      { ...init, headers: { ...init.headers, ...bearer(auth.token) } },
      { clientIp: await requestClientIp() },
    );
    return relayBackendResponse(response);
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
