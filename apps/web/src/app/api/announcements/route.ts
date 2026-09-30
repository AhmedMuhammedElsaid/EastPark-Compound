import { NextRequest, NextResponse } from 'next/server';

import { isAnnouncementCategory } from '@/lib/api/announcements';
import { getAnnouncements } from '@/lib/api/announcements.server';

export async function GET(request: NextRequest) {
  const categoryValue = request.nextUrl.searchParams.get('category');
  const cursor = request.nextUrl.searchParams.get('cursor') ?? undefined;
  const category = isAnnouncementCategory(categoryValue) ? categoryValue : undefined;

  try {
    const page = await getAnnouncements({ category, cursor });
    return NextResponse.json({ data: page });
  } catch (error) {
    console.error('Announcements proxy failed', error);
    return NextResponse.json({ error: 'Announcements are temporarily unavailable.' }, { status: 502 });
  }
}