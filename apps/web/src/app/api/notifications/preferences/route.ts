import { NextResponse } from 'next/server';

import { AuthenticatedRequestError, ROUTE_SESSION } from '@/lib/api/authenticated.server';
import { getNotificationPreferences } from '@/lib/api/notifications.server';

export const maxDuration = 30;

export async function GET() {
  try {
    return NextResponse.json({ data: await getNotificationPreferences(ROUTE_SESSION) });
  } catch (error) {
    if (error instanceof AuthenticatedRequestError && error.status === 401) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }
    console.error('Notification preferences proxy failed', error);
    return NextResponse.json({ error: 'Preferences are temporarily unavailable.' }, { status: 502 });
  }
}