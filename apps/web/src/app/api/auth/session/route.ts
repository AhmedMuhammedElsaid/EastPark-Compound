import { NextResponse } from 'next/server';

import { authCookies, getProfile } from '@/lib/auth/server';

export const maxDuration = 30;

export async function GET() {
  const tokens = await authCookies();
  if (!tokens.accessToken && !tokens.refreshToken) {
    return NextResponse.json({ data: { user: null } });
  }

  // Route handler: may refresh and rotate cookies; a rejected session clears them.
  const profile = await getProfile({ mutateCookies: true });
  if (profile.status === 'authenticated') return NextResponse.json({ data: { user: profile.user } });
  if (profile.status === 'rate_limited') return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  if (profile.status === 'unavailable') return NextResponse.json({ error: 'network' }, { status: 503 });
  return NextResponse.json({ data: { user: null } });
}
