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

    if (!response.ok) {
      const error = response.status === 429 ? 'rate_limited' : 'invalid_credentials';
      return NextResponse.json({ error }, { status: response.status === 429 ? 429 : 400 });
    }

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
