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

describe('DELETE /api/admin/users/[id]', () => {
  const del = () => new Request('https://web.test/api/admin/users/u1', { method: 'DELETE' });
  const params = (id = 'u1') => ({ params: Promise.resolve({ id }) });

  it('forwards a bodyless DELETE for the super admin', async () => {
    asViewer('SUPER_ADMIN', () => json(200, { message: 'deleted' }));
    const { DELETE } = await import('@/app/api/admin/users/[id]/route');
    const response = await DELETE(del(), params());
    expect(response.status).toBe(200);
    const [[url, init]] = backendCalls();
    expect(String(url)).toBe('https://api.example.test/v1/admin/user/u1');
    expect(init?.method).toBe('DELETE');
    expect(init?.body).toBeUndefined();
    expect(new Headers(init?.headers).get('content-type')).toBeNull();
  });

  it('refuses a plain admin without calling the backend', async () => {
    asViewer('ADMIN');
    const { DELETE } = await import('@/app/api/admin/users/[id]/route');
    const response = await DELETE(del(), params());
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'super_admin_required' });
    expect(backendCalls()).toEqual([]);
  });

  it('rejects an empty id', async () => {
    asViewer('SUPER_ADMIN');
    const { DELETE } = await import('@/app/api/admin/users/[id]/route');
    const response = await DELETE(del(), params('  '));
    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    [403, 'cannot_delete_super_admin'],
    [404, 'not_found'],
    [409, 'delete_merchant_owns_shop'],
  ])('maps a backend %i to %s', async (status, code) => {
    asViewer('SUPER_ADMIN', () => json(status, { statusCode: status, message: 'translated prose' }));
    const { DELETE } = await import('@/app/api/admin/users/[id]/route');
    const response = await DELETE(del(), params());
    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ error: code });
  });
});

describe('GET /api/admin/trash', () => {
  it('forwards only validated params for the super admin', async () => {
    asViewer('SUPER_ADMIN');
    const { GET } = await import('@/app/api/admin/trash/route');
    const { NextRequest } = await import('next/server');
    const response = await GET(new NextRequest('https://web.test/api/admin/trash?type=PRODUCT&cursor=c1&evil=1'));
    expect(response.status).toBe(200);
    expect(backendCalls().map(([url]) => String(url))).toEqual([
      'https://api.example.test/v1/admin/trash?type=PRODUCT&cursor=c1&limit=20',
    ]);
  });

  it.each(['', '?type=user', '?type=ORDER', '?type=USER&limit=99'])('rejects %j with 400 and no backend call', async (search) => {
    asViewer('SUPER_ADMIN');
    const { GET } = await import('@/app/api/admin/trash/route');
    const { NextRequest } = await import('next/server');
    const response = await GET(new NextRequest(`https://web.test/api/admin/trash${search}`));
    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refuses a plain admin', async () => {
    asViewer('ADMIN');
    const { GET } = await import('@/app/api/admin/trash/route');
    const { NextRequest } = await import('next/server');
    const response = await GET(new NextRequest('https://web.test/api/admin/trash?type=USER'));
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'super_admin_required' });
    expect(backendCalls()).toEqual([]);
  });
});

describe('POST /api/admin/trash/[type]/[id]/restore', () => {
  const post = () => new Request('https://web.test/api/admin/trash/SHOP/s1/restore', { method: 'POST' });
  const params = (type: string, id: string) => ({ params: Promise.resolve({ type, id }) });

  it('forwards a bodyless POST for the super admin', async () => {
    asViewer('SUPER_ADMIN', () => json(200, { data: { type: 'SHOP', id: 's1', label: 'Bakery', restorable: true } }));
    const { POST } = await import('@/app/api/admin/trash/[type]/[id]/restore/route');
    const response = await POST(post(), params('SHOP_PHOTO', 'p1'));
    expect(response.status).toBe(200);
    const [[url, init]] = backendCalls();
    expect(String(url)).toBe('https://api.example.test/v1/admin/trash/SHOP_PHOTO/p1/restore');
    expect(init?.method).toBe('POST');
    expect(init?.body).toBeUndefined();
    expect(new Headers(init?.headers).get('content-type')).toBeNull();
  });

  it.each([
    ['user', 'u1'],
    ['ORDER', 'o1'],
    ['USER', '..'],
    ['USER', 'a/b'],
  ])('rejects type %s id %s with 400 and no backend call', async (type, id) => {
    asViewer('SUPER_ADMIN');
    const { POST } = await import('@/app/api/admin/trash/[type]/[id]/restore/route');
    const response = await POST(post(), params(type, id));
    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refuses a plain admin', async () => {
    asViewer('ADMIN');
    const { POST } = await import('@/app/api/admin/trash/[type]/[id]/restore/route');
    const response = await POST(post(), params('USER', 'u1'));
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'super_admin_required' });
    expect(backendCalls()).toEqual([]);
  });

  it.each([
    [403, 'super_admin_required'],
    [404, 'trash_not_found'],
    [409, 'restore_conflict'],
  ])('maps a backend %i to %s', async (status, code) => {
    asViewer('SUPER_ADMIN', () => json(status, { statusCode: status, message: 'translated prose' }));
    const { POST } = await import('@/app/api/admin/trash/[type]/[id]/restore/route');
    const response = await POST(post(), params('REVIEW', 'r1'));
    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ error: code });
  });
});
