import { NextRequest, NextResponse } from 'next/server';

import { financeErrorResponse, requireFinance, financeBackendFetch } from '@/lib/api/finance.server';
import { loginPath } from '@/lib/auth/return-path';
import { clientIpFrom } from '@/lib/auth/server';
import { financeIdSchema } from '@/lib/finance/schemas';

export const maxDuration = 30;
export const dynamic = 'force-dynamic';

/** Never stored anywhere, and the signed URL never leaks through a Referer. */
const REDIRECT_HEADERS = { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } as const;

function redirectTo(location: string | URL): NextResponse {
  return new NextResponse(null, { status: 302, headers: { ...REDIRECT_HEADERS, Location: String(location) } });
}

/** Only absolute https URLs (plain http only outside production, for local MinIO). */
function safeSignedUrl(value: unknown): URL | null {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    if (url.protocol === 'https:') return url;
    if (url.protocol === 'http:' && process.env.NODE_ENV !== 'production') return url;
    return null;
  } catch {
    // Never rethrow or log: a URL error would carry the signed URL.
    return null;
  }
}

/**
 * "View slip": asks the backend for a 60-second signed URL (each issue is audited there) and answers
 * with a 302 to it. The URL is never cached, logged, or returned in a body. A failure goes back to
 * the payment page with `?slip=<code>` so the desk can say why.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const paymentId = financeIdSchema.safeParse(request.nextUrl.searchParams.get('paymentId'));
  if (!paymentId.success) return redirectTo(new URL('/finance/payments', request.url));
  const paymentPath = `/finance/payments/${encodeURIComponent(paymentId.data)}`;
  const back = (code: string) => {
    const url = new URL(paymentPath, request.url);
    url.searchParams.set('slip', code);
    return redirectTo(url);
  };

  try {
    const auth = await requireFinance();
    if ('response' in auth) {
      if (auth.response.status === 401) return redirectTo(new URL(loginPath(paymentPath), request.url));
      return back(auth.response.status === 403 ? 'forbidden' : 'unavailable');
    }

    const response = await financeBackendFetch(
      auth.token,
      `/finance/attachments/signed-url?paymentId=${encodeURIComponent(paymentId.data)}`,
      { method: 'GET' },
      { clientIp: clientIpFrom(request.headers) },
    );
    if (!response.ok) {
      const relayed = (await (await financeErrorResponse(response)).json()) as { error?: string };
      return back(typeof relayed.error === 'string' ? relayed.error : 'unavailable');
    }
    const payload = (await response.json().catch(() => null)) as { data?: { url?: unknown } } | null;
    const url = safeSignedUrl(payload?.data?.url);
    if (!url) return back('unavailable');
    return redirectTo(url);
  } catch {
    return back('unavailable');
  }
}
