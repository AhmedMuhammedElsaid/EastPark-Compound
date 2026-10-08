import { NextRequest, NextResponse } from 'next/server';

import { rateLimitedResponse } from '@/lib/api/bff-errors';
import { parseUploadResult } from '@/lib/api/feedback';
import { authenticatedBackendFetch } from '@/lib/auth/proxy';

export const maxDuration = 30;

const MAX_BODY_BYTES = 4.5 * 1024 * 1024;
// `shop` is staff-only: the backend allows it for MERCHANT / ADMIN / SUPER_ADMIN.
const ALLOWED_PURPOSES = new Set(['avatar', 'feedback', 'shop']);

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type');
    if (!contentType || !contentType.toLowerCase().startsWith('multipart/form-data')) {
      return NextResponse.json({ error: 'validation' }, { status: 400 });
    }

    // Vercel rejects function request bodies above 4.5 MB before this handler runs.
    if (Number(request.headers.get('content-length')) > MAX_BODY_BYTES) {
      return NextResponse.json({ error: 'upload_failed' }, { status: 413 });
    }

    const purpose = request.nextUrl.searchParams.get('purpose');
    if (purpose !== null && !ALLOWED_PURPOSES.has(purpose)) {
      return NextResponse.json({ error: 'validation' }, { status: 400 });
    }

    const body = await request.arrayBuffer();
    const path = purpose ? `/uploads/image?purpose=${encodeURIComponent(purpose)}` : '/uploads/image';
    const response = await authenticatedBackendFetch(path, {
      method: 'POST',
      headers: { 'Content-Type': contentType },
      body,
    });
    if (!response) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    if (!response.ok) {
      console.error('Image upload rejected by backend', { status: response.status });
      const status = [400, 401, 403, 413, 415, 422, 429].includes(response.status) ? response.status : 502;
      return NextResponse.json({ error: status === 401 ? 'unauthorized' : 'upload_failed' }, { status });
    }
    return NextResponse.json({ data: parseUploadResult(await response.json()) });
  } catch (error) {
    const throttled = rateLimitedResponse(error);
    if (throttled) return throttled;
    console.error('Image upload proxy failed', error);
    return NextResponse.json({ error: 'unavailable' }, { status: 502 });
  }
}