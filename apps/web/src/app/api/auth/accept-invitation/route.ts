import type { ApiEnvelope, AuthResponse } from '@/lib/api/contracts';

import { NextResponse } from 'next/server';

import { backendFetch, setAuthCookies } from '@/lib/auth/server';
import { acceptInvitationSchema } from '@/lib/validation/auth';

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = acceptInvitationSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'validation' }, { status: 400 });

  try {
    const response = await backendFetch('/auth/accept-invitation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(parsed.data),
    });

    if (!response.ok) {
      if (response.status === 429) return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
      if (response.status === 400 || response.status === 404 || response.status === 409) {
        return NextResponse.json({ error: 'invalid_invitation' }, { status: 400 });
      }
      return NextResponse.json({ error: 'server' }, { status: response.status >= 500 ? response.status : 400 });
    }

    const payload = (await response.json()) as ApiEnvelope<AuthResponse>;
    await setAuthCookies(payload.data);
    return NextResponse.json({ data: { user: payload.data.user } });
  } catch {
    return NextResponse.json({ error: 'network' }, { status: 503 });
  }
}