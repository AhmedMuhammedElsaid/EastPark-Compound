import { NextRequest, NextResponse } from 'next/server';

import { createOrderSchema, isOrderStatus } from '@/lib/api/orders';
import { authenticatedBackendFetch } from '@/lib/auth/server';
import { residentOrderingEnabled } from '@/config/features';

export async function GET(request: NextRequest) {
  const cursor = request.nextUrl.searchParams.get('cursor');
  const statusValue = request.nextUrl.searchParams.get('status');
  const params = new URLSearchParams({ limit: '20' });
  if (cursor) params.set('cursor', cursor);
  if (isOrderStatus(statusValue)) params.set('status', statusValue);

  try {
    const response = await authenticatedBackendFetch(`/orders?${params}`);
    if (!response) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    return relay(response);
  } catch (error) {
    console.error('Orders proxy failed', error);
    return NextResponse.json({ error: 'network' }, { status: 503 });
  }
}

export async function POST(request: Request) {
  if (!residentOrderingEnabled) {
    return NextResponse.json({ error: 'ordering_disabled' }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'validation' }, { status: 400 });
  }

  const parsed = createOrderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'validation' }, { status: 400 });
  }

  try {
    const response = await authenticatedBackendFetch('/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(parsed.data),
    });
    if (!response) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

    const payload = await response.json();
    return NextResponse.json(payload, { status: response.status });
  } catch (error) {
    console.error('Order creation proxy failed', error);
    return NextResponse.json({ error: 'network' }, { status: 502 });
  }
}

function relay(response: Response): Response {
  return new Response(response.body, {
    status: response.status,
    headers: { 'Content-Type': response.headers.get('Content-Type') ?? 'application/json' },
  });
}