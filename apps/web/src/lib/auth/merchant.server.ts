import type { ApiEnvelope, AuthUser } from '@/lib/api/contracts';

import { NextResponse } from 'next/server';

import { authCookies, backendFetch, bearer, refreshAuthTokens } from '@/lib/auth/server';

type MerchantAuthResult =
  | { token: string; user: AuthUser }
  | { response: NextResponse<{ error: string }> };

export type MerchantSession =
  | { status: 'authenticated'; token: string; user: AuthUser }
  | { status: 'unauthenticated' | 'forbidden' | 'unavailable' };

async function profile(token: string): Promise<AuthUser | null> {
  const response = await backendFetch('/user/profile', { headers: bearer(token) });
  if (!response.ok) return null;
  const payload = (await response.json()) as ApiEnvelope<AuthUser>;
  return payload.data;
}

export async function getMerchantSession(): Promise<MerchantSession> {
  try {
    const tokens = await authCookies();
    let token = tokens.accessToken;
    let user = token ? await profile(token) : null;

    if (!user && tokens.refreshToken) {
      const refreshed = await refreshAuthTokens(tokens.refreshToken);
      token = refreshed?.accessToken;
      user = token ? await profile(token) : null;
    }

    if (!token || !user) return { status: 'unauthenticated' };
    if (user.role !== 'MERCHANT') return { status: 'forbidden' };
    return { status: 'authenticated', token, user };
  } catch {
    return { status: 'unavailable' };
  }
}

export async function requireMerchant(): Promise<MerchantAuthResult> {
  const session = await getMerchantSession();
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