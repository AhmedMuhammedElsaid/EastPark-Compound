import { NextRequest, NextResponse } from 'next/server';

import { forwardSuperAdminRequest } from '@/lib/auth/admin.server';
import { searchParamsObject, toQueryString } from '@/lib/validation/super-admin';
import { trashQuerySchema } from '@/lib/validation/trash';

export const maxDuration = 30;

/** Recycle bin listing for one item type, newest deleted first (SUPER_ADMIN only; re-checked by the backend). */
export function GET(request: NextRequest) {
  const parsed = trashQuerySchema.safeParse(
    searchParamsObject(request.nextUrl.searchParams, ['type', 'cursor', 'limit']),
  );
  if (!parsed.success) return NextResponse.json({ error: 'validation' }, { status: 400 });
  const { type, cursor, limit } = parsed.data;
  return forwardSuperAdminRequest(`/admin/trash${toQueryString({ type, cursor, limit: limit ?? 20 })}`, {
    signal: AbortSignal.timeout(25_000),
  });
}
