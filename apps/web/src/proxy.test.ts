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

  it.each(['/profile', '/api/profile', '/api/uploads/image'])('lets a RESIDENT reach %s', (path) => {
    const response = proxy(request(path, 'RESIDENT'));
    expect(response.headers.get('x-middleware-next')).toBe('1');
  });

  it.each(['/directory', '/directory/shop-1', '/directory/shop-1/menu', '/api/shops', '/api/shops/shop-1/reviews', '/api/shops/shop-1/save'])('lets a RESIDENT reach %s', (path) => {
    const response = proxy(request(path, 'RESIDENT'));
    expect(response.headers.get('x-middleware-next')).toBe('1');
  });

  it.each(['/cart', '/checkout', '/orders', '/notifications'])('still redirects a RESIDENT away from %s', (path) => {
    const response = proxy(request(path, 'RESIDENT'));
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('https://web.test/home');
  });

  it.each(['/api/orders', '/api/orders/1/cancel', '/api/notifications'])('still returns 403 to a RESIDENT for %s', (path) => {
    expect(proxy(request(path, 'RESIDENT')).status).toBe(403);
  });
});
