import { NextRequest, NextResponse } from 'next/server';

import { isAnnouncementCategory } from '@/lib/api/announcements';
import { bffErrorResponse } from '@/lib/api/bff-errors';
import { getAnnouncements } from '@/lib/api/announcements.server';
import { clientIpFrom } from '@/lib/auth/server';

export const maxDuration = 30;

export async function GET(request: NextRequest) {
  const categoryValue = request.nextUrl.searchParams.get('category');
  const cursor = request.nextUrl.searchParams.get('cursor') ?? undefined;
  const category = isAnnouncementCategory(categoryValue) ? categoryValue : undefined;

  try {
    const page = await getAnnouncements({ category, cursor }, { clientIp: clientIpFrom(request.headers) });
    return NextResponse.json({ data: page });
  } catch (error) {
    return bffErrorResponse(error, 'Announcements proxy failed');
  }
}