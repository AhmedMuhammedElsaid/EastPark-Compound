import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const cookieState = vi.hoisted(() => ({
  values: new Map<string, string>(),
  set: vi.fn(),
  delete: vi.fn(),
  headers: new Headers(),
}));

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => {
      const value = cookieState.values.get(name);
      return value === undefined ? undefined : { name, value };
    },
    set: cookieState.set,
    delete: cookieState.delete,
  }),
  headers: async () => cookieState.headers,
}));

type Call = { url: string; headers: Headers; method: string };

function jsonResponse(status: number, body?: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const USER = {
  id: 'u1',
  name: 'Resident',
  email: 'resident@example.com',
  phone: null,
  unitNumber: 'A2-1-3',
  avatarUrl: null,
  role: 'RESIDENT',
  isVerified: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

let calls: Call[];
let routes: (call: Call) => Response | Promise<Response>;

async function loadClient() {
  vi.resetModules();
  return import('./server');
}

beforeEach(() => {
  process.env.NEXT_PUBLIC_API_URL = 'https://api.example.test/';
  cookieState.values.clear();
  cookieState.set.mockReset();
  cookieState.delete.mockReset();
  cookieState.headers = new Headers({ 'x-forwarded-for': '203.0.113.7, 10.0.0.1' });
  calls = [];
  routes = () => jsonResponse(500);
  vi.stubGlobal('fetch', vi.fn(async (input: string | URL, init?: RequestInit) => {
    const call = { url: String(input), headers: new Headers(init?.headers), method: init?.method ?? 'GET' };
    calls.push(call);
    return routes(call);
  }));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('clientIpFrom', () => {
  it('uses the first valid x-forwarded-for entry, then x-real-ip', async () => {
    const { clientIpFrom } = await loadClient();
    expect(clientIpFrom(new Headers({ 'x-forwarded-for': '198.51.100.4, 10.0.0.1' }))).toBe('198.51.100.4');
    expect(clientIpFrom(new Headers({ 'x-forwarded-for': 'garbage', 'x-real-ip': '2001:db8::1' }))).toBe('2001:db8::1');
    expect(clientIpFrom(new Headers({ 'x-forwarded-for': '1.2.3.4:443' }))).toBeNull();
    expect(clientIpFrom(new Headers())).toBeNull();
  });
});

describe('backendFetch', () => {
  it('forwards the client IP as a single X-Forwarded-For value', async () => {
    const { backendFetch } = await loadClient();
    routes = () => jsonResponse(200, { data: {} });
    await backendFetch('/auth/login', { method: 'POST' }, { clientIp: '203.0.113.7' });
    expect(calls[0]!.url).toBe('https://api.example.test/v1/auth/login');
    expect(calls[0]!.headers.get('x-forwarded-for')).toBe('203.0.113.7');
  });

  it('sends no X-Forwarded-For without a client IP', async () => {
    const { backendFetch } = await loadClient();
    routes = () => jsonResponse(200, { data: {} });
    await backendFetch('/shops');
    expect(calls[0]!.headers.has('x-forwarded-for')).toBe(false);
  });
});

describe('backendFetch internal secret', () => {
  afterEach(() => {
    delete process.env.BFF_INTERNAL_SECRET;
  });

  it('sends X-EastPark-Internal when BFF_INTERNAL_SECRET is set, and callers cannot override it', async () => {
    process.env.BFF_INTERNAL_SECRET = ' test-secret ';
    const { backendFetch } = await loadClient();
    routes = () => jsonResponse(200, { data: {} });
    await backendFetch('/shops', { headers: { 'X-EastPark-Internal': 'spoofed' } }, { clientIp: '203.0.113.7' });
    expect(calls[0]!.headers.get('x-eastpark-internal')).toBe('test-secret');
    expect(calls[0]!.headers.get('x-forwarded-for')).toBe('203.0.113.7');
  });

  it('omits the header when the secret is unset', async () => {
    delete process.env.BFF_INTERNAL_SECRET;
    const { backendFetch } = await loadClient();
    routes = () => jsonResponse(200, { data: {} });
    await backendFetch('/shops', { headers: { 'X-EastPark-Internal': 'spoofed' } });
    expect(calls[0]!.headers.has('x-eastpark-internal')).toBe(false);
  });

  it('is also sent on session requests but never on the /health wake-up ping', async () => {
    process.env.BFF_INTERNAL_SECRET = 'test-secret';
    const { sessionFetch, wakeBackend } = await loadClient();
    cookieState.values.set('eastpark_access', 'access-1');
    routes = () => jsonResponse(200, { data: [] });
    await sessionFetch('/notifications', {}, { mutateCookies: false });
    await wakeBackend(5_000_000);
    expect(calls[0]!.headers.get('x-eastpark-internal')).toBe('test-secret');
    expect(calls[1]!.url).toBe('https://api.example.test/health');
    expect(calls[1]!.headers.has('x-eastpark-internal')).toBe(false);
  });
});

describe('sessionFetch in read-only (RSC) mode', () => {
  it('asks for a refresh without calling the backend when only the refresh cookie exists', async () => {
    const { sessionFetch } = await loadClient();
    cookieState.values.set('eastpark_refresh', 'refresh-1');
    const result = await sessionFetch('/notifications', {}, { mutateCookies: false });
    expect(result.status).toBe('refresh-required');
    expect(calls).toHaveLength(0);
    expect(cookieState.set).not.toHaveBeenCalled();
    expect(cookieState.delete).not.toHaveBeenCalled();
  });

  it('never refreshes or mutates cookies after a 401', async () => {
    const { sessionFetch } = await loadClient();
    cookieState.values.set('eastpark_access', 'access-1');
    cookieState.values.set('eastpark_refresh', 'refresh-1');
    routes = () => jsonResponse(401);
    const result = await sessionFetch('/notifications', {}, { mutateCookies: false });
    expect(result.status).toBe('refresh-required');
    expect(calls.map((call) => call.url)).toEqual(['https://api.example.test/v1/notifications']);
    expect(cookieState.set).not.toHaveBeenCalled();
    expect(cookieState.delete).not.toHaveBeenCalled();
  });

  it('forwards the request IP from headers() on session requests', async () => {
    const { sessionFetch } = await loadClient();
    cookieState.values.set('eastpark_access', 'access-1');
    routes = () => jsonResponse(200, { data: [] });
    const result = await sessionFetch('/notifications', {}, { mutateCookies: false });
    expect(result.status).toBe('ok');
    expect(calls[0]!.headers.get('authorization')).toBe('Bearer access-1');
    expect(calls[0]!.headers.get('x-forwarded-for')).toBe('203.0.113.7');
  });

  it('reports a guest as unauthenticated', async () => {
    const { sessionFetch } = await loadClient();
    const result = await sessionFetch('/notifications', {}, { mutateCookies: false });
    expect(result.status).toBe('unauthenticated');
    expect(calls).toHaveLength(0);
  });
});

describe('sessionFetch in route-handler mode', () => {
  it('refreshes once with the refresh token as Bearer, stores the new pair and retries', async () => {
    const { sessionFetch } = await loadClient();
    cookieState.values.set('eastpark_access', 'access-old');
    cookieState.values.set('eastpark_refresh', 'refresh-old');
    routes = (call) => {
      if (call.url.endsWith('/auth/refresh')) {
        return jsonResponse(200, { data: { accessToken: 'access-new', refreshToken: 'refresh-new' } });
      }
      return call.headers.get('authorization') === 'Bearer access-new' ? jsonResponse(200, { data: [] }) : jsonResponse(401);
    };

    const result = await sessionFetch('/orders', {}, { mutateCookies: true });
    expect(result).toMatchObject({ status: 'ok', accessToken: 'access-new' });
    const refreshCall = calls.find((call) => call.url.endsWith('/auth/refresh'))!;
    expect(refreshCall.headers.get('authorization')).toBe('Bearer refresh-old');
    expect(cookieState.set).toHaveBeenCalledWith('eastpark_access', 'access-new', expect.objectContaining({ httpOnly: true }));
    expect(cookieState.set).toHaveBeenCalledWith('eastpark_refresh', 'refresh-new', expect.objectContaining({ httpOnly: true }));
  });

  it('reports a revoked refresh as signed out without deleting cookies (single-use rotation race)', async () => {
    const { sessionFetch } = await loadClient();
    cookieState.values.set('eastpark_refresh', 'refresh-old');
    routes = () => jsonResponse(401, { statusCode: 401, message: 'Token revoked' });
    const result = await sessionFetch('/orders', {}, { mutateCookies: true });
    expect(result.status).toBe('unauthenticated');
    // Deleting here would wipe the newer pair a concurrent response already set in the browser.
    expect(cookieState.delete).not.toHaveBeenCalled();
    expect(cookieState.set).not.toHaveBeenCalled();
  });

  it('keeps cookies when the rejection body is unreadable (treated as a possible race)', async () => {
    const { sessionFetch } = await loadClient();
    cookieState.values.set('eastpark_refresh', 'refresh-old');
    routes = () => jsonResponse(401);
    await expect(sessionFetch('/orders', {}, { mutateCookies: true })).resolves.toEqual({ status: 'unauthenticated' });
    expect(cookieState.delete).not.toHaveBeenCalled();
  });

  it.each(['Session expired', 'Unauthorized', 'Refresh token mismatch'])(
    'clears provably dead cookies when the refresh is rejected with %s',
    async (message) => {
      const { sessionFetch } = await loadClient();
      cookieState.values.set('eastpark_refresh', 'refresh-dead');
      routes = () => jsonResponse(401, { statusCode: 401, message });
      await expect(sessionFetch('/orders', {}, { mutateCookies: true })).resolves.toEqual({ status: 'unauthenticated' });
      expect(cookieState.delete).toHaveBeenCalledWith('eastpark_access');
      expect(cookieState.delete).toHaveBeenCalledWith('eastpark_refresh');
    },
  );

  it('throws a distinct rate-limit error on a 429 refresh and keeps cookies', async () => {
    const { sessionFetch, BackendRateLimitedError } = await loadClient();
    cookieState.values.set('eastpark_refresh', 'refresh-old');
    routes = () => jsonResponse(429, { statusCode: 429, message: 'Too Many Requests' });
    await expect(sessionFetch('/orders', {}, { mutateCookies: true })).rejects.toBeInstanceOf(BackendRateLimitedError);
    expect(cookieState.delete).not.toHaveBeenCalled();
  });

  it('uses a pair rotated earlier in the same request when the refresh is rejected', async () => {
    const { sessionFetch } = await loadClient();
    cookieState.values.set('eastpark_refresh', 'refresh-old');
    routes = (call) => {
      if (call.url.endsWith('/auth/refresh')) {
        // Simulates another step of this request having already stored a newer pair.
        cookieState.values.set('eastpark_access', 'access-rotated');
        cookieState.values.set('eastpark_refresh', 'refresh-rotated');
        return jsonResponse(401);
      }
      return call.headers.get('authorization') === 'Bearer access-rotated' ? jsonResponse(200, { data: [] }) : jsonResponse(401);
    };
    const result = await sessionFetch('/orders', {}, { mutateCookies: true });
    expect(result).toMatchObject({ status: 'ok', accessToken: 'access-rotated' });
    expect(cookieState.delete).not.toHaveBeenCalled();
  });

  it('keeps cookies when the refresh fails in transport (outage is not a logout)', async () => {
    const { sessionFetch } = await loadClient();
    cookieState.values.set('eastpark_refresh', 'refresh-old');
    routes = () => jsonResponse(503);
    await expect(sessionFetch('/orders', {}, { mutateCookies: true })).rejects.toThrow();
    expect(cookieState.delete).not.toHaveBeenCalled();
  });

  it('shares one refresh between concurrent requests with the same expired session', async () => {
    const { sessionFetch } = await loadClient();
    cookieState.values.set('eastpark_refresh', 'refresh-shared');
    routes = (call) =>
      call.url.endsWith('/auth/refresh')
        ? jsonResponse(200, { data: { accessToken: 'access-new', refreshToken: 'refresh-new' } })
        : jsonResponse(200, { data: [] });

    const [first, second] = await Promise.all([
      sessionFetch('/orders', {}, { mutateCookies: true }),
      sessionFetch('/feedback', {}, { mutateCookies: true }),
    ]);
    expect(first.status).toBe('ok');
    expect(second.status).toBe('ok');
    expect(calls.filter((call) => call.url.endsWith('/auth/refresh'))).toHaveLength(1);
  });

  it('treats a malformed refresh envelope as contract drift', async () => {
    const { sessionFetch, BackendContractError } = await loadClient();
    cookieState.values.set('eastpark_refresh', 'refresh-old');
    routes = () => jsonResponse(200, { data: { token: 'wrong-shape' } });
    await expect(sessionFetch('/orders', {}, { mutateCookies: true })).rejects.toBeInstanceOf(BackendContractError);
  });
});

describe('refreshTokens single-flight', () => {
  const refreshCalls = () => calls.filter((call) => call.url.endsWith('/auth/refresh'));
  const tokens = { data: { accessToken: 'access-new', refreshToken: 'refresh-new' } };

  it('keeps sharing a pending refresh beyond 10 s (Render cold start) and expires it ~2 s after settling', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(1_000_000);
    const { refreshTokens } = await loadClient();
    let release!: (response: Response) => void;
    routes = () => new Promise<Response>((resolve) => { release = resolve; });

    const first = refreshTokens('refresh-slow');
    vi.setSystemTime(1_000_000 + 15_000);
    const second = refreshTokens('refresh-slow');
    expect(second).toBe(first);
    expect(refreshCalls()).toHaveLength(1);

    release(jsonResponse(200, tokens));
    await expect(first).resolves.toMatchObject({ status: 'refreshed' });

    vi.setSystemTime(Date.now() + 1_000);
    expect(refreshTokens('refresh-slow')).toBe(first);
    expect(refreshCalls()).toHaveLength(1);

    routes = () => jsonResponse(401);
    vi.setSystemTime(Date.now() + 2_000);
    await expect(refreshTokens('refresh-slow')).resolves.toMatchObject({ status: 'rejected' });
    expect(refreshCalls()).toHaveLength(2);
  });

  it('does not cache transport failures', async () => {
    const { refreshTokens } = await loadClient();
    routes = () => jsonResponse(503);
    await expect(refreshTokens('refresh-down')).rejects.toThrow();
    routes = () => jsonResponse(200, tokens);
    await expect(refreshTokens('refresh-down')).resolves.toMatchObject({ status: 'refreshed' });
    expect(refreshCalls()).toHaveLength(2);
  });
});

describe('getProfile', () => {
  it('returns the validated user and token', async () => {
    const { getProfile } = await loadClient();
    cookieState.values.set('eastpark_access', 'access-1');
    routes = () => jsonResponse(200, { data: USER });
    await expect(getProfile({ mutateCookies: false })).resolves.toMatchObject({
      status: 'authenticated',
      accessToken: 'access-1',
      user: { id: 'u1', role: 'RESIDENT' },
    });
  });

  it('reports rate_limited (not unavailable or signed out) when the refresh is throttled', async () => {
    const { getProfile } = await loadClient();
    cookieState.values.set('eastpark_refresh', 'refresh-1');
    routes = () => jsonResponse(429, {});
    await expect(getProfile({ mutateCookies: true })).resolves.toEqual({ status: 'rate_limited' });
    expect(cookieState.delete).not.toHaveBeenCalled();
  });

  it('reports unavailable (not signed out) on backend failure', async () => {
    const { getProfile } = await loadClient();
    cookieState.values.set('eastpark_access', 'access-1');
    routes = () => jsonResponse(502);
    await expect(getProfile({ mutateCookies: true })).resolves.toEqual({ status: 'unavailable' });
    expect(cookieState.delete).not.toHaveBeenCalled();
  });
});

describe('wakeBackend', () => {
  it('pings /health at most once per minute per instance', async () => {
    const { wakeBackend } = await loadClient();
    routes = () => jsonResponse(200);
    expect(await wakeBackend(1_000_000)).toBe(true);
    expect(await wakeBackend(1_030_000)).toBe(false);
    expect(await wakeBackend(1_061_000)).toBe(true);
    expect(calls.map((call) => call.url)).toEqual([
      'https://api.example.test/health',
      'https://api.example.test/health',
    ]);
  });
});
