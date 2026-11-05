import { describe, expect, it, vi } from 'vitest';

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

describe('proxy finance lockdown', () => {
  it('redirects a RESIDENT away from /finance and forbids /api/finance', () => {
    const page = proxy(request('/finance/flats/x', 'RESIDENT'));
    expect(page.status).toBe(307);
    expect(page.headers.get('location')).toBe('https://web.test/home');
    expect(proxy(request('/api/finance/payments', 'RESIDENT')).status).toBe(403);
  });

  it.each(['/home/finance', '/api/me/finance/flats'])('keeps %s open to a RESIDENT', (path) => {
    expect(proxy(request(path, 'RESIDENT')).headers.get('x-middleware-next')).toBe('1');
  });

  it.each(['/finance', '/home', '/profile', '/notifications', '/api/finance/x', '/api/me/finance/x', '/api/auth/session', '/api/profile', '/api/notifications'])(
    'lets an ACCOUNTANT reach %s',
    (path) => {
      expect(proxy(request(path, 'ACCOUNTANT')).headers.get('x-middleware-next')).toBe('1');
    },
  );

  it.each(['/orders', '/cart', '/checkout', '/merchant', '/admin', '/directory', '/directory/shop-1', '/announcements'])(
    'redirects an ACCOUNTANT away from %s',
    (path) => {
      const response = proxy(request(path, 'ACCOUNTANT'));
      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toBe('https://web.test/home');
    },
  );

  it.each(['/api/orders', '/api/admin/polls', '/api/shops'])('returns 403 to an ACCOUNTANT for %s', (path) => {
    expect(proxy(request(path, 'ACCOUNTANT')).status).toBe(403);
  });

  it.each(['/finance', '/admin', '/directory'])('leaves ADMIN unrestricted on %s', (path) => {
    expect(proxy(request(path, 'ADMIN')).headers.get('x-middleware-next')).toBe('1');
  });
});

describe('proxy ACCOUNTANT confinement', () => {
  it.each(['/orders', '/directory', '/merchant', '/admin', '/cart'])('redirects an ACCOUNTANT away from %s', (path) => {
    const response = proxy(request(path, 'ACCOUNTANT'));
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('https://web.test/home');
  });

  it.each(['/finance', '/profile', '/api/finance/payments'])('lets an ACCOUNTANT reach %s', (path) => {
    expect(proxy(request(path, 'ACCOUNTANT')).headers.get('x-middleware-next')).toBe('1');
  });
});

describe('proxy with the resident lockdown flag off', () => {
  async function proxyWithFlagOff() {
    vi.resetModules();
    vi.doMock('@/config/access-policy', async (importOriginal) => {
      const actual = await importOriginal<typeof import('@/config/access-policy')>();
      return {
        ...actual,
        RESIDENT_HOME_ONLY: false,
        isRestrictedRole: (role: string | null | undefined) => actual.isRestrictedRole(role, false),
        isPathAllowedForRole: (role: string | null | undefined, path: string, kind: 'page' | 'api') =>
          actual.isPathAllowedForRole(role, path, kind, false),
      };
    });
    return (await import('./proxy')).proxy;
  }

  it('still confines an ACCOUNTANT', async () => {
    const flagOff = await proxyWithFlagOff();
    expect(flagOff(request('/orders', 'ACCOUNTANT')).status).toBe(307);
    expect(flagOff(request('/api/orders', 'ACCOUNTANT')).status).toBe(403);
    expect(flagOff(request('/finance', 'ACCOUNTANT')).headers.get('x-middleware-next')).toBe('1');
  });

  it.each(['RESIDENT', 'MERCHANT', 'ADMIN'])('lets a %s through', async (role) => {
    const flagOff = await proxyWithFlagOff();
    expect(flagOff(request('/orders', role)).headers.get('x-middleware-next')).toBe('1');
    expect(flagOff(request('/api/orders', role)).headers.get('x-middleware-next')).toBe('1');
  });
});
