import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  cookies: new Map<string, string>(),
  set: vi.fn(),
  delete: vi.fn(),
}));

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => {
      const value = state.cookies.get(name);
      return value === undefined ? undefined : { name, value };
    },
    set: state.set,
    delete: state.delete,
  }),
  headers: async () => new Headers({ 'x-forwarded-for': '198.51.100.9' }),
}));

let backend: (url: string, init?: RequestInit) => Response;
const fetchMock = vi.fn(async (input: string | URL, init?: RequestInit) => backend(String(input), init));

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

beforeEach(() => {
  vi.resetModules();
  process.env.NEXT_PUBLIC_API_URL = 'https://api.example.test';
  state.cookies.clear();
  state.set.mockReset();
  state.delete.mockReset();
  fetchMock.mockClear();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('GET /api/orders/[id] error mapping', () => {
  it('never relays backend error internals', async () => {
    state.cookies.set('eastpark_access', 'access-1');
    backend = () => json(500, { message: 'PrismaClientKnownRequestError at /app/dist/orders.js:42', stack: 'trace' });
    const { GET } = await import('@/app/api/orders/[id]/route');
    const response = await GET(new Request('https://web.test/api/orders/o1'), { params: Promise.resolve({ id: 'o1' }) });
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: 'upstream' });
  });

  it('maps a backend 404 to the not_found code', async () => {
    state.cookies.set('eastpark_access', 'access-1');
    backend = () => json(404, { message: 'Order o1 not found', statusCode: 404 });
    const { GET } = await import('@/app/api/orders/[id]/route');
    const response = await GET(new Request('https://web.test/api/orders/o1'), { params: Promise.resolve({ id: 'o1' }) });
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'not_found' });
  });

  it('passes successful envelopes through unchanged', async () => {
    state.cookies.set('eastpark_access', 'access-1');
    backend = () => json(200, { data: { id: 'o1' } });
    const { GET } = await import('@/app/api/orders/[id]/route');
    const response = await GET(new Request('https://web.test/api/orders/o1'), { params: Promise.resolve({ id: 'o1' }) });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: { id: 'o1' } });
  });
});

describe('POST /api/auth/login', () => {
  const request = () =>
    new Request('https://web.test/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '203.0.113.50, 10.1.1.1' },
      body: JSON.stringify({ email: 'resident@example.com', password: 'Password1!' }),
    });

  it('reports contract drift as a server error, not a network failure, and sets no cookies', async () => {
    backend = () => json(200, { data: { token: 'unexpected-shape' } });
    const { POST } = await import('@/app/api/auth/login/route');
    const response = await POST(request());
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: 'server' });
    expect(state.set).not.toHaveBeenCalled();
  });

  it('forwards the browser IP to the backend', async () => {
    backend = () => json(401, { message: 'Invalid credentials' });
    const { POST } = await import('@/app/api/auth/login/route');
    const response = await POST(request());
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'invalid_credentials' });
    const [, init] = fetchMock.mock.calls[0]!;
    expect(new Headers(init?.headers).get('x-eastpark-client-ip')).toBe('203.0.113.50');
    expect(new Headers(init?.headers).get('x-forwarded-for')).toBe('203.0.113.50');
  });
});

describe('GET /api/announcements/[id]', () => {
  it('serves announcements whose comments omit author ids (guest view)', async () => {
    backend = () =>
      json(200, {
        data: {
          id: 'a1',
          title: 'Notice',
          titleAr: 'تنبيه',
          body: 'Body',
          bodyAr: 'نص',
          category: 'GENERAL',
          pdfUrl: null,
          publishedAt: '2026-10-01T00:00:00.000Z',
          createdAt: '2026-10-01T00:00:00.000Z',
          comments: [{ id: 'c1', body: 'Hello', createdAt: '2026-10-02T00:00:00.000Z', user: { name: 'Ahmed' } }],
        },
      });
    const { GET } = await import('@/app/api/announcements/[id]/route');
    const response = await GET(new Request('https://web.test/api/announcements/a1'), { params: Promise.resolve({ id: 'a1' }) });
    expect(response.status).toBe(200);
    const body = (await response.json()) as { data: { comments: Array<{ user: { name: string } }> } };
    expect(body.data.comments[0]!.user.name).toBe('Ahmed');
  });
});

describe('session routes and backend rate limiting', () => {
  it('GET /api/auth/session maps a throttled refresh to 429 rate_limited', async () => {
    state.cookies.set('eastpark_refresh', 'refresh-1');
    backend = () => json(429, { statusCode: 429, message: 'Too Many Requests' });
    const { GET } = await import('@/app/api/auth/session/route');
    const response = await GET();
    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({ error: 'rate_limited' });
    expect(state.delete).not.toHaveBeenCalled();
  });

  it('GET /api/auth/refresh maps a throttled refresh to 429 instead of 503', async () => {
    state.cookies.set('eastpark_refresh', 'refresh-1');
    backend = () => json(429, { statusCode: 429, message: 'Too Many Requests' });
    const { GET } = await import('@/app/api/auth/refresh/route');
    const { NextRequest } = await import('next/server');
    const response = await GET(new NextRequest('https://web.test/api/auth/refresh?next=%2Forders'));
    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({ error: 'rate_limited' });
    expect(state.delete).not.toHaveBeenCalled();
  });

  it('GET /api/auth/refresh clears a provably dead session before sending the user to login', async () => {
    state.cookies.set('eastpark_refresh', 'refresh-dead');
    backend = () => json(401, { statusCode: 401, message: 'Session expired' });
    const { GET } = await import('@/app/api/auth/refresh/route');
    const { NextRequest } = await import('next/server');
    const response = await GET(new NextRequest('https://web.test/api/auth/refresh?next=%2Forders'));
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('https://web.test/login?next=%2Forders');
    expect(state.delete).toHaveBeenCalledWith('eastpark_refresh');
  });

  it('GET /api/auth/refresh keeps cookies on a revoked token (possible rotation race)', async () => {
    state.cookies.set('eastpark_refresh', 'refresh-raced');
    backend = () => json(401, { statusCode: 401, message: 'Token revoked' });
    const { GET } = await import('@/app/api/auth/refresh/route');
    const { NextRequest } = await import('next/server');
    const response = await GET(new NextRequest('https://web.test/api/auth/refresh?next=%2Forders'));
    expect(response.status).toBe(307);
    expect(state.delete).not.toHaveBeenCalled();
  });
});

describe('POST /api/auth/logout', () => {
  it('clears the session cookies within the revoke budget even when the backend never answers', async () => {
    vi.useFakeTimers();
    try {
      state.cookies.set('eastpark_access', 'access-1');
      state.cookies.set('eastpark_refresh', 'refresh-1');
      fetchMock.mockImplementationOnce(() => new Promise<Response>(() => undefined));
      const { POST } = await import('@/app/api/auth/logout/route');

      const pending = POST(new Request('https://web.test/api/auth/logout', { method: 'POST' }));
      // Well under the browser's 10s abort in `signOut`.
      await vi.advanceTimersByTimeAsync(5_000);
      const response = await pending;

      expect(response.status).toBe(200);
      expect(state.delete).toHaveBeenCalledWith('eastpark_access');
      expect(state.delete).toHaveBeenCalledWith('eastpark_refresh');
    } finally {
      vi.useRealTimers();
    }
  });
});
