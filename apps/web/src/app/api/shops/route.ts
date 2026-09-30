import { NextRequest, NextResponse } from 'next/server';

import { isShopCategory } from '@/lib/api/shops';
import { getShops } from '@/lib/api/shops.server';

export async function GET(request: NextRequest) {
  const categoryValue = request.nextUrl.searchParams.get('category');
  const category = isShopCategory(categoryValue) ? categoryValue : undefined;
  const cursor = request.nextUrl.searchParams.get('cursor') ?? undefined;
  const search = request.nextUrl.searchParams.get('search')?.trim().slice(0, 100) || undefined;

  try {
    const page = await getShops({ category, cursor, search });
    return NextResponse.json({ data: page });
  } catch (error) {
    console.error('Shops proxy failed', error);
    return NextResponse.json({ error: 'Shops are temporarily unavailable.' }, { status: 502 });
  }
}