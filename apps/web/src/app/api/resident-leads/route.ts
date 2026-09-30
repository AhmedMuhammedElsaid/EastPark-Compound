import { NextResponse } from 'next/server';

import { backendFetch } from '@/lib/auth/server';
import { registerUnitSchema } from '@/lib/schemas/registerUnit';

function submitToBackend(body: unknown) {
  return backendFetch('/residents/leads', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function isRetryable(response: Response) {
  return response.status >= 500;
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = registerUnitSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'validation' }, { status: 400 });

  try {
    let response: Response;
    try {
      response = await submitToBackend(parsed.data);
      if (isRetryable(response)) {
        await new Promise((resolve) => setTimeout(resolve, 150));
        response = await submitToBackend(parsed.data);
      }
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 150));
      response = await submitToBackend(parsed.data);
    }

    if (response.ok) return NextResponse.json({ data: { success: true } });
    if ([400, 409, 422, 429].includes(response.status)) {
      return NextResponse.json({ error: 'request_failed' }, { status: response.status });
    }
    return NextResponse.json({ error: 'server' }, { status: 502 });
  } catch {
    return NextResponse.json({ error: 'network' }, { status: 503 });
  }
}