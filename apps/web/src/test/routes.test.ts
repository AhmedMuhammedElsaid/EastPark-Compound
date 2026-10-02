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
    expect(new Headers(init?.headers).get('x-forwarded-for')).toBe('203.0.113.50');
  });
});
