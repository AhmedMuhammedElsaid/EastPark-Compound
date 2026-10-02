import type { AuthUser } from '@/lib/api/contracts';

import { NextResponse } from 'next/server';

import { getProfile } from '@/lib/auth/server';

type MerchantAuthResult =
  | { token: string; user: AuthUser }
  | { response: NextResponse<{ error: string }> };

export type MerchantSession =
  | { status: 'authenticated'; token: string; user: AuthUser }
  | { status: 'unauthenticated' | 'refresh-required' | 'forbidden' | 'unavailable' };

/**
 * `allowRefresh` must be `true` only in route handlers. The merchant layout (a Server Component)
 * uses the default and redirects through `/api/auth/refresh` on `refresh-required`.
 */
export async function getMerchantSession(allowRefresh = false): Promise<MerchantSession> {
  const profile = await getProfile({ mutateCookies: allowRefresh });
  if (profile.status !== 'authenticated') return { status: profile.status };
  if (profile.user.role !== 'MERCHANT') return { status: 'forbidden' };
  return { status: 'authenticated', token: profile.accessToken, user: profile.user };
}

export async function requireMerchant(): Promise<MerchantAuthResult> {
  const session = await getMerchantSession(true);
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
