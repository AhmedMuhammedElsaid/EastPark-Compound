import { NextResponse } from 'next/server';
import { z } from 'zod';

import { authenticatedBackendFetch, ROUTE_SESSION } from '@/lib/api/authenticated.server';
import { bffErrorResponse, upstreamError } from '@/lib/api/bff-errors';

export const maxDuration = 30;

type NotificationRouteContext = { params: Promise<{ id: string }> };

const idSchema = z.string().min(1).max(200);

export async function PATCH(_request: Request, { params }: NotificationRouteContext) {
  const id = idSchema.safeParse((await params).id);
  if (!id.success) {
    return NextResponse.json({ error: 'validation' }, { status: 400 });
  }

  try {
    const response = await authenticatedBackendFetch(
      `/notifications/${encodeURIComponent(id.data)}/read`,
      { method: 'PATCH' },
      ROUTE_SESSION,
    );
    if (!response.ok) return upstreamError(response.status);
    return NextResponse.json({ data: null });
  } catch (error) {
    return bffErrorResponse(error, 'Mark notification read proxy failed');
  }
}
