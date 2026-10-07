import { NextResponse } from 'next/server';

import { forwardSuperAdminRequest } from '@/lib/auth/admin.server';
import { unitIdSchema, userIdSchema } from '@/lib/validation/super-admin';

export const maxDuration = 30;

type RouteContext = { params: Promise<{ id: string; unitId: string }> };

/** The flat is gone or belongs to a different account (`unit.error.notFound`). */
const ERROR_CODES = {
  404: 'unit_not_found',
} as const;

/**
 * Removes a flat from an account (SUPER_ADMIN only; sale / transfer) → backend
 * `DELETE /v1/admin/user/:id/units/:unitId`. Works for a deleted account too.
 */
export async function DELETE(_request: Request, { params }: RouteContext) {
  const raw = await params;
  const id = userIdSchema.safeParse(raw.id);
  const unitId = unitIdSchema.safeParse(raw.unitId);
  if (!id.success || !unitId.success) return NextResponse.json({ error: 'validation' }, { status: 400 });

  // No body and no Content-Type: Fastify rejects an empty JSON body.
  return forwardSuperAdminRequest(
    `/admin/user/${encodeURIComponent(id.data)}/units/${encodeURIComponent(unitId.data)}`,
    { method: 'DELETE', signal: AbortSignal.timeout(25_000) },
    ERROR_CODES,
  );
}
