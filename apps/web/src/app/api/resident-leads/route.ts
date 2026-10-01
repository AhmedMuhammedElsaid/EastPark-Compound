import { NextResponse } from 'next/server';

import { registerUnitSchema } from '@/lib/schemas/registerUnit';

const API_TIMEOUT_MS = 20_000;

function apiBase(): string {
  const value = process.env.NEXT_PUBLIC_API_URL;
  if (!value) throw new Error('NEXT_PUBLIC_API_URL is not configured');
  return value.replace(/\/+$/, '');
}

function submitToBackend(body: unknown) {
  return fetch(`${apiBase()}/v1/residents/leads`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
    signal: AbortSignal.timeout(API_TIMEOUT_MS),
  });
}

export async function GET() {
  try {
    await fetch(`${apiBase()}/health`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(8_000),
    });
  } catch {
    // Best-effort wake-up: submission still reports its own result.
  }
  return new Response(null, { status: 204 });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = registerUnitSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'validation' }, { status: 400 });

  try {
    const response = await submitToBackend(parsed.data);

    if (response.ok) return NextResponse.json({ data: { success: true } });
    if ([400, 409, 422, 429].includes(response.status)) {
      return NextResponse.json({ error: 'request_failed' }, { status: response.status });
    }
    return NextResponse.json({ error: 'server' }, { status: 502 });
  } catch {
    return NextResponse.json({ error: 'network' }, { status: 503 });
  }
}