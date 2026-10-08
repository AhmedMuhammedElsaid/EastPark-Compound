import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ cookies: new Map<string, string>() }));

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => {
      const value = state.cookies.get(name);
      return value === undefined ? undefined : { name, value };
    },
    set: vi.fn(),
    delete: vi.fn(),
  }),
  headers: async () => new Headers({ 'x-forwarded-for': '198.51.100.9' }),
}));

let backend: (url: string, init?: RequestInit) => Response;
const fetchMock = vi.fn(async (input: string | URL, init?: RequestInit) => backend(String(input), init));

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function profile(role: string) {
  return {
    id: 'me', name: 'Me', email: 'me@example.com', phone: null, unitNumber: null, avatarUrl: null,
    role, isVerified: true, createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z',
  };
}

function asViewer(role: string, other: (url: string, init?: RequestInit) => Response = () => json(200, { data: { items: [] } })) {
  backend = (url, init) => (url.endsWith('/user/profile') ? json(200, { data: profile(role) }) : other(url, init));
}

function backendCalls() {
  return fetchMock.mock.calls.filter(([url]) => !String(url).endsWith('/user/profile'));
}

beforeEach(() => {
  vi.resetModules();
  process.env.NEXT_PUBLIC_API_URL = 'https://api.example.test';
  state.cookies.clear();
  state.cookies.set('eastpark_access', 'access-1');
  fetchMock.mockClear();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('GET /api/admin/merchants', () => {
  it.each(['ADMIN', 'SUPER_ADMIN'])('forwards only validated params for %s', async (role) => {
    asViewer(role);
    const { GET } = await import('@/app/api/admin/merchants/route');
    const { NextRequest } = await import('next/server');
    const response = await GET(new NextRequest('https://web.test/api/admin/merchants?q=%20mona%20&cursor=m1&role=ADMIN'));
    expect(response.status).toBe(200);
    expect(backendCalls().map(([url]) => String(url))).toEqual([
      'https://api.example.test/v1/admin/user/merchants?cursor=m1&limit=20&q=mona',
    ]);
  });

  it.each(['MERCHANT', 'RESIDENT'])('refuses %s without calling the backend', async (role) => {
    asViewer(role);
    const { GET } = await import('@/app/api/admin/merchants/route');
    const { NextRequest } = await import('next/server');
    const response = await GET(new NextRequest('https://web.test/api/admin/merchants'));
    expect(response.status).toBe(403);
    expect(backendCalls()).toEqual([]);
  });

  it('rejects an out-of-range limit', async () => {
    asViewer('ADMIN');
    const { GET } = await import('@/app/api/admin/merchants/route');
    const { NextRequest } = await import('next/server');
    const response = await GET(new NextRequest('https://web.test/api/admin/merchants?limit=99'));
    expect(response.status).toBe(400);
  });
});

describe('POST /api/admin/shops', () => {
  const post = (body: unknown) => new Request('https://web.test/api/admin/shops', { method: 'POST', body: JSON.stringify(body) });
  const valid = {
    merchantId: 'm1', name: ' Corner Cafe ', nameAr: 'كافيه الزاوية', description: '', descriptionAr: '  ',
    category: 'CAFE_AND_FOOD', phone: '01012345678', whatsapp: '', deliveryTime: 25,
    workingHours: { mon: { open: '09:00', close: '22:00', closed: false } },
    isOpen: false, evil: true,
  };

  it('forwards a cleaned body with no unknown keys (never isOpen)', async () => {
    asViewer('ADMIN', () => json(201, { data: { id: 's1' } }));
    const { POST } = await import('@/app/api/admin/shops/route');
    const response = await POST(post(valid));
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ data: { id: 's1' } });
    const [[url, init]] = backendCalls();
    expect(String(url)).toBe('https://api.example.test/v1/shops');
    expect(init?.method).toBe('POST');
    expect(JSON.parse(String(init?.body))).toEqual({
      merchantId: 'm1', name: 'Corner Cafe', nameAr: 'كافيه الزاوية', category: 'CAFE_AND_FOOD',
      phone: '+201012345678', deliveryTime: 25,
      workingHours: { mon: { open: '09:00', close: '22:00', closed: false } },
    });
  });

  it.each([
    ['a missing merchant', { ...valid, merchantId: '' }],
    ['an unknown category', { ...valid, category: 'BAKERY' }],
    ['a malformed phone', { ...valid, phone: '12345' }],
    ['a bad working-hours time', { ...valid, workingHours: { mon: { open: '9am', close: '22:00', closed: false } } }],
    ['a zero delivery time', { ...valid, deliveryTime: 0 }],
  ])('rejects %s before calling the backend', async (_, body) => {
    asViewer('ADMIN');
    const { POST } = await import('@/app/api/admin/shops/route');
    const response = await POST(post(body));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'validation' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    [400, 'shop.error.merchantInvalid', 'merchant_invalid'],
    [409, 'shop.error.merchantHasShop', 'merchant_has_shop'],
    [400, 'validation.error.phone', 'request_failed'],
    [409, 'something.else', 'conflict'],
    [403, 'auth.error.insufficientPermissions', 'forbidden'],
  ])('maps a backend %i %s to %s', async (status, code, error) => {
    asViewer('ADMIN', () => json(status, { statusCode: status, code, message: 'translated prose' }));
    const { POST } = await import('@/app/api/admin/shops/route');
    const response = await POST(post(valid));
    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ error });
  });

  it('refuses a merchant', async () => {
    asViewer('MERCHANT');
    const { POST } = await import('@/app/api/admin/shops/route');
    const response = await POST(post(valid));
    expect(response.status).toBe(403);
    expect(backendCalls()).toEqual([]);
  });
});

