import { NextResponse } from 'next/server';
import { z } from 'zod';

import { authenticatedBackendFetch, AuthenticatedRequestError, ROUTE_SESSION } from '@/lib/api/authenticated.server';

export const maxDuration = 30;

type NotificationRouteContext = { params: Promise<{ id: string }> };

const idSchema = z.string().min(1).max(200);

export async function PATCH(_request: Request, { params }: NotificationRouteContext) {
  const id = idSchema.safeParse((await params).id);
  if (!id.success) {
    return NextResponse.json({ error: 'Invalid notification.' }, { status: 400 });
  }

  try {
    const response = await authenticatedBackendFetch(
      `/notifications/${encodeURIComponent(id.data)}/read`,
      { method: 'PATCH' },
      ROUTE_SESSION,
    );
    if (!response.ok) throw new AuthenticatedRequestError('Mark notification read failed', response.status);
    return NextResponse.json({ data: null });
  } catch (error) {
    if (error instanceof AuthenticatedRequestError && error.status === 401) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }
    if (error instanceof AuthenticatedRequestError && error.status === 404) {
      return NextResponse.json({ error: 'Notification not found.' }, { status: 404 });
    }
    console.error('Mark notification read proxy failed', error);
    return NextResponse.json({ error: 'Notification could not be updated.' }, { status: 502 });
  }
}