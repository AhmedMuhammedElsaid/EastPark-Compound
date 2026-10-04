import { NextResponse } from 'next/server';

import { forwardSuperAdminRequest } from '@/lib/auth/admin.server';
import { roleChangeSchema, userIdSchema } from '@/lib/validation/super-admin';

export const maxDuration = 30;

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Changes a user's role (SUPER_ADMIN only). The backend's message keys arrive translated to prose,
 * so each failure status of this endpoint maps to one explicit code the UI turns into copy.
 */
const ERROR_CODES = {
  403: 'cannot_change_super_admin',
  404: 'not_found',
  409: 'merchant_owns_shop',
} as const;

export async function PATCH(request: Request, { params }: RouteContext) {
  const id = userIdSchema.safeParse((await params).id);
  if (!id.success) return NextResponse.json({ error: 'validation' }, { status: 400 });

  const body: unknown = await request.json().catch(() => undefined);
  const parsed = roleChangeSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'validation' }, { status: 400 });

  return forwardSuperAdminRequest(
    `/admin/user/${encodeURIComponent(id.data)}/role`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: parsed.data.role }),
      signal: AbortSignal.timeout(25_000),
    },
    ERROR_CODES,
  );
}
