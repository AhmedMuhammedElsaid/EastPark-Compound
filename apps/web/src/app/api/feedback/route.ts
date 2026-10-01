import { NextRequest, NextResponse } from 'next/server';

import {
  createFeedbackSchema,
  isFeedbackStatus,
  parseFeedback,
  parseFeedbackPage,
} from '@/lib/api/feedback';
import { authenticatedBackendFetch } from '@/lib/auth/proxy';

export async function GET(request: NextRequest) {
  const params = new URLSearchParams({ limit: '20' });
  const cursor = request.nextUrl.searchParams.get('cursor');
  const status = request.nextUrl.searchParams.get('status');
  if (cursor) params.set('cursor', cursor);
  if (isFeedbackStatus(status)) params.set('status', status);

  try {
    const response = await authenticatedBackendFetch(`/feedback?${params.toString()}`);
    if (!response) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    if (!response.ok) return proxyError(response);
    return NextResponse.json({ data: parseFeedbackPage(await response.json()) });
  } catch (error) {
    console.error('Feedback list proxy failed', error);
    return NextResponse.json({ error: 'unavailable' }, { status: 502 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const parsed = createFeedbackSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'validation' }, { status: 400 });
    }

    const response = await authenticatedBackendFetch('/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(parsed.data),
    });
    if (!response) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    if (!response.ok) return proxyError(response);
    return NextResponse.json({ data: parseFeedback(await response.json()) }, { status: 201 });
  } catch (error) {
    console.error('Feedback create proxy failed', error);
    return NextResponse.json({ error: 'unavailable' }, { status: 502 });
  }
}

async function proxyError(response: Response) {
  const status = [400, 401, 403, 404, 429].includes(response.status) ? response.status : 502;
  return NextResponse.json({ error: status === 401 ? 'unauthorized' : 'request_failed' }, { status });
}