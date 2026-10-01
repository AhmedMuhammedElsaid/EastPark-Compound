import { NextResponse } from 'next/server';

import { forwardAdminRequest } from '@/lib/auth/admin.server';

export const maxDuration = 60;

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: RouteContext) {
  const { id } = await params;
  if (!id || id.length > 100) return NextResponse.json({ error: 'validation' }, { status: 400 });
  return forwardAdminRequest(`/admin/residents/leads/${encodeURIComponent(id)}/invite`, {
    method: 'POST',
    signal: AbortSignal.timeout(60_000),
  });
}