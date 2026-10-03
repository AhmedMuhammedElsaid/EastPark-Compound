import { NextResponse } from 'next/server';
import { z } from 'zod';

import { authenticatedBackendFetch, ROUTE_SESSION } from '@/lib/api/authenticated.server';
import { bffErrorResponse, upstreamError } from '@/lib/api/bff-errors';
import { isNotificationType, parseNotificationPreference } from '@/lib/api/notifications';

export const maxDuration = 30;

type PreferenceRouteContext = { params: Promise<{ type: string }> };

const preferenceBodySchema = z.object({ enabled: z.boolean() }).strict();

export async function PUT(request: Request, { params }: PreferenceRouteContext) {
  const type = (await params).type;
  if (!isNotificationType(type)) {
    return NextResponse.json({ error: 'validation' }, { status: 400 });
  }

  const body = preferenceBodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json({ error: 'validation' }, { status: 400 });
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
    if (!response.ok) return upstreamError(response.status);
    return NextResponse.json({ data: parseNotificationPreference(await response.json()) });
  } catch (error) {
    return bffErrorResponse(error, 'Notification preference update proxy failed');
  }
}