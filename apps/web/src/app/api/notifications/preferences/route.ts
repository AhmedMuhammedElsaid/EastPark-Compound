import { NextResponse } from 'next/server';

import { ROUTE_SESSION } from '@/lib/api/authenticated.server';
import { bffErrorResponse } from '@/lib/api/bff-errors';
import { getNotificationPreferences } from '@/lib/api/notifications.server';

export const maxDuration = 30;

export async function GET() {
  try {
    return NextResponse.json({ data: await getNotificationPreferences(ROUTE_SESSION) });
  } catch (error) {
    return bffErrorResponse(error, 'Notification preferences proxy failed');
  }
}
