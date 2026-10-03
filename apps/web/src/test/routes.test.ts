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

describe('GET /api/profile', () => {
  it('reports a throttled session refresh as 429, not a network outage', async () => {
    state.cookies.set('eastpark_refresh', 'refresh-throttled');
    backend = () => json(429, { message: 'ThrottlerException: Too Many Requests' });
    const { GET } = await import('@/app/api/profile/route');
    const response = await GET();
    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({ error: 'rate_limited' });
    expect(state.delete).not.toHaveBeenCalled();
  });
});

describe('BFF error mapping backlog', () => {
  const throttled = () => {
    state.cookies.set('eastpark_refresh', 'refresh-throttled');
    backend = () => json(429, { message: 'ThrottlerException: Too Many Requests' });
  };
  const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

  it.each([
    ['orders list', async () => (await import('@/app/api/orders/route')).GET(new (await import('next/server')).NextRequest('https://web.test/api/orders'))],
    ['order detail', async () => (await import('@/app/api/orders/[id]/route')).GET(new Request('https://web.test/x'), ctx('o1'))],
    ['feedback list', async () => (await import('@/app/api/feedback/route')).GET(new (await import('next/server')).NextRequest('https://web.test/api/feedback'))],
    ['notifications', async () => (await import('@/app/api/notifications/route')).GET(new (await import('next/server')).NextRequest('https://web.test/api/notifications'))],
    ['notification read', async () => (await import('@/app/api/notifications/[id]/read/route')).PATCH(new Request('https://web.test/x'), ctx('n1'))],
    ['saved shop', async () => (await import('@/app/api/shops/[id]/save/route')).POST(new (await import('next/server')).NextRequest('https://web.test/x'), ctx('s1'))],
  ])('%s: a throttled token refresh is 429 rate_limited', async (_name, call) => {
    throttled();
    const response = await call();
    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({ error: 'rate_limited' });
    expect(state.delete).not.toHaveBeenCalled();
  });

  it('notifications: a backend 429 is rate_limited, not 502', async () => {
    state.cookies.set('eastpark_access', 'access-1');
    backend = () => json(429, { message: 'Too Many Requests' });
    const { GET } = await import('@/app/api/notifications/route');
    const { NextRequest } = await import('next/server');
    const response = await GET(new NextRequest('https://web.test/api/notifications'));
    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({ error: 'rate_limited' });
  });

  it('public reads return codes, not prose', async () => {
    backend = () => json(404, { message: 'Report r1 not found' });
    const { GET } = await import('@/app/api/reports/[id]/route');
    const response = await GET(new Request('https://web.test/x'), ctx('r1'));
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'not_found' });

    backend = () => json(500, { message: 'boom' });
    const list = await (await import('@/app/api/announcements/route')).GET(
      new (await import('next/server')).NextRequest('https://web.test/api/announcements'),
    );
    expect(list.status).toBe(502);
    expect(await list.json()).toEqual({ error: 'upstream' });
  });

  it('feedback: malformed JSON is 400, not 502', async () => {
    state.cookies.set('eastpark_access', 'access-1');
    const { POST } = await import('@/app/api/feedback/route');
    const { NextRequest } = await import('next/server');
    const response = await POST(new NextRequest('https://web.test/api/feedback', { method: 'POST', body: '{not json' }));
    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    ['poll', '@/app/api/governance/polls/[id]/vote/route'],
    ['election', '@/app/api/governance/elections/[id]/vote/route'],
  ])('%s vote: malformed JSON is 400, not 502', async (_kind, path) => {
    state.cookies.set('eastpark_access', 'access-1');
    const { POST } = (await import(path)) as { POST: (r: Request, c: ReturnType<typeof ctx>) => Promise<Response> };
    const response = await POST(new Request('https://web.test/x', { method: 'POST', body: '{not json' }), ctx('p1'));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'validation' });
  });

  it('admin feedback reply: a non-string body is 400, not 500', async () => {
    const { POST } = await import('@/app/api/admin/feedback/[id]/replies/route');
    const response = await POST(
      new Request('https://web.test/x', { method: 'POST', body: JSON.stringify({ body: 42 }) }),
      ctx('f1'),
    );
    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('governance vote re-read', () => {
  const resident = {
    id: 'u1', name: 'R', email: 'r@example.com', phone: null, unitNumber: null, avatarUrl: null,
    role: 'RESIDENT', isVerified: true, createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z',
  };

  it('treats a recorded vote as success when re-reading the poll fails', async () => {
    state.cookies.set('eastpark_access', 'access-1');
    backend = (url, init) => {
      if (url.endsWith('/user/profile')) return json(200, { data: resident });
      if (url.endsWith('/vote') && init?.method === 'POST') return json(201, { data: { ok: true } });
      return json(500, { message: 'boom' });
    };
    const { POST } = await import('@/app/api/governance/polls/[id]/vote/route');
    const response = await POST(
      new Request('https://web.test/x', { method: 'POST', body: JSON.stringify({ optionId: 'o1' }) }),
      { params: Promise.resolve({ id: 'p1' }) },
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: null });
    // Exactly one vote POST: the vote is never retried.
    expect(fetchMock.mock.calls.filter(([url, init]) => String(url).endsWith('/vote') && init?.method === 'POST')).toHaveLength(1);
  });

  it('keeps a rejected vote as an error (409 already voted)', async () => {
    state.cookies.set('eastpark_access', 'access-1');
    backend = (url) => (url.endsWith('/user/profile') ? json(200, { data: resident }) : json(409, { message: 'Already voted' }));
    const { POST } = await import('@/app/api/governance/elections/[id]/vote/route');
    const response = await POST(
      new Request('https://web.test/x', { method: 'POST', body: JSON.stringify({ candidateId: 'c1' }) }),
      { params: Promise.resolve({ id: 'e1' }) },
    );
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: 'vote_rejected' });
  });
});
