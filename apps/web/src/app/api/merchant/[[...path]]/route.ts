import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { relayBackendResponse } from '@/lib/api/bff-errors';
import { backendFetch, bearer, clientIpFrom } from '@/lib/auth/server';
import { requireMerchant } from '@/lib/auth/merchant.server';
import {
  orderStatusSchema,
  productInputSchema,
  productUpdateSchema,
  shopUpdateSchema,
} from '@/lib/schemas/merchant';

export const maxDuration = 30;

const paramsSchema = z.object({ path: z.array(z.string()).default([]) });
const productQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  search: z.string().trim().max(120).optional(),
  isAvailable: z.enum(['true', 'false']).optional(),
});
const orderQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  status: orderStatusSchema.optional(),
});

type RouteContext = { params: Promise<{ path?: string[] }> };

/** Query string from parsed params: drops absent values and stringifies numbers (e.g. `limit`). */
function toQuery(values: Record<string, unknown>): string {
  const entries = Object.entries(values)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([key, value]) => [key, String(value)]);
  return `?${new URLSearchParams(entries).toString()}`;
}

function routeFor(method: string, path: string[]): { backendPath: string; body?: z.ZodType } | null {
  if (path.length === 0 && method === 'GET') return { backendPath: '/merchant/shop' };
  if (path.length === 0 && method === 'PATCH') return { backendPath: '/merchant/shop', body: shopUpdateSchema };
  if (path[0] === 'products' && path.length === 1 && method === 'GET') return { backendPath: '/merchant/products' };
  if (path[0] === 'products' && path.length === 1 && method === 'POST') return { backendPath: '/merchant/products', body: productInputSchema };
  if (path[0] === 'products' && path.length === 2 && method === 'PATCH') return { backendPath: `/merchant/products/${encodeURIComponent(path[1]!)}`, body: productUpdateSchema };
  if (path[0] === 'products' && path.length === 2 && method === 'DELETE') return { backendPath: `/merchant/products/${encodeURIComponent(path[1]!)}` };
  if (path[0] === 'orders' && path.length === 1 && method === 'GET') return { backendPath: '/merchant/orders' };
  if (path[0] === 'orders' && path.length === 2 && method === 'GET') return { backendPath: `/merchant/orders/${encodeURIComponent(path[1]!)}` };
  if (path[0] === 'orders' && path.length === 3 && path[2] === 'status' && method === 'PATCH') {
    return { backendPath: `/merchant/orders/${encodeURIComponent(path[1]!)}/status`, body: z.object({ status: orderStatusSchema.exclude(['PLACED']) }) };
  }
  return null;
}

async function proxy(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  try {
    const parsedParams = paramsSchema.safeParse({ path: (await context.params).path ?? [] });
    if (!parsedParams.success) return NextResponse.json({ error: 'invalid_path' }, { status: 400 });

    const route = routeFor(request.method, parsedParams.data.path);
    if (!route) return NextResponse.json({ error: 'not_found' }, { status: 404 });

    const auth = await requireMerchant();
    if ('response' in auth) return auth.response;

    let query = '';
    if (request.method === 'GET' && parsedParams.data.path[0] === 'products') {
      const result = productQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
      if (!result.success) return NextResponse.json({ error: 'validation' }, { status: 400 });
      query = toQuery(result.data);
    } else if (request.method === 'GET' && parsedParams.data.path[0] === 'orders' && parsedParams.data.path.length === 1) {
      const result = orderQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
      if (!result.success) return NextResponse.json({ error: 'validation' }, { status: 400 });
      query = toQuery(result.data);
    }

    let body: string | undefined;
    if (route.body) {
      // Malformed JSON is a validation error, not a network failure.
      const result = route.body.safeParse(await request.json().catch(() => null));
      if (!result.success) return NextResponse.json({ error: 'validation' }, { status: 400 });
      body = JSON.stringify(result.data);
    }

    const response = await backendFetch(`${route.backendPath}${query}`, {
      method: request.method,
      headers: { ...bearer(auth.token), ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body,
    }, { clientIp: clientIpFrom(request.headers) });
    return relayBackendResponse(response);
  } catch {
    return NextResponse.json({ error: 'network' }, { status: 503 });
  }
}

export const GET = proxy;
export const POST = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
