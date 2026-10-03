import { NextRequest, NextResponse } from 'next/server';

import { bffErrorResponse, upstreamError } from '@/lib/api/bff-errors';
import { parseFeedbackDetail } from '@/lib/api/feedback';
import { authenticatedBackendFetch } from '@/lib/auth/server';

export const maxDuration = 30;

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  if (!id || id.length > 100) {
    return NextResponse.json({ error: 'validation' }, { status: 400 });
  }

  try {
    const response = await authenticatedBackendFetch(`/feedback/${encodeURIComponent(id)}`, {}, { mutateCookies: true });
    if (!response) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    if (!response.ok) return upstreamError(response.status);
    return NextResponse.json({ data: parseFeedbackDetail(await response.json()) });
  } catch (error) {
    return bffErrorResponse(error, 'Feedback detail proxy failed', { error: 'unavailable', status: 502 });
  }
}