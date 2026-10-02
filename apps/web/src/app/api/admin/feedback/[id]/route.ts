import { NextResponse } from 'next/server';

import { forwardAdminRequest } from '@/lib/auth/admin.server';

export const maxDuration = 30;

const STATUSES = new Set(['SUBMITTED', 'ACKNOWLEDGED', 'IN_PROGRESS', 'RESOLVED']);
type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: RouteContext) {
  const { id } = await params;
  const body = (await request.json().catch(() => null)) as { status?: string } | null;
  if (!id || id.length > 100 || !body?.status || !STATUSES.has(body.status)) {
    return NextResponse.json({ error: 'validation' }, { status: 400 });
  }
  return forwardAdminRequest(`/feedback/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: body.status }),
  });
}