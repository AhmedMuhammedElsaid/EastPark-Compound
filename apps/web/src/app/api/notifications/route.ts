import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { ROUTE_SESSION } from '@/lib/api/authenticated.server';
import { bffErrorResponse } from '@/lib/api/bff-errors';
import { getNotifications } from '@/lib/api/notifications.server';

export const maxDuration = 30;

const querySchema = z.object({
  cursor: z.string().min(1).max(200).optional(),
  isRead: z.enum(['true', 'false']).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export async function GET(request: NextRequest) {
  const result = querySchema.safeParse({
    cursor: request.nextUrl.searchParams.get('cursor') ?? undefined,
    isRead: request.nextUrl.searchParams.get('isRead') ?? undefined,
    limit: request.nextUrl.searchParams.get('limit') ?? undefined,
  });
  if (!result.success) {
    return NextResponse.json({ error: 'validation' }, { status: 400 });
  }

  try {
    const page = await getNotifications({
      cursor: result.data.cursor,
      isRead: result.data.isRead === undefined ? undefined : result.data.isRead === 'true',
      limit: result.data.limit,
    }, ROUTE_SESSION);
    return NextResponse.json({ data: page });
  } catch (error) {
    return bffErrorResponse(error, 'Notifications proxy failed');
  }
}
