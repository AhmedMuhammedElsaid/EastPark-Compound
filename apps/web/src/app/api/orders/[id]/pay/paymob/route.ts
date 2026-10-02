import { NextResponse } from 'next/server';

import { relayBackendResponse } from '@/lib/api/bff-errors';
import { authenticatedBackendFetch } from '@/lib/auth/server';

export const maxDuration = 30;

type PaymobRouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: PaymobRouteContext) {
  const { id } = await params;
  if (!id || id.length > 100) return NextResponse.json({ error: 'validation' }, { status: 400 });

  try {
    const response = await authenticatedBackendFetch(
      `/orders/${encodeURIComponent(id)}/pay/paymob`,
      { method: 'POST' },
      { mutateCookies: true },
    );
    if (!response) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    return relayBackendResponse(response);
  } catch (error) {
    console.error('Paymob initiation proxy failed', error);
    return NextResponse.json({ error: 'network' }, { status: 502 });
  }
}