describe('POST /api/admin/shops/[id]/photos', () => {
  const post = (body: unknown) => new Request('https://web.test/api/admin/shops/s1/photos', { method: 'POST', body: JSON.stringify(body) });
  const params = { params: Promise.resolve({ id: 's1' }) };

  it('attaches the photo as the cover (order 0)', async () => {
    asViewer('SUPER_ADMIN', () => json(201, { data: { id: 's1' } }));
    const { POST } = await import('@/app/api/admin/shops/[id]/photos/route');
    const response = await POST(post({ url: 'https://cdn.example.test/shop.png', order: 7 }), params);
    expect(response.status).toBe(201);
    const [[url, init]] = backendCalls();
    expect(String(url)).toBe('https://api.example.test/v1/shops/s1/photos');
    expect(JSON.parse(String(init?.body))).toEqual({ url: 'https://cdn.example.test/shop.png', order: 0 });
  });

  it.each([{ url: 'javascript:alert(1)' }, { url: 'not a url' }, {}])('rejects %j', async (body) => {
    asViewer('ADMIN');
    const { POST } = await import('@/app/api/admin/shops/[id]/photos/route');
    const response = await POST(post(body), params);
    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('POST /api/uploads/image?purpose=shop', () => {
  it('accepts the shop purpose and forwards it', async () => {
    backend = () => json(201, { data: { url: 'https://cdn.example.test/shop.png', path: 'shops/shop.png' } });
    const { POST } = await import('@/app/api/uploads/image/route');
    const { NextRequest } = await import('next/server');
    const form = new FormData();
    form.set('file', new Blob([new Uint8Array([137, 80, 78, 71])], { type: 'image/png' }), 'shop.png');
    const request = new NextRequest('https://web.test/api/uploads/image?purpose=shop', { method: 'POST', body: form });
    const response = await POST(request);
    expect(response.status).toBe(200);
    expect(String(fetchMock.mock.calls.at(-1)?.[0])).toBe('https://api.example.test/v1/uploads/image?purpose=shop');
  });

  it('still rejects an unknown purpose', async () => {
    const { POST } = await import('@/app/api/uploads/image/route');
    const { NextRequest } = await import('next/server');
    const form = new FormData();
    form.set('file', new Blob(['x'], { type: 'image/png' }), 'x.png');
    const response = await POST(new NextRequest('https://web.test/api/uploads/image?purpose=candidate', { method: 'POST', body: form }));
    expect(response.status).toBe(400);
  });
});
