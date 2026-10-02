import { NextRequest, NextResponse } from 'next/server';

import { parseUploadResult } from '@/lib/api/feedback';
import { authenticatedBackendFetch } from '@/lib/auth/proxy';

export const maxDuration = 30;

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type');
    if (!contentType || !contentType.toLowerCase().startsWith('multipart/form-data')) {
      return NextResponse.json({ error: 'validation' }, { status: 400 });
    }

    const body = await request.arrayBuffer();
    const response = await authenticatedBackendFetch('/uploads/image', {
      method: 'POST',
      headers: { 'Content-Type': contentType },
      body,
    });
    if (!response) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    if (!response.ok) {
      const status = [400, 401, 403, 413, 415, 422, 429].includes(response.status) ? response.status : 502;
      return NextResponse.json({ error: status === 401 ? 'unauthorized' : 'upload_failed' }, { status });
    }
    return NextResponse.json({ data: parseUploadResult(await response.json()) });
  } catch (error) {
    console.error('Image upload proxy failed', error);
    return NextResponse.json({ error: 'unavailable' }, { status: 502 });
  }
}