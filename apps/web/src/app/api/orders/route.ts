import { NextResponse } from 'next/server';

import { createOrderSchema } from '@/lib/api/orders';
import { authenticatedBackendFetch } from '@/lib/auth/server';

export async function POST(request: Request) {
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