import { NextResponse } from 'next/server';

import { forwardAdminRequest } from '@/lib/auth/admin.server';

export const maxDuration = 30;

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  const { id } = await params;
  const body = (await request.json().catch(() => null)) as { body?: unknown } | null;
  // A non-string body (number, object, null) is a validation error, never a 500.
  const reply = typeof body?.body === 'string' ? body.body.trim() : '';
  if (!id || id.length > 100 || !reply || reply.length > 5_000) {
    return NextResponse.json({ error: 'validation' }, { status: 400 });
  }
  return forwardAdminRequest(`/feedback/${encodeURIComponent(id)}/replies`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ body: reply }),
  });
}