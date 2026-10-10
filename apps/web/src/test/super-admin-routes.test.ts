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

/** Backend stub: the profile call answers with `role`, every other call with `other`. */
function asViewer(role: string, other: (url: string, init?: RequestInit) => Response = () => json(200, { data: { items: [] } })) {
  backend = (url, init) => (url.endsWith('/user/profile') ? json(200, { data: profile(role) }) : other(url, init));
}

function backendCalls(): string[] {
  return fetchMock.mock.calls.map(([url]) => String(url)).filter((url) => !url.endsWith('/user/profile'));
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

describe('GET /api/admin/users', () => {
  it('forwards only validated params to the backend for the super admin', async () => {
    asViewer('SUPER_ADMIN');
    const { GET } = await import('@/app/api/admin/users/route');
    const { NextRequest } = await import('next/server');
    const response = await GET(new NextRequest('https://web.test/api/admin/users?q=%20sam%20&role=ADMIN&evil=1'));
    expect(response.status).toBe(200);
    const [url] = backendCalls();
    expect(url).toBe('https://api.example.test/v1/admin/user?limit=20&q=sam&role=ADMIN');
  });

  it('returns 403 super_admin_required to a plain admin without calling the backend', async () => {
    asViewer('ADMIN');
    const { GET } = await import('@/app/api/admin/users/route');
    const { NextRequest } = await import('next/server');
    const response = await GET(new NextRequest('https://web.test/api/admin/users'));
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'super_admin_required' });
    expect(backendCalls()).toEqual([]);
  });

  it('rejects an unknown role filter', async () => {
    asViewer('SUPER_ADMIN');
    const { GET } = await import('@/app/api/admin/users/route');
    const { NextRequest } = await import('next/server');
    const response = await GET(new NextRequest('https://web.test/api/admin/users?role=OWNER'));
    expect(response.status).toBe(400);
  });
});

describe('PATCH /api/admin/users/[id]/role', () => {
  const patch = (body: unknown) =>
    new Request('https://web.test/api/admin/users/u1/role', { method: 'PATCH', body: JSON.stringify(body) });
  const params = { params: Promise.resolve({ id: 'u1' }) };

  it.each(['SUPER_ADMIN', 'GUEST', 'OWNER'])('rejects role %s before calling the backend', async (role) => {
    asViewer('SUPER_ADMIN');
    const { PATCH } = await import('@/app/api/admin/users/[id]/role/route');
    const response = await PATCH(patch({ role }), params);
    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('forwards an assignable role', async () => {
    asViewer('SUPER_ADMIN', () => json(200, { data: { id: 'u1', role: 'ADMIN' } }));
    const { PATCH } = await import('@/app/api/admin/users/[id]/role/route');
    const response = await PATCH(patch({ role: 'ADMIN', extra: true }), params);
    expect(response.status).toBe(200);
    const call = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/admin/user/u1/role'));
    expect(call?.[1]?.method).toBe('PATCH');
    expect(call?.[1]?.body).toBe(JSON.stringify({ role: 'ADMIN' }));
  });

  it.each([
    [403, 'cannot_change_super_admin'],
    [404, 'not_found'],
    [409, 'merchant_owns_shop'],
  ])('maps a backend %i to %s', async (status, code) => {
    asViewer('SUPER_ADMIN', () => json(status, { statusCode: status, message: 'translated prose' }));
    const { PATCH } = await import('@/app/api/admin/users/[id]/role/route');
    const response = await PATCH(patch({ role: 'RESIDENT' }), params);
    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ error: code });
  });

  it('refuses a plain admin', async () => {
    asViewer('ADMIN');
    const { PATCH } = await import('@/app/api/admin/users/[id]/role/route');
    const response = await PATCH(patch({ role: 'ADMIN' }), params);
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'super_admin_required' });
    expect(backendCalls()).toEqual([]);
  });
});

describe('GET /api/admin/activity', () => {
  it('forwards cursor and actor filter for the super admin', async () => {
    asViewer('SUPER_ADMIN');
    const { GET } = await import('@/app/api/admin/activity/route');
    const { NextRequest } = await import('next/server');
    const response = await GET(new NextRequest('https://web.test/api/admin/activity?cursor=c1&actorId=a1&limit=99'));
    expect(response.status).toBe(400);
    const ok = await GET(new NextRequest('https://web.test/api/admin/activity?cursor=c1&actorId=a1'));
    expect(ok.status).toBe(200);
    expect(backendCalls()).toEqual(['https://api.example.test/v1/admin/activity?cursor=c1&limit=20&actorId=a1']);
  });
});

describe('admin routes accept SUPER_ADMIN', () => {
  it('lets the super admin through the shared admin guard', async () => {
    asViewer('SUPER_ADMIN', () => json(200, { data: { items: [] } }));
    const { GET } = await import('@/app/api/admin/residents/leads/route');
    const { NextRequest } = await import('next/server');
    const response = await GET(new NextRequest('https://web.test/api/admin/residents/leads'));
    expect(response.status).toBe(200);
  });
});

describe('GET /api/admin/residents/leads q', () => {
  it('forwards a trimmed q (capped at 100) with status and cursor, and drops an empty one', async () => {
    asViewer('ADMIN', () => json(200, { data: { items: [] } }));
    const { GET } = await import('@/app/api/admin/residents/leads/route');
    const { NextRequest } = await import('next/server');
    await GET(new NextRequest(`https://web.test/api/admin/residents/leads?status=INVITED&cursor=c1&q=${encodeURIComponent('  A1-1-4 ')}`));
    await GET(new NextRequest('https://web.test/api/admin/residents/leads?q=%20%20'));
    await GET(new NextRequest(`https://web.test/api/admin/residents/leads?q=${'y'.repeat(150)}`));
    const calls = backendCalls().filter((url) => url.includes('/admin/residents/leads'));
    expect(calls[0]).toBe('https://api.example.test/v1/admin/residents/leads?limit=50&cursor=c1&q=A1-1-4&status=INVITED');
    expect(calls[1]).toBe('https://api.example.test/v1/admin/residents/leads?limit=50');
    expect(calls[2]).toBe(`https://api.example.test/v1/admin/residents/leads?limit=50&q=${'y'.repeat(100)}`);
  });
});
