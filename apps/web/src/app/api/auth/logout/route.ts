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

/**
 * Revocation is best effort and must never hold the response hostage: the browser aborts its
 * logout request after 10s, and an aborted response loses the Set-Cookie headers that clear the
 * session (the user would bounce from /login straight back into the app). A cold Render backend
 * can take far longer than that, so the backend work gets this budget and the cookies are cleared
 * regardless.
 */
const REVOKE_BUDGET_MS = 4_000;

function withinBudget(work: Promise<unknown>): Promise<unknown> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const budget = new Promise((resolve) => {
    timer = setTimeout(resolve, REVOKE_BUDGET_MS);
  });
  return Promise.race([work, budget]).finally(() => clearTimeout(timer));
}

export async function POST(request: Request) {
  const current = await authCookies();
  const context = { clientIp: clientIpFrom(request.headers) };

  const revoke = async () => {
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
  };

  try {
    await withinBudget(revoke());
  } catch {
    // Local logout must succeed even if the API is temporarily unavailable.
  } finally {
    await clearAuthCookies();
  }

  return NextResponse.json({ data: { success: true } });
}
