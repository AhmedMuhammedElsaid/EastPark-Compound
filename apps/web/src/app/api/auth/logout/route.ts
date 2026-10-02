import { NextResponse } from 'next/server';

import {
  authCookies,
  backendFetch,
  bearer,
  clearAuthCookies,
  clientIpFrom,
  refreshTokens,
} from '@/lib/auth/server';

export const maxDuration = 30;

export async function POST(request: Request) {
  const current = await authCookies();
  const context = { clientIp: clientIpFrom(request.headers) };

  try {
    let accessToken = current.accessToken;
    let refreshToken = current.refreshToken;

    // Backend contract: `Authorization: Bearer <access>` plus `{ refreshToken }` to revoke. With
    // only a refresh cookie left, rotate once (single-flight) and revoke the new refresh token.
    if (!accessToken && refreshToken) {
      const outcome = await refreshTokens(refreshToken, context);
      accessToken = outcome.status === 'refreshed' ? outcome.tokens.accessToken : undefined;
      refreshToken = outcome.status === 'refreshed' ? outcome.tokens.refreshToken : undefined;
    }

    if (accessToken && refreshToken) {
      await backendFetch(
        '/auth/logout',
        {
          method: 'POST',
          headers: { ...bearer(accessToken), 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        },
        context,
      );
    }
  } catch {
    // Local logout must succeed even if the API is temporarily unavailable.
  } finally {
    await clearAuthCookies();
  }

  return NextResponse.json({ data: { success: true } });
}
