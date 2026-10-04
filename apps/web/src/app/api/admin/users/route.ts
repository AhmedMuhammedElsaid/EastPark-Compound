import { NextRequest, NextResponse } from 'next/server';

import { forwardSuperAdminRequest } from '@/lib/auth/admin.server';
import { searchParamsObject, toQueryString, usersQuerySchema } from '@/lib/validation/super-admin';

export const maxDuration = 30;

/** Team list for the super admin: SUPER_ADMIN re-checked here and by the backend. */
export function GET(request: NextRequest) {
  const parsed = usersQuerySchema.safeParse(
    searchParamsObject(request.nextUrl.searchParams, ['cursor', 'limit', 'q', 'role']),
  );
  if (!parsed.success) return NextResponse.json({ error: 'validation' }, { status: 400 });
  const { cursor, limit, q, role } = parsed.data;
  return forwardSuperAdminRequest(`/admin/user${toQueryString({ cursor, limit: limit ?? 20, q, role })}`, {
    signal: AbortSignal.timeout(25_000),
  });
}
