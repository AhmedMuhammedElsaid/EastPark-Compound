import { NextResponse } from 'next/server';

import { forwardAdminWrite } from '@/lib/auth/admin.server';
import { shopCreateSchema } from '@/lib/validation/admin-shops';

export const maxDuration = 30;

/**
 * Creates a shop for a merchant (ADMIN / SUPER_ADMIN). The body is rebuilt from validated fields
 * only: the backend rejects unknown keys. Allowlisted backend codes: `merchant_invalid` (400, owner
 * is not a live merchant) and `merchant_has_shop` (409, the merchant already runs a shop).
 */
export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => undefined);
  const parsed = shopCreateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'validation' }, { status: 400 });
  return forwardAdminWrite('/shops', parsed.data);
}
