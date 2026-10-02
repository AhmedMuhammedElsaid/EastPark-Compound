import 'server-only';

import { NextResponse } from 'next/server';

/**
 * The BFF error vocabulary. Backend error bodies (messages, stacks, validation internals) are never
 * forwarded to the browser; only these codes and a safe status are.
 */
export type BffErrorCode =
  | 'conflict'
  | 'forbidden'
  | 'not_found'
  | 'rate_limited'
  | 'request_failed'
  | 'unauthorized'
  | 'upstream';

export function upstreamErrorCode(status: number): { error: BffErrorCode; status: number } {
  switch (status) {
    case 401:
      return { error: 'unauthorized', status };
    case 403:
      return { error: 'forbidden', status };
    case 404:
      return { error: 'not_found', status };
    case 409:
      return { error: 'conflict', status };
    case 429:
      return { error: 'rate_limited', status };
    case 400:
    case 413:
    case 415:
    case 422:
      return { error: 'request_failed', status };
    default:
      return { error: 'upstream', status: 502 };
  }
}

export function upstreamError(status: number): NextResponse<{ error: BffErrorCode }> {
  const mapped = upstreamErrorCode(status);
  return NextResponse.json({ error: mapped.error }, { status: mapped.status });
}

/**
 * Relays a backend response: successful JSON envelopes pass through unchanged (clients parse them),
 * 204 stays empty, and failures are mapped to the shared error vocabulary.
 */
export async function relayBackendResponse(response: Response): Promise<NextResponse> {
  if (!response.ok) return upstreamError(response.status);
  if (response.status === 204) return new NextResponse(null, { status: 204 });
  const payload: unknown = await response.json().catch(() => undefined);
  // An empty/non-JSON success keeps its 2xx status (clients may only check `response.ok`).
  if (payload === undefined) return NextResponse.json({ data: null }, { status: response.status });
  return NextResponse.json(payload, { status: response.status });
}
