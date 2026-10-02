import { NextRequest, NextResponse } from 'next/server';

import { loginPath, safeReturnPath } from '@/lib/auth/return-path';
import {
  authCookies,
  clearAuthCookies,
  clientIpFrom,
  getProfile,
  refreshTokens,
  setAuthCookies,
} from '@/lib/auth/server';

export const maxDuration = 30;

/**
 * Session bounce for Server Components, which cannot write cookies: rotate the refresh token, store
 * the new pair, then return to the (validated) `next` path. The new access token is checked against
 * the profile endpoint before bouncing back so a rejected token can never cause a redirect loop.
 *
 * `optional=1` marks public pages that only personalise with a session: a rejected refresh returns
 * there as a guest instead of going to login.
 */
export async function GET(request: NextRequest) {
  const next = safeReturnPath(request.nextUrl.searchParams.get('next'));
  const optional = request.nextUrl.searchParams.get('optional') === '1';
  const signedOut = () => NextResponse.redirect(new URL(optional ? next : loginPath(next), request.url));

  const { refreshToken } = await authCookies();
  // No cookie clearing here: a cross-site link arrives without the Strict cookies and must not be
  // able to log anyone out.
  if (!refreshToken) return signedOut();

  try {
    const outcome = await refreshTokens(refreshToken, { clientIp: clientIpFrom(request.headers) });
    // Rejected (revoked, expired, or a lost single-use rotation race). Auth-only pages go to login
    // without deleting cookies, so a newer pair set by a concurrent response survives; login is
    // terminal, so this cannot loop. Optional pages return as a guest, which requires clearing the
    // stale refresh cookie or the page would ask for a refresh again.
    if (outcome.status === 'rejected') {
      if (optional) await clearAuthCookies();
      return signedOut();
    }
    await setAuthCookies(outcome.tokens);

    const profile = await getProfile({ mutateCookies: true, clientIp: clientIpFrom(request.headers) });
    if (profile.status === 'authenticated') return NextResponse.redirect(new URL(next, request.url));
    if (profile.status === 'unauthenticated' || profile.status === 'refresh-required') {
      await clearAuthCookies();
      return signedOut();
    }
  } catch (error) {
    console.error('Session refresh bounce failed', error instanceof Error ? error.name : 'unknown');
  }

  // Transport failure: do not bounce back (the page would ask for a refresh again).
  return NextResponse.json({ error: 'network' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
}
