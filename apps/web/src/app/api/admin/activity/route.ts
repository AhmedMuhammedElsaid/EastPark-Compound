import { NextRequest, NextResponse } from 'next/server';

import { forwardSuperAdminRequest } from '@/lib/auth/admin.server';
import { activityQuerySchema, searchParamsObject, toQueryString } from '@/lib/validation/super-admin';

export const maxDuration = 30;

/** Admin activity feed, newest first (SUPER_ADMIN only; re-checked by the backend). */
export function GET(request: NextRequest) {
  const parsed = activityQuerySchema.safeParse(
    searchParamsObject(request.nextUrl.searchParams, ['cursor', 'limit', 'actorId']),
  );
  if (!parsed.success) return NextResponse.json({ error: 'validation' }, { status: 400 });
  const { cursor, limit, actorId } = parsed.data;
  return forwardSuperAdminRequest(`/admin/activity${toQueryString({ cursor, limit: limit ?? 20, actorId })}`, {
    signal: AbortSignal.timeout(25_000),
  });
}
