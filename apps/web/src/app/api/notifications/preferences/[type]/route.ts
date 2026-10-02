import { NextResponse } from 'next/server';
import { z } from 'zod';

import { authenticatedBackendFetch, AuthenticatedRequestError, ROUTE_SESSION } from '@/lib/api/authenticated.server';
import { isNotificationType, parseNotificationPreference } from '@/lib/api/notifications';

export const maxDuration = 30;

type PreferenceRouteContext = { params: Promise<{ type: string }> };

const preferenceBodySchema = z.object({ enabled: z.boolean() }).strict();

export async function PUT(request: Request, { params }: PreferenceRouteContext) {
  const type = (await params).type;
  if (!isNotificationType(type)) {
    return NextResponse.json({ error: 'Invalid notification type.' }, { status: 400 });
  }

  const body = preferenceBodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json({ error: 'Invalid preference.' }, { status: 400 });
  }

  try {
    const response = await authenticatedBackendFetch(
      `/notifications/preferences/${encodeURIComponent(type)}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body.data),
      },
      ROUTE_SESSION,
    );
    if (!response.ok) throw new AuthenticatedRequestError('Preference update failed', response.status);
    return NextResponse.json({ data: parseNotificationPreference(await response.json()) });
  } catch (error) {
    if (error instanceof AuthenticatedRequestError && error.status === 401) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }
    console.error('Notification preference update proxy failed', error);
    return NextResponse.json({ error: 'Preference could not be updated.' }, { status: 502 });
  }
}