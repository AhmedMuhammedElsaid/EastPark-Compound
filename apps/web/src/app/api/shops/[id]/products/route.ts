import { NextResponse } from 'next/server';

import { parseProductPage } from '@/lib/api/products';
import { backendFetch } from '@/lib/auth/server';

type ProductRouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: ProductRouteContext) {
  const { id } = await params;
  const url = new URL(request.url);
  const cursor = url.searchParams.get('cursor');
  const query = new URLSearchParams({ limit: '50', isAvailable: 'true' });
  if (cursor) query.set('cursor', cursor);

  try {
    const response = await backendFetch(`/shops/${encodeURIComponent(id)}/products?${query}`);
    if (!response.ok) {
      return NextResponse.json({ error: 'Products are temporarily unavailable.' }, { status: response.status });
    }
    return NextResponse.json({ data: parseProductPage(await response.json()) });
  } catch (error) {
    console.error('Products proxy failed', error);
    return NextResponse.json({ error: 'Products are temporarily unavailable.' }, { status: 502 });
  }
}