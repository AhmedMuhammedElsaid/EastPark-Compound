import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { bffErrorResponse } from '@/lib/api/bff-errors';
import { financeBackendFetch, financeJson, relayFinance, requireFinance } from '@/lib/api/finance.server';
import { clientIpFrom } from '@/lib/auth/server';
import {
  applyCreditSchema,
  asOfQuerySchema,
  auditQuerySchema,
  chargeCreateSchema,
  chequeDateSchema,
  emptyQuerySchema,
  financeIdSchema,
  flatsQuerySchema,
  IDEMPOTENCY_HEADER,
  IDEMPOTENCY_KEY_PATTERN,
  paymentCreateSchema,
  paymentsQuerySchema,
  periodsQuerySchema,
  voidSchema,
} from '@/lib/finance/schemas';

export const maxDuration = 30;
export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ path?: string[] }> };

type FinanceRoute = {
  backendPath: string;
  query?: z.ZodType<Record<string, unknown>>;
  body?: z.ZodType;
  /** POST /finance/payments: the client's `Idempotency-Key` is required and forwarded unchanged. */
  idempotent?: boolean;
};

/**
 * The finance desk BFF: an explicit table of the backend's `/v1/finance/*` routes (nothing else is
 * reachable). Query strings and bodies are re-built from validated values; ids are validated and
 * encoded. Attachments have their own routes (`attachments/route.ts`, `attachments/view`).
 */
function routeFor(method: string, path: readonly string[]): FinanceRoute | null {
  const [head, id, action, extra] = path;
  if (extra !== undefined) return null;
  if (id !== undefined && !financeIdSchema.safeParse(id).success) return null;
  const at = id === undefined ? '' : `/${encodeURIComponent(id)}`;

  if (head === 'flats') {
    if (method === 'GET' && id === undefined) return { backendPath: '/finance/flats', query: flatsQuerySchema };
    if (method === 'GET' && action === undefined) return { backendPath: `/finance/flats${at}`, query: asOfQuerySchema };
    if (method === 'GET' && action === 'ownership') return { backendPath: `/finance/flats${at}/ownership` };
    if (method === 'POST' && action === 'apply-credit') return { backendPath: `/finance/flats${at}/apply-credit`, body: applyCreditSchema };
    return null;
  }
  if (head === 'charges') {
    if (method === 'POST' && id === undefined) return { backendPath: '/finance/charges', body: chargeCreateSchema };
    if (method === 'POST' && action === 'void') return { backendPath: `/finance/charges${at}/void`, body: voidSchema };
    return null;
  }
  if (head === 'payments') {
    if (method === 'GET' && id === undefined) return { backendPath: '/finance/payments', query: paymentsQuerySchema };
    if (method === 'POST' && id === undefined) return { backendPath: '/finance/payments', body: paymentCreateSchema, idempotent: true };
    if (method === 'GET' && action === undefined && id !== undefined) return { backendPath: `/finance/payments${at}` };
    if (method === 'POST' && action === 'void') return { backendPath: `/finance/payments${at}/void`, body: voidSchema };
    if (method === 'POST' && (action === 'cheque-cleared' || action === 'cheque-bounced')) {
      return { backendPath: `/finance/payments${at}/${action}`, body: chequeDateSchema };
    }
    return null;
  }
  if (id !== undefined || method !== 'GET') return null;
  if (head === 'audit') return { backendPath: '/finance/audit', query: auditQuerySchema };
  if (head === 'periods') return { backendPath: '/finance/periods', query: periodsQuerySchema };
  if (head === 'settings') return { backendPath: '/finance/settings', query: emptyQuerySchema };
  return null;
}

function toQuery(values: Record<string, unknown>): string {
  const entries = Object.entries(values)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([key, value]) => [key, String(value)]);
  const query = new URLSearchParams(entries).toString();
  return query ? `?${query}` : '';
}

async function proxy(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  try {
    const route = routeFor(request.method, (await context.params).path ?? []);
    if (!route) return financeJson({ error: 'not_found' }, 404);

    let query = '';
    if (request.method === 'GET') {
      const parsed = (route.query ?? emptyQuerySchema).safeParse(Object.fromEntries(request.nextUrl.searchParams));
      if (!parsed.success) return financeJson({ error: 'validation' }, 400);
      query = toQuery(parsed.data as Record<string, unknown>);
    }

    const headers: Record<string, string> = {};
    if (route.idempotent) {
      const key = request.headers.get(IDEMPOTENCY_HEADER)?.trim();
      if (!key || !IDEMPOTENCY_KEY_PATTERN.test(key)) return financeJson({ error: 'finance.idempotencyKeyRequired' }, 400);
      headers[IDEMPOTENCY_HEADER] = key;
    }

    let body: string | undefined;
    if (route.body) {
      const parsed = route.body.safeParse(await request.json().catch(() => null));
      if (!parsed.success) return financeJson({ error: 'validation' }, 400);
      body = JSON.stringify(parsed.data);
      headers['Content-Type'] = 'application/json';
    }

    const auth = await requireFinance();
    if ('response' in auth) return auth.response;

    const response = await financeBackendFetch(
      auth.token,
      `${route.backendPath}${query}`,
      { method: request.method, headers, body },
      { clientIp: clientIpFrom(request.headers) },
    );
    return await relayFinance(response);
  } catch (error) {
    return bffErrorResponse(error, 'Finance proxy failed', { error: 'network', status: 503 });
  }
}

export const GET = proxy;
export const POST = proxy;
