import { NextResponse } from 'next/server';

import { authenticatedBackendFetch, ROUTE_SESSION } from '@/lib/api/authenticated.server';
import { bffErrorResponse, upstreamError } from '@/lib/api/bff-errors';
import { parseMarkAllRead } from '@/lib/api/notifications';

export const maxDuration = 30;

export async function PATCH() {
  try {
    const response = await authenticatedBackendFetch('/notifications/read-all', { method: 'PATCH' }, ROUTE_SESSION);
    if (!response.ok) return upstreamError(response.status);
    return NextResponse.json({ data: parseMarkAllRead(await response.json()) });
  } catch (error) {
    return bffErrorResponse(error, 'Mark all notifications read proxy failed');
  }
}
