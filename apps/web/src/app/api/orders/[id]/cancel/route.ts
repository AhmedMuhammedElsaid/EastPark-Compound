import { NextResponse } from 'next/server';

import { authenticatedBackendFetch } from '@/lib/auth/server';

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(_request: Request, { params }: RouteContext) {
  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'invalid_order' }, { status: 400 });

  try {
    const response = await authenticatedBackendFetch(
      `/orders/${encodeURIComponent(id)}/cancel`,
      { method: 'PATCH' },
    );
    if (!response) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    return new Response(response.body, {
      status: response.status,
      headers: { 'Content-Type': response.headers.get('Content-Type') ?? 'application/json' },
    });
  } catch (error) {
    console.error('Order cancellation proxy failed', error);
    return NextResponse.json({ error: 'network' }, { status: 503 });
  }
}