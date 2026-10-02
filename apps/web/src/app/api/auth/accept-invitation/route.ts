import { NextResponse } from 'next/server';

import { readAuthResponse } from '@/lib/api/auth-schemas';
import { backendFetch, clientIpFrom, setAuthCookies } from '@/lib/auth/server';
import { acceptInvitationSchema } from '@/lib/validation/auth';

export const maxDuration = 30;

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = acceptInvitationSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'validation' }, { status: 400 });

  try {
    const response = await backendFetch('/auth/accept-invitation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(parsed.data),
    }, { clientIp: clientIpFrom(request.headers) });

    if (!response.ok) {
      if (response.status === 429) return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
      // 409: the email already has an account and the submitted password is not its current one.
      if (response.status === 409) return NextResponse.json({ error: 'account_exists' }, { status: 409 });
      if (response.status === 400 || response.status === 404) {
        return NextResponse.json({ error: 'invalid_invitation' }, { status: 400 });
      }
      return NextResponse.json({ error: 'server' }, { status: response.status >= 500 ? response.status : 400 });
    }

    const auth = await readAuthResponse(response);
    if (!auth) {
      console.error('Auth response contract mismatch', { endpoint: '/auth/accept-invitation' });
      return NextResponse.json({ error: 'server' }, { status: 502 });
    }
    await setAuthCookies(auth);
    return NextResponse.json({ data: { user: auth.user } });
  } catch {
    return NextResponse.json({ error: 'network' }, { status: 503 });
  }
}