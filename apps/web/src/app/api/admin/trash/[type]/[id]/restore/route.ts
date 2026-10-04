import { NextResponse } from 'next/server';

import { forwardSuperAdminRequest } from '@/lib/auth/admin.server';
import { trashIdSchema, trashTypeSchema } from '@/lib/validation/trash';

export const maxDuration = 30;

type RouteContext = { params: Promise<{ type: string; id: string }> };

/**
 * Restores a soft-deleted item (SUPER_ADMIN only). A 409 has several causes (deleted parent shop,
 * legacy anonymised account, live duplicate review) that arrive as translated prose, so it maps to
 * one code; the UI then reloads the list, whose rows carry the specific reason.
 */
const ERROR_CODES = {
  403: 'super_admin_required',
  404: 'trash_not_found',
  409: 'restore_conflict',
} as const;

export async function POST(_request: Request, { params }: RouteContext) {
  const { type: rawType, id: rawId } = await params;
  const type = trashTypeSchema.safeParse(rawType);
  const id = trashIdSchema.safeParse(rawId);
  if (!type.success || !id.success) return NextResponse.json({ error: 'validation' }, { status: 400 });

  // No body and no Content-Type: Fastify rejects an empty JSON body.
  return forwardSuperAdminRequest(
    `/admin/trash/${type.data}/${encodeURIComponent(id.data)}/restore`,
    { method: 'POST', signal: AbortSignal.timeout(25_000) },
    ERROR_CODES,
  );
}
