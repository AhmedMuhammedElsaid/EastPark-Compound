import type { ApiEnvelope, AuthUser } from '@/lib/api/contracts';

import { NextResponse } from 'next/server';

import { authCookies, backendFetch, bearer, refreshAuthTokens } from '@/lib/auth/server';

type AdminAuthResult =
  | { token: string; user: AuthUser }
  | { response: NextResponse<{ error: string }> };

export type AdminSession =
  | { status: 'authenticated'; token: string; user: AuthUser }
  | { status: 'unauthenticated' | 'refresh-required' | 'forbidden' | 'unavailable' };

async function profile(token: string): Promise<AuthUser | null> {
  const response = await backendFetch('/user/profile', { headers: bearer(token) });
  if (!response.ok) return null;
  const payload = (await response.json()) as ApiEnvelope<AuthUser>;
  return payload.data;
}

export async function getAdminSession(allowRefresh = false): Promise<AdminSession> {
  try {
    const tokens = await authCookies();
    let token = tokens.accessToken;
    let user = token ? await profile(token) : null;

    if (!user && tokens.refreshToken && allowRefresh) {
      const refreshed = await refreshAuthTokens(tokens.refreshToken);
      token = refreshed?.accessToken;
      user = token ? await profile(token) : null;
    }

    if (!user && tokens.refreshToken && !allowRefresh) return { status: 'refresh-required' };
    if (!token || !user) return { status: 'unauthenticated' };
    if (user.role !== 'ADMIN') return { status: 'forbidden' };
    return { status: 'authenticated', token, user };
  } catch {
    return { status: 'unavailable' };
  }
}

export async function requireAdmin(): Promise<AdminAuthResult> {
  const session = await getAdminSession(true);
  if (session.status === 'authenticated') return session;
  if (session.status === 'forbidden') {
    return { response: NextResponse.json({ error: 'forbidden' }, { status: 403 }) };
  }
  return {
    response: NextResponse.json(
      { error: session.status === 'unavailable' ? 'network' : 'unauthorized' },
      { status: session.status === 'unavailable' ? 503 : 401 },
    ),
  };
}

export async function forwardAdminWrite(path: string, body: unknown): Promise<NextResponse> {
  try {
    const auth = await requireAdmin();
    if ('response' in auth) return auth.response;

    const response = await backendFetch(path, {
      method: 'POST',
      headers: { ...bearer(auth.token), 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const payload = await response.json().catch(() => ({ error: 'upstream' }));
    return NextResponse.json(payload, { status: response.status });
  } catch {
    return NextResponse.json({ error: 'network' }, { status: 503 });
  }
}