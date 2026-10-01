import { NextResponse } from 'next/server';

import { authenticatedBackendFetch } from '@/lib/auth/server';

type PaymobRouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: PaymobRouteContext) {
  const { id } = await params;
  if (!id || id.length > 100) return NextResponse.json({ error: 'validation' }, { status: 400 });

  try {
    const response = await authenticatedBackendFetch(
      `/orders/${encodeURIComponent(id)}/pay/paymob`,
      { method: 'POST' },
    );
    if (!response) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

    const payload = await response.json();
    return NextResponse.json(payload, { status: response.status });
  } catch (error) {
    console.error('Paymob initiation proxy failed', error);
    return NextResponse.json({ error: 'network' }, { status: 502 });
  }
}