import { NextResponse } from 'next/server';

import { readAuthResponse } from '@/lib/api/auth-schemas';
import { backendFetch, clientIpFrom, setAuthCookies, wakeBackend } from '@/lib/auth/server';
import { loginSchema } from '@/lib/validation/auth';

export const maxDuration = 30;

function failure(status: number) {
  if (status === 401) return NextResponse.json({ error: 'invalid_credentials' }, { status });
  if (status === 403) return NextResponse.json({ error: 'unverified' }, { status });
  if (status === 429) return NextResponse.json({ error: 'rate_limited' }, { status });
  return NextResponse.json({ error: 'server' }, { status: status >= 500 ? status : 400 });
}

export async function GET() {
  await wakeBackend();
  return new Response(null, { status: 204 });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'validation' }, { status: 400 });

  try {
    const response = await backendFetch('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(parsed.data),
    }, { clientIp: clientIpFrom(request.headers) });

    if (!response.ok) return failure(response.status);

    const auth = await readAuthResponse(response);
    if (!auth) {
      console.error('Auth response contract mismatch', { endpoint: '/auth/login' });
      return NextResponse.json({ error: 'server' }, { status: 502 });
    }
    await setAuthCookies(auth);
    return NextResponse.json({ data: { user: auth.user } });
  } catch {
    return NextResponse.json({ error: 'network' }, { status: 503 });
  }
}
