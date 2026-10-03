import { NextResponse } from 'next/server';

import { PRIVATE_NO_STORE } from '@/lib/api/bff-errors';
import { authCookies, getProfile } from '@/lib/auth/server';

export const maxDuration = 30;

// The session is per-user: it must never be stored by a browser, proxy or CDN.
const init = (status = 200) => ({ status, headers: PRIVATE_NO_STORE });

export async function GET() {
  const tokens = await authCookies();
  if (!tokens.accessToken && !tokens.refreshToken) {
    return NextResponse.json({ data: { user: null } }, init());
  }

  // Route handler: may refresh and rotate cookies; a rejected session clears them.
  const profile = await getProfile({ mutateCookies: true });
  if (profile.status === 'authenticated') return NextResponse.json({ data: { user: profile.user } }, init());
  if (profile.status === 'rate_limited') return NextResponse.json({ error: 'rate_limited' }, init(429));
  if (profile.status === 'unavailable') return NextResponse.json({ error: 'network' }, init(503));
  return NextResponse.json({ data: { user: null } }, init());
}
