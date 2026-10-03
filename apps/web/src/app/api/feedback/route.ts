import { NextRequest, NextResponse } from 'next/server';

import { bffErrorResponse, upstreamError } from '@/lib/api/bff-errors';
import {
  createFeedbackSchema,
  isFeedbackStatus,
  parseFeedback,
  parseFeedbackPage,
} from '@/lib/api/feedback';
import { authenticatedBackendFetch } from '@/lib/auth/server';

export const maxDuration = 30;

const ROUTE_SESSION = { mutateCookies: true } as const;
const UNAVAILABLE = { error: 'unavailable', status: 502 };

export async function GET(request: NextRequest) {
  const params = new URLSearchParams({ limit: '20' });
  const cursor = request.nextUrl.searchParams.get('cursor');
  const status = request.nextUrl.searchParams.get('status');
  if (cursor) params.set('cursor', cursor);
  if (isFeedbackStatus(status)) params.set('status', status);

  try {
    const response = await authenticatedBackendFetch(`/feedback?${params.toString()}`, {}, ROUTE_SESSION);
    if (!response) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    if (!response.ok) return upstreamError(response.status);
    return NextResponse.json({ data: parseFeedbackPage(await response.json()) });
  } catch (error) {
    return bffErrorResponse(error, 'Feedback list proxy failed', UNAVAILABLE);
  }
}

export async function POST(request: NextRequest) {
  // Malformed JSON is a client error (400), not an outage.
  const parsed = createFeedbackSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'validation' }, { status: 400 });
  }

  try {
    const response = await authenticatedBackendFetch('/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(parsed.data),
    }, ROUTE_SESSION);
    if (!response) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    if (!response.ok) return upstreamError(response.status);
    return NextResponse.json({ data: parseFeedback(await response.json()) }, { status: 201 });
  } catch (error) {
    return bffErrorResponse(error, 'Feedback create proxy failed', UNAVAILABLE);
  }
}
