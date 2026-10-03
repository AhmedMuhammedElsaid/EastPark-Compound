import { NextResponse } from 'next/server';

import { getAnnouncementDetail } from '@/lib/api/announcements.server';
import { bffErrorResponse } from '@/lib/api/bff-errors';
import { clientIpFrom } from '@/lib/auth/server';

export const maxDuration = 30;

type AnnouncementRouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, { params }: AnnouncementRouteContext) {
  const { id } = await params;

  try {
    const announcement = await getAnnouncementDetail(id, { clientIp: clientIpFrom(request.headers) });
    return NextResponse.json({ data: announcement });
  } catch (error) {
    return bffErrorResponse(error, 'Announcement detail proxy failed');
  }
}
