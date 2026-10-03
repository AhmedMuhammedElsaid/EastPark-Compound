import { NextResponse } from 'next/server';

import { bffErrorResponse, relayBackendResponse } from '@/lib/api/bff-errors';
import { authenticatedBackendFetch } from '@/lib/auth/server';

export const maxDuration = 30;

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'invalid_order' }, { status: 400 });

  try {
    const response = await authenticatedBackendFetch(
      `/orders/${encodeURIComponent(id)}`,
      {},
      { mutateCookies: true },
    );
    if (!response) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    return relayBackendResponse(response);
  } catch (error) {
    return bffErrorResponse(error, 'Order detail proxy failed', { error: 'network', status: 503 });
  }
}
