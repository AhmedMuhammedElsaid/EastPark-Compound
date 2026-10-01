import { NextRequest, NextResponse } from 'next/server';

import { parseUploadResult } from '@/lib/api/feedback';
import { authenticatedBackendFetch } from '@/lib/auth/proxy';

const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

export async function POST(request: NextRequest) {
  try {
    const incoming = await request.formData();
    const file = incoming.get('file');
    if (!(file instanceof File) || !ALLOWED_IMAGE_TYPES.has(file.type) || file.size > MAX_IMAGE_SIZE) {
      return NextResponse.json({ error: 'validation' }, { status: 400 });
    }

    const formData = new FormData();
    formData.set('file', file, file.name);
    const response = await authenticatedBackendFetch('/uploads/image', {
      method: 'POST',
      body: formData,
    });
    if (!response) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    if (!response.ok) {
      const status = [400, 401, 403, 413, 429].includes(response.status) ? response.status : 502;
      return NextResponse.json({ error: status === 401 ? 'unauthorized' : 'upload_failed' }, { status });
    }
    return NextResponse.json({ data: parseUploadResult(await response.json()) });
  } catch (error) {
    console.error('Image upload proxy failed', error);
    return NextResponse.json({ error: 'unavailable' }, { status: 502 });
  }
}