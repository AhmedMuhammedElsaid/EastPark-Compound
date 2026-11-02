import 'server-only';

import { NextResponse } from 'next/server';

import { knownBackendCode, PRIVATE_NO_STORE, upstreamError } from '@/lib/api/bff-errors';
import { getFinanceSession } from '@/lib/auth/finance.server';
import { backendFetch, bearer, type BackendContext } from '@/lib/auth/server';
import { financeCodeFromBackend } from '@/lib/finance/errors';

type FinanceAuth = { token: string } | { response: NextResponse<{ error: string }> };

export function financeJson<T>(body: T, status = 200): NextResponse<T> {
  return NextResponse.json(body, { status, headers: PRIVATE_NO_STORE });
}

/** Route-handler guard for the finance BFF: ACCOUNTANT, ADMIN, SUPER_ADMIN (backend re-checks). */
export async function requireFinance(): Promise<FinanceAuth> {
  const session = await getFinanceSession(true);
  if (session.status === 'authenticated') return { token: session.token };
  if (session.status === 'forbidden') return { response: financeJson({ error: 'forbidden' }, 403) };
  if (session.status === 'rate_limited') {
    return { response: financeJson({ error: 'rate_limited' }, 429) };
  }
  if (session.status === 'unavailable') return { response: financeJson({ error: 'network' }, 503) };
  return { response: financeJson({ error: 'unauthorized' }, 401) };
}

/**
 * A failed backend answer as a BFF code: allowlisted finance keys (`finance.<key>`) and the shared
 * known codes; otherwise the status vocabulary. The backend's message, stack and validation
 * details are never relayed.
 */
export async function financeErrorResponse(response: Response): Promise<NextResponse> {
  const body: unknown = await response.json().catch(() => undefined);
  if (response.status < 500) {
    const shared = knownBackendCode(body);
    if (shared) return financeJson({ error: shared }, response.status);
    const code = financeCodeFromBackend((body as { code?: unknown } | undefined)?.code);
    if (code) return financeJson({ error: code }, response.status);
  }
  return upstreamError(response.status);
}

/** Relays a finance answer: only `{ data }` on success (no backend message), codes on failure. */
export async function relayFinance(response: Response): Promise<NextResponse> {
  if (!response.ok) return financeErrorResponse(response);
  const payload = (await response.json().catch(() => undefined)) as { data?: unknown } | undefined;
  return financeJson({ data: payload?.data ?? null }, response.status);
}

/** Authenticated call to `/v1/finance...` with the session's bearer token. */
export async function financeBackendFetch(
  token: string,
  path: string,
  init: RequestInit,
  context: BackendContext,
): Promise<Response> {
  return backendFetch(path, { ...init, headers: { ...Object.fromEntries(new Headers(init.headers)), ...bearer(token) } }, context);
}
