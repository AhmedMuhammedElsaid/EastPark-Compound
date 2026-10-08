import { NextResponse } from 'next/server';

import { forwardAdminWrite } from '@/lib/auth/admin.server';
import { shopIdSchema, shopPhotoSchema } from '@/lib/validation/admin-shops';

export const maxDuration = 30;

type RouteContext = { params: Promise<{ id: string }> };

/** Attaches the cover photo (URL from `/api/uploads/image?purpose=shop`) to a shop the admin created. */
export async function POST(request: Request, { params }: RouteContext) {
  const id = shopIdSchema.safeParse((await params).id);
  if (!id.success) return NextResponse.json({ error: 'validation' }, { status: 400 });

  const body: unknown = await request.json().catch(() => undefined);
  const parsed = shopPhotoSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'validation' }, { status: 400 });

  return forwardAdminWrite(`/shops/${encodeURIComponent(id.data)}/photos`, { url: parsed.data.url, order: 0 });
}
