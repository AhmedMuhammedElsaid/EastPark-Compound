import { NextResponse } from 'next/server';

import { backendFetch } from '@/lib/auth/server';
import { registerSchema } from '@/lib/validation/auth';

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'validation' }, { status: 400 });

  try {
    const response = await backendFetch('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(parsed.data),
    });

    if (response.ok) return NextResponse.json({ data: { success: true } });
    if (response.status === 409) return NextResponse.json({ error: 'email_taken' }, { status: 409 });
    if (response.status === 429) return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
    return NextResponse.json({ error: 'server' }, { status: response.status >= 500 ? response.status : 400 });
  } catch {
    return NextResponse.json({ error: 'network' }, { status: 503 });
  }
}
