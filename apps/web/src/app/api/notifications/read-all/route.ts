import { NextResponse } from 'next/server';

import { authenticatedBackendFetch, AuthenticatedRequestError, ROUTE_SESSION } from '@/lib/api/authenticated.server';
import { parseMarkAllRead } from '@/lib/api/notifications';

export const maxDuration = 30;

export async function PATCH() {
  try {
    const response = await authenticatedBackendFetch('/notifications/read-all', { method: 'PATCH' }, ROUTE_SESSION);
    if (!response.ok) throw new AuthenticatedRequestError('Mark all read failed', response.status);
    return NextResponse.json({ data: parseMarkAllRead(await response.json()) });
  } catch (error) {
    if (error instanceof AuthenticatedRequestError && error.status === 401) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }
    console.error('Mark all notifications read proxy failed', error);
    return NextResponse.json({ error: 'Notifications could not be updated.' }, { status: 502 });
  }
}