import { NextRequest, NextResponse } from 'next/server';

import { isShopCategory } from '@/lib/api/shops';
import { getShops } from '@/lib/api/shops.server';
import { clientIpFrom } from '@/lib/auth/server';

export const maxDuration = 30;

export async function GET(request: NextRequest) {
  const categoryValue = request.nextUrl.searchParams.get('category');
  const category = isShopCategory(categoryValue) ? categoryValue : undefined;
  const cursor = request.nextUrl.searchParams.get('cursor') ?? undefined;
  const search = request.nextUrl.searchParams.get('search')?.trim().slice(0, 100) || undefined;

  try {
    const page = await getShops({ category, cursor, search }, { clientIp: clientIpFrom(request.headers) });
    return NextResponse.json({ data: page });
  } catch (error) {
    console.error('Shops proxy failed', error);
    return NextResponse.json({ error: 'Shops are temporarily unavailable.' }, { status: 502 });
  }
}