import 'server-only';

import { NextResponse } from 'next/server';

import { BackendRateLimitedError, BackendUnavailableError } from '@/lib/auth/server';

/**
 * The BFF error vocabulary. Backend error bodies (messages, stacks, validation internals) are never
 * forwarded to the browser; only these codes and a safe status are.
 */
/**
 * BFF responses are per-user (or at least never shareable): browsers, proxies and CDNs must not store
 * them. Without an explicit header Vercel sends `public, max-age=0, must-revalidate`.
 */
export const PRIVATE_NO_STORE = { 'Cache-Control': 'private, no-store' } as const;

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
  return NextResponse.json({ error: mapped.error }, { status: mapped.status, headers: PRIVATE_NO_STORE });
}

/**
 * Backend error codes (untranslated message keys) that a client must tell apart from other errors
 * with the same status, mapped to BFF codes. Only allowlisted keys are ever forwarded.
 */
const KNOWN_BACKEND_CODES: Record<string, string> = {
  'user.error.accountDeleted': 'account_deleted',
};

/**
 * The BFF code for a backend error body, or undefined. Reads the backend's stable `code`, falling
 * back to `message` (backends before the `code` field returned the raw key there).
 */
export function knownBackendCode(body: unknown): string | undefined {
  if (!body || typeof body !== 'object') return undefined;
  const { code, message } = body as { code?: unknown; message?: unknown };
  for (const key of [code, message]) {
    if (typeof key === 'string' && Object.hasOwn(KNOWN_BACKEND_CODES, key)) return KNOWN_BACKEND_CODES[key];
  }
  return undefined;
}

/** Reads a failed backend response's body (consuming it) and returns its known BFF code, if any. */
export async function knownBackendErrorCode(response: Response): Promise<string | undefined> {
  if (response.ok) return undefined;
  return knownBackendCode(await response.json().catch(() => undefined));
}

/**
 * Relays a backend response: successful JSON envelopes pass through unchanged (clients parse them),
 * 204 stays empty, and failures are mapped to the shared error vocabulary.
 */
export async function relayBackendResponse(response: Response): Promise<NextResponse> {
  if (!response.ok) return upstreamError(response.status);
  if (response.status === 204) return new NextResponse(null, { status: 204, headers: PRIVATE_NO_STORE });
  const payload: unknown = await response.json().catch(() => undefined);
  // An empty/non-JSON success keeps its 2xx status (clients may only check `response.ok`).
  const init = { status: response.status, headers: PRIVATE_NO_STORE };
  if (payload === undefined) return NextResponse.json({ data: null }, init);
  return NextResponse.json(payload, init);
}

/**
 * For a route's catch block: a session refresh the backend throttled (`BackendRateLimitedError`)
 * is `rate_limited`/429, never an outage. Returns null for any other error.
 */
export function rateLimitedResponse(error: unknown): NextResponse<{ error: BffErrorCode }> | null {
  if (!(error instanceof BackendRateLimitedError)) return null;
  return NextResponse.json({ error: 'rate_limited' }, { status: 429, headers: { ...PRIVATE_NO_STORE, 'Retry-After': '60' } });
}

/** A backend call that failed with an HTTP status; route catch blocks map it with `bffErrorResponse`. */
export class UpstreamStatusError extends Error {
  constructor(
    readonly status: number,
    label = 'Backend request',
  ) {
    super(`${label} failed with ${status}`);
    this.name = 'UpstreamStatusError';
  }
}

/** The backend status carried by a request error (`UpstreamStatusError` and the per-module request errors). */
function upstreamStatusOf(error: unknown): number | undefined {
  // Transport failures and 5xx from the refresh call are outages, not a mappable backend answer.
  if (!(error instanceof Error) || error instanceof BackendUnavailableError) return undefined;
  const status = (error as { status?: unknown }).status;
  return typeof status === 'number' && Number.isInteger(status) ? status : undefined;
}

/**
 * The shared catch-block mapping for BFF routes:
 * - a throttled session refresh or backend 429 → `rate_limited` (429), never an outage or logout;
 * - an error carrying a backend status → the shared code vocabulary (`upstreamError`);
 * - anything else (transport failure, contract drift) → `fallback` (default `upstream`/502).
 * Only codes reach the browser; details are logged server-side.
 */
export function bffErrorResponse(
  error: unknown,
  label: string,
  fallback: { error: string; status: number } = { error: 'upstream', status: 502 },
): NextResponse<{ error: string }> {
  const throttled = rateLimitedResponse(error);
  if (throttled) return throttled;
  const status = upstreamStatusOf(error);
  if (status === 429) return rateLimitedResponse(new BackendRateLimitedError())!;
  if (status !== undefined) {
    if (status >= 500) console.error(label, error);
    return upstreamError(status);
  }
  console.error(label, error);
  return NextResponse.json({ error: fallback.error }, { status: fallback.status, headers: PRIVATE_NO_STORE });
}
