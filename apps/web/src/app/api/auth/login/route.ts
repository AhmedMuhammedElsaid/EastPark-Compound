import type { ApiEnvelope, AuthResponse } from '@/lib/api/contracts';

import { NextResponse } from 'next/server';

import { backendFetch, setAuthCookies } from '@/lib/auth/server';
import { loginSchema } from '@/lib/validation/auth';

function failure(status: number) {
  if (status === 401) return NextResponse.json({ error: 'invalid_credentials' }, { status });
  if (status === 429) return NextResponse.json({ error: 'rate_limited' }, { status });
  return NextResponse.json({ error: 'server' }, { status: status >= 500 ? status : 400 });
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
    });

    if (!response.ok) return failure(response.status);

    const payload = (await response.json()) as ApiEnvelope<AuthResponse>;
    await setAuthCookies(payload.data);
    return NextResponse.json({ data: { user: payload.data.user } });
  } catch {
    return NextResponse.json({ error: 'network' }, { status: 503 });
  }
}
