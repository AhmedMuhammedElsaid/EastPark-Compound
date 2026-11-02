import { NextRequest, NextResponse } from 'next/server';

import { bffErrorResponse } from '@/lib/api/bff-errors';
import { financeBackendFetch, financeJson, relayFinance, requireFinance } from '@/lib/api/finance.server';
import { clientIpFrom } from '@/lib/auth/server';

export const maxDuration = 30;
export const dynamic = 'force-dynamic';

// Vercel rejects function request bodies above 4.5 MB before this handler runs.
const MAX_BODY_BYTES = 4.5 * 1024 * 1024;

/**
 * Payment slip upload: a byte-for-byte multipart passthrough (the browser's boundary is kept) to
 * the backend's PRIVATE finance storage. Answers `{ data: { path } }`; never a URL.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const contentType = request.headers.get('content-type');
    if (!contentType || !contentType.toLowerCase().startsWith('multipart/form-data')) {
      return financeJson({ error: 'validation' }, 400);
    }
    if (Number(request.headers.get('content-length')) > MAX_BODY_BYTES) {
      return financeJson({ error: 'finance.attachmentTooLarge' }, 413);
    }

    const auth = await requireFinance();
    if ('response' in auth) return auth.response;

    const body = await request.arrayBuffer();
    if (body.byteLength > MAX_BODY_BYTES) return financeJson({ error: 'finance.attachmentTooLarge' }, 413);

    const response = await financeBackendFetch(
      auth.token,
      '/finance/attachments',
      { method: 'POST', headers: { 'Content-Type': contentType }, body },
      { clientIp: clientIpFrom(request.headers) },
    );
    return await relayFinance(response);
  } catch (error) {
    return bffErrorResponse(error, 'Finance attachment upload failed', { error: 'network', status: 503 });
  }
}
