import { NextResponse } from 'next/server';

import { AuthenticatedRequestError } from '@/lib/api/authenticated.server';
import { getNotificationPreferences } from '@/lib/api/notifications.server';

export async function GET() {
  try {
    return NextResponse.json({ data: await getNotificationPreferences() });
  } catch (error) {
    if (error instanceof AuthenticatedRequestError && error.status === 401) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }
    console.error('Notification preferences proxy failed', error);
    return NextResponse.json({ error: 'Preferences are temporarily unavailable.' }, { status: 502 });
  }
}