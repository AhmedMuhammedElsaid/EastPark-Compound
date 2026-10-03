import { NextResponse } from 'next/server';

import { forwardAdminRequest } from '@/lib/auth/admin.server';

export const maxDuration = 30;

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(_request: Request, { params }: RouteContext) {
  const { id } = await params;
  if (!id || id.length > 100) return NextResponse.json({ error: 'validation' }, { status: 400 });
  return forwardAdminRequest(`/admin/residents/leads/${encodeURIComponent(id)}/reject`, {
    method: 'PATCH',
    signal: AbortSignal.timeout(25_000),
  });
}
