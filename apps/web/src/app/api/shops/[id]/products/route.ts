import { NextResponse } from 'next/server';

import { bffErrorResponse, upstreamError } from '@/lib/api/bff-errors';
import { parseProductPage } from '@/lib/api/products';
import { backendFetch, clientIpFrom } from '@/lib/auth/server';

export const maxDuration = 30;

type ProductRouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: ProductRouteContext) {
  const { id } = await params;
  const url = new URL(request.url);
  const cursor = url.searchParams.get('cursor');
  const query = new URLSearchParams({ limit: '50', isAvailable: 'true' });
  if (cursor) query.set('cursor', cursor);

  try {
    const response = await backendFetch(
      `/shops/${encodeURIComponent(id)}/products?${query}`,
      {},
      { clientIp: clientIpFrom(request.headers) },
    );
    // Shared error vocabulary: backend 5xx bodies/statuses are never relayed verbatim.
    if (!response.ok) return upstreamError(response.status);
    return NextResponse.json({ data: parseProductPage(await response.json()) });
  } catch (error) {
    return bffErrorResponse(error, 'Products proxy failed');
  }
}