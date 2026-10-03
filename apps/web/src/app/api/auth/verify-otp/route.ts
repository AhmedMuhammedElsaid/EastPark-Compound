import { NextResponse } from 'next/server';

import { readAuthResponse } from '@/lib/api/auth-schemas';
import { backendFetch, clientIpFrom, setAuthCookies } from '@/lib/auth/server';
import { verifyOtpSchema } from '@/lib/validation/auth';

export const maxDuration = 30;

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = verifyOtpSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'validation' }, { status: 400 });

  try {
    const response = await backendFetch('/auth/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(parsed.data),
    }, { clientIp: clientIpFrom(request.headers) });

    if (response.status === 429) return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
    // A cold-starting or failing backend is not a wrong code.
    if (response.status >= 500) return NextResponse.json({ error: 'server' }, { status: 502 });
    if (!response.ok) return NextResponse.json({ error: 'invalid_credentials' }, { status: 400 });

    const auth = await readAuthResponse(response);
    if (!auth) {
      console.error('Auth response contract mismatch', { endpoint: '/auth/verify-otp' });
      return NextResponse.json({ error: 'server' }, { status: 502 });
    }
    await setAuthCookies(auth);
    return NextResponse.json({ data: { user: auth.user } });
  } catch {
    return NextResponse.json({ error: 'network' }, { status: 503 });
  }
}
