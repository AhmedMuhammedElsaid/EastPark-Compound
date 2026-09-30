import type { ApiEnvelope, AuthResponse } from '@/lib/api/contracts';

import { NextResponse } from 'next/server';

import { backendFetch, setAuthCookies } from '@/lib/auth/server';
import { verifyOtpSchema } from '@/lib/validation/auth';

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = verifyOtpSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'validation' }, { status: 400 });

  try {
    const response = await backendFetch('/auth/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(parsed.data),
    });

    if (!response.ok) {
      const error = response.status === 429 ? 'rate_limited' : 'invalid_credentials';
      return NextResponse.json({ error }, { status: response.status === 429 ? 429 : 400 });
    }

    const payload = (await response.json()) as ApiEnvelope<AuthResponse>;
    await setAuthCookies(payload.data);
    return NextResponse.json({ data: { user: payload.data.user } });
  } catch {
    return NextResponse.json({ error: 'network' }, { status: 503 });
  }
}
