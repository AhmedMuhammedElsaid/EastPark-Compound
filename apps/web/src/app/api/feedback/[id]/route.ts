import { NextRequest, NextResponse } from 'next/server';

import { parseFeedbackDetail } from '@/lib/api/feedback';
import { authenticatedBackendFetch } from '@/lib/auth/proxy';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  if (!id || id.length > 100) {
    return NextResponse.json({ error: 'validation' }, { status: 400 });
  }

  try {
    const response = await authenticatedBackendFetch(`/feedback/${encodeURIComponent(id)}`);
    if (!response) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    if (!response.ok) {
      const status = [401, 403, 404, 429].includes(response.status) ? response.status : 502;
      return NextResponse.json({ error: status === 401 ? 'unauthorized' : 'request_failed' }, { status });
    }
    return NextResponse.json({ data: parseFeedbackDetail(await response.json()) });
  } catch (error) {
    console.error('Feedback detail proxy failed', error);
    return NextResponse.json({ error: 'unavailable' }, { status: 502 });
  }
}