import { describe, expect, it } from 'vitest';

import { NextRequest } from 'next/server';

import { proxy } from './proxy';

function tokenFor(role: string): string {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'HS256' })}.${encode({ role })}.signature`;
}

function request(path: string, role: string): NextRequest {
  return new NextRequest(`https://web.test${path}`, { headers: { cookie: `eastpark_access=${tokenFor(role)}` } });
}

describe('proxy home-only lockdown', () => {
  it.each(['/merchant', '/merchant/orders', '/api/merchant/orders'])('lets a MERCHANT through to %s', (path) => {
    const response = proxy(request(path, 'MERCHANT'));
    expect(response.headers.get('x-middleware-next')).toBe('1');
  });

  it('redirects a RESIDENT away from merchant pages and forbids the merchant BFF', async () => {
    const page = proxy(request('/merchant', 'RESIDENT'));
    expect(page.status).toBe(307);
    expect(page.headers.get('location')).toBe('https://web.test/home');
    const api = proxy(request('/api/merchant/orders', 'RESIDENT'));
    expect(api.status).toBe(403);
  });
});
