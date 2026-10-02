import { NextResponse } from 'next/server';

import { backendFetch, clientIpFrom, wakeBackend } from '@/lib/auth/server';
import { registerUnitSchema } from '@/lib/schemas/registerUnit';

export const maxDuration = 30;

const API_TIMEOUT_MS = 20_000;

export async function GET() {
  // Best-effort, throttled wake-up: submission still reports its own result.
  await wakeBackend();
  return new Response(null, { status: 204 });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = registerUnitSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'validation' }, { status: 400 });

  try {
    const response = await backendFetch(
      '/residents/leads',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
        signal: AbortSignal.timeout(API_TIMEOUT_MS),
      },
      { clientIp: clientIpFrom(request.headers) },
    );

    if (response.ok) return NextResponse.json({ data: { success: true } });
    if ([400, 409, 422, 429].includes(response.status)) {
      return NextResponse.json({ error: 'request_failed' }, { status: response.status });
    }
    return NextResponse.json({ error: 'server' }, { status: 502 });
  } catch {
    return NextResponse.json({ error: 'network' }, { status: 503 });
  }
}
