import type { ApiEnvelope, AuthUser } from '@/lib/api/contracts';

import { NextResponse } from 'next/server';

import {
  authCookies,
  backendFetch,
  bearer,
  clearAuthCookies,
  refreshAuthTokens,
} from '@/lib/auth/server';

async function profile(accessToken: string): Promise<AuthUser | null> {
  const response = await backendFetch('/user/profile', {
    headers: bearer(accessToken),
  });
  if (!response.ok) return null;
  const payload = (await response.json()) as ApiEnvelope<AuthUser>;
  return payload.data;
}

export async function GET() {
  const tokens = await authCookies();
  if (!tokens.accessToken && !tokens.refreshToken) {
    return NextResponse.json({ data: { user: null } });
  }

  try {
    if (tokens.accessToken) {
      const user = await profile(tokens.accessToken);
      if (user) return NextResponse.json({ data: { user } });
    }

    if (tokens.refreshToken) {
      const refreshed = await refreshAuthTokens(tokens.refreshToken);
      if (refreshed) {
        const user = await profile(refreshed.accessToken);
        if (user) return NextResponse.json({ data: { user } });
      }
    }
  } catch {
    return NextResponse.json({ error: 'network' }, { status: 503 });
  }

  await clearAuthCookies();
  return NextResponse.json({ data: { user: null } });
}
