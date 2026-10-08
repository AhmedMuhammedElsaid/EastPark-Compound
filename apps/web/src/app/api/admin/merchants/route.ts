import { NextRequest, NextResponse } from 'next/server';

import { forwardAdminRequest } from '@/lib/auth/admin.server';
import { merchantsQuerySchema } from '@/lib/validation/admin-shops';
import { searchParamsObject, toQueryString } from '@/lib/validation/super-admin';

export const maxDuration = 30;

/**
 * Merchant picker + admin shops list: live MERCHANT accounts (id, name, email) with their live shop.
 * ADMIN (or SUPER_ADMIN) re-checked here and by the backend.
 */
export function GET(request: NextRequest) {
  const parsed = merchantsQuerySchema.safeParse(searchParamsObject(request.nextUrl.searchParams, ['cursor', 'limit', 'q']));
  if (!parsed.success) return NextResponse.json({ error: 'validation' }, { status: 400 });
  const { cursor, limit, q } = parsed.data;
  return forwardAdminRequest(`/admin/user/merchants${toQueryString({ cursor, limit: limit ?? 20, q })}`, {
    signal: AbortSignal.timeout(25_000),
  });
}
