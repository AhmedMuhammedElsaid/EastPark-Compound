import { NextResponse } from 'next/server';

import {
  AnnouncementRequestError,
  getAnnouncementDetail,
} from '@/lib/api/announcements.server';
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
    if (error instanceof AnnouncementRequestError && error.status === 404) {
      return NextResponse.json({ error: 'Announcement not found.' }, { status: 404 });
    }

    console.error('Announcement detail proxy failed', error);
    return NextResponse.json(
      { error: 'Announcement is temporarily unavailable.' },
      { status: 502 },
    );
  }
}