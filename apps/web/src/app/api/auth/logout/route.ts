import { NextResponse } from 'next/server';

import {
  authCookies,
  backendFetch,
  bearer,
  clearAuthCookies,
  refreshAuthTokens,
} from '@/lib/auth/server';

export async function POST() {
  const current = await authCookies();

  try {
    let accessToken = current.accessToken;
    let refreshToken = current.refreshToken;

    if (!accessToken && refreshToken) {
      const refreshed = await refreshAuthTokens(refreshToken);
      accessToken = refreshed?.accessToken;
      refreshToken = refreshed?.refreshToken ?? refreshToken;
    }

    if (accessToken && refreshToken) {
      await backendFetch('/auth/logout', {
        method: 'POST',
        headers: { ...bearer(accessToken), 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
    }
  } catch {
    // Local logout must succeed even if the API is temporarily unavailable.
  } finally {
    await clearAuthCookies();
  }

  return NextResponse.json({ data: { success: true } });
}
