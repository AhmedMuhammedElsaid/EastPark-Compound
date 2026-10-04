import { NextResponse } from 'next/server';

import { forwardSuperAdminRequest } from '@/lib/auth/admin.server';
import { userIdSchema } from '@/lib/validation/super-admin';

export const maxDuration = 30;

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Soft-deletes an account (SUPER_ADMIN only): the person is signed out and hidden, and can be
 * restored from the recycle bin. Each failure status maps to one explicit code the UI turns into copy.
 */
const ERROR_CODES = {
  403: 'cannot_delete_super_admin',
  404: 'not_found',
  409: 'delete_merchant_owns_shop',
} as const;

export async function DELETE(_request: Request, { params }: RouteContext) {
  const id = userIdSchema.safeParse((await params).id);
  if (!id.success) return NextResponse.json({ error: 'validation' }, { status: 400 });

  // No body and no Content-Type: Fastify rejects an empty JSON body.
  return forwardSuperAdminRequest(
    `/admin/user/${encodeURIComponent(id.data)}`,
    { method: 'DELETE', signal: AbortSignal.timeout(25_000) },
    ERROR_CODES,
  );
}
