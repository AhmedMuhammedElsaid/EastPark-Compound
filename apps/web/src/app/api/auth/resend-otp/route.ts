import { z } from 'zod';
import { NextResponse } from 'next/server';

import { backendFetch, clientIpFrom } from '@/lib/auth/server';

export const maxDuration = 30;

const schema = z.object({ email: z.email() });

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'validation' }, { status: 400 });

  try {
    const response = await backendFetch('/auth/resend-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(parsed.data),
    }, { clientIp: clientIpFrom(request.headers) });
    if (response.ok) return NextResponse.json({ data: { success: true } });
    if (response.status === 429) return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
    return NextResponse.json({ error: 'server' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'network' }, { status: 503 });
  }
}
