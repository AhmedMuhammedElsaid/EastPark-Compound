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

function headerOf(init: RequestInit | undefined, name: string): string | null {
  return new Headers(init?.headers).get(name);
}

const params = (...path: string[]) => ({ params: Promise.resolve({ path }) });

const validPayment = {
  flatId: 'flat_A1-3-2', amount: '900.00', method: 'CASH', receivedAt: '2026-11-02', payFor: 'AUTO', evil: 'x',
};

beforeEach(() => {
  vi.resetModules();
  process.env.NEXT_PUBLIC_API_URL = 'https://api.example.test';
  process.env.BFF_INTERNAL_SECRET = 'internal-secret-for-tests-0123456789';
  state.cookies.clear();
  state.cookies.set('eastpark_access', 'access-1');
  fetchMock.mockClear();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.BFF_INTERNAL_SECRET;
});

async function financeRoute() {
  const route = await import('@/app/api/finance/[[...path]]/route');
  const { NextRequest } = await import('next/server');
  return { ...route, NextRequest };
}

describe('POST /api/finance/payments', () => {
  it('forwards the Idempotency-Key, the internal secret and the client IP, with a whitelisted body', async () => {
    asViewer('ACCOUNTANT', () => json(201, { statusCode: 201, message: 'The payment was recorded', data: { id: 'p1', receiptNo: 'R-2026-000001' } }));
    const { POST, NextRequest } = await financeRoute();
    const request = new NextRequest('https://web.test/api/finance/payments', {
      method: 'POST',
      headers: { 'Idempotency-Key': 'key-0123456789', 'Content-Type': 'application/json', 'x-real-ip': '203.0.113.7' },
      body: JSON.stringify(validPayment),
    });
    const response = await POST(request, params('payments'));
    expect(response.status).toBe(201);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    // Only `{ data }` is relayed: never the backend's message.
    await expect(response.json()).resolves.toEqual({ data: { id: 'p1', receiptNo: 'R-2026-000001' } });

    const [[url, init]] = backendCalls();
    expect(String(url)).toBe('https://api.example.test/v1/finance/payments');
    expect(headerOf(init, 'Idempotency-Key')).toBe('key-0123456789');
    expect(headerOf(init, 'X-EastPark-Internal')).toBe('internal-secret-for-tests-0123456789');
    expect(headerOf(init, 'X-EastPark-Client-IP')).toBe('203.0.113.7');
    expect(headerOf(init, 'Authorization')).toBe('Bearer access-1');
    expect(JSON.parse(String(init?.body))).toEqual({
      flatId: 'flat_A1-3-2', amount: '900.00', method: 'CASH', receivedAt: '2026-11-02', payFor: 'AUTO',
    });
  });

  it('refuses a missing or malformed key without calling the backend', async () => {
    asViewer('ACCOUNTANT');
    const { POST, NextRequest } = await financeRoute();
    for (const headers of [{}, { 'Idempotency-Key': 'short' }, { 'Idempotency-Key': 'has spaces in it!' }] as Record<string, string>[]) {
      const response = await POST(
        new NextRequest('https://web.test/api/finance/payments', { method: 'POST', headers, body: JSON.stringify(validPayment) }),
        params('payments'),
      );
      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({ error: 'finance.idempotencyKeyRequired' });
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('maps a finance error to its code and never relays backend internals', async () => {
    asViewer('ADMIN', () =>
      json(409, {
        statusCode: 409,
        code: 'finance.error.duplicateReference',
        message: 'A payment with this method and reference is already recorded.',
        error: 'ConflictException: stack trace at finance-payments.service.ts:123',
      }),
    );
    const { POST, NextRequest } = await financeRoute();
    const response = await POST(
      new NextRequest('https://web.test/api/finance/payments', {
        method: 'POST', headers: { 'Idempotency-Key': 'key-0123456789' }, body: JSON.stringify(validPayment),
      }),
      params('payments'),
    );
    expect(response.status).toBe(409);
    const text = await response.text();
    expect(JSON.parse(text)).toEqual({ error: 'finance.duplicateReference' });
    expect(text).not.toMatch(/stack|service\.ts|already recorded/);
  });

  it('turns a 5xx and an unknown code into the generic vocabulary', async () => {
    asViewer('ACCOUNTANT', () => json(500, { statusCode: 500, message: 'Internal', error: 'Error: db down at x.ts:1' }));
    const { POST, NextRequest } = await financeRoute();
    const response = await POST(
      new NextRequest('https://web.test/api/finance/payments', {
        method: 'POST', headers: { 'Idempotency-Key': 'key-0123456789' }, body: JSON.stringify(validPayment),
      }),
      params('payments'),
    );
    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({ error: 'upstream' });

    asViewer('ACCOUNTANT', () => json(400, { statusCode: 400, code: 'finance.error.somethingNew', message: 'x' }));
    const again = await POST(
      new NextRequest('https://web.test/api/finance/payments', {
        method: 'POST', headers: { 'Idempotency-Key': 'key-0123456789' }, body: JSON.stringify(validPayment),
      }),
      params('payments'),
    );
    await expect(again.json()).resolves.toEqual({ error: 'request_failed' });
  });

  it.each(['RESIDENT', 'MERCHANT'])('refuses %s without calling the backend', async (role) => {
    asViewer(role);
    const { POST, NextRequest } = await financeRoute();
    const response = await POST(
      new NextRequest('https://web.test/api/finance/payments', {
        method: 'POST', headers: { 'Idempotency-Key': 'key-0123456789' }, body: JSON.stringify(validPayment),
      }),
      params('payments'),
    );
    expect(response.status).toBe(403);
    expect(backendCalls()).toEqual([]);
  });
});

describe('finance BFF route table', () => {
  it('rebuilds list queries from validated params only', async () => {
    asViewer('SUPER_ADMIN');
    const { GET, NextRequest } = await financeRoute();
    const response = await GET(
      new NextRequest('https://web.test/api/finance/flats?q=%20A1-3%20&hasBalance=true&overdueDays=30&cursor=c1&role=x'),
      params('flats'),
    );
    expect(response.status).toBe(200);
    expect(backendCalls().map(([url]) => String(url))).toEqual([
      'https://api.example.test/v1/finance/flats?cursor=c1&q=A1-3&hasBalance=true&overdueDays=30',
    ]);
  });

  it('sends apply-credit with expectedCredit as a string', async () => {
    asViewer('ACCOUNTANT', () => json(200, { data: { applied: 100 } }));
    const { POST, NextRequest } = await financeRoute();
    const response = await POST(
      new NextRequest('https://web.test/api/finance/flats/flat_A1-3-2/apply-credit', {
        method: 'POST', body: JSON.stringify({ expectedCredit: '550.00' }),
      }),
      params('flats', 'flat_A1-3-2', 'apply-credit'),
    );
    expect(response.status).toBe(200);
    const [[url, init]] = backendCalls();
    expect(String(url)).toBe('https://api.example.test/v1/finance/flats/flat_A1-3-2/apply-credit');
    expect(JSON.parse(String(init?.body))).toEqual({ expectedCredit: '550.00' });

    const missing = await POST(
      new NextRequest('https://web.test/api/finance/flats/flat_A1-3-2/apply-credit', { method: 'POST', body: JSON.stringify({}) }),
      params('flats', 'flat_A1-3-2', 'apply-credit'),
    );
    expect(missing.status).toBe(400);
  });

  it('404s anything outside the table and bad ids', async () => {
    asViewer('ADMIN');
    const { GET, POST, NextRequest } = await financeRoute();
    expect((await GET(new NextRequest('https://web.test/api/finance/billing'), params('billing'))).status).toBe(404);
    expect((await GET(new NextRequest('https://web.test/api/finance/flats/..%2Fadmin'), params('flats', '../admin'))).status).toBe(404);
    // Dot-only ids would be normalised away by fetch (`/payments/../void` → `/void`), review L1.
    expect((await GET(new NextRequest('https://web.test/api/finance/flats/%2E%2E'), params('flats', '..'))).status).toBe(404);
    expect(
      (await POST(new NextRequest('https://web.test/api/finance/payments/%2E%2E/void', { method: 'POST', body: '{}' }), params('payments', '..', 'void'))).status,
    ).toBe(404);
    expect((await POST(new NextRequest('https://web.test/api/finance/settings', { method: 'POST', body: '{}' }), params('settings'))).status).toBe(404);
    expect(backendCalls()).toEqual([]);
  });
});

describe('finance attachments', () => {
  it('passes the multipart body through byte for byte with its boundary', async () => {
    asViewer('ACCOUNTANT', () => json(201, { data: { path: 'staging/u1/123-abc.jpg' } }));
    const { POST } = await import('@/app/api/finance/attachments/route');
    const { NextRequest } = await import('next/server');
    const form = new FormData();
    form.append('file', new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0x00])], { type: 'image/jpeg' }), 'slip.jpg');
    const encoded = new Request('https://web.test', { method: 'POST', body: form });
    const contentType = encoded.headers.get('content-type')!;
    const bytes = new Uint8Array(await encoded.arrayBuffer());

    const response = await POST(
      new NextRequest('https://web.test/api/finance/attachments', { method: 'POST', headers: { 'content-type': contentType }, body: bytes }),
    );
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({ data: { path: 'staging/u1/123-abc.jpg' } });
    const [[url, init]] = backendCalls();
    expect(String(url)).toBe('https://api.example.test/v1/finance/attachments');
    expect(headerOf(init, 'content-type')).toBe(contentType);
    expect(new Uint8Array(init?.body as ArrayBuffer)).toEqual(bytes);
    expect(headerOf(init, 'X-EastPark-Internal')).toBe('internal-secret-for-tests-0123456789');
  });

  it('answers "view slip" with a no-store 302 to the signed URL', async () => {
    const signed = 'https://storage.example.test/object/sign/eastpark-finance/payments/p1.jpg?token=secret-token';
    asViewer('ACCOUNTANT', () => json(200, { data: { url: signed, expiresAt: '2026-11-02T10:00:00Z', expiresInSeconds: 60 } }));
    const log = vi.spyOn(console, 'error');
    const { GET } = await import('@/app/api/finance/attachments/view/route');
    const { NextRequest } = await import('next/server');
    const response = await GET(new NextRequest('https://web.test/api/finance/attachments/view?paymentId=p1'));
    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe(signed);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('referrer-policy')).toBe('no-referrer');
    expect(await response.text()).toBe('');
    expect(String(backendCalls()[0]?.[0])).toBe('https://api.example.test/v1/finance/attachments/signed-url?paymentId=p1');
    expect(JSON.stringify(log.mock.calls)).not.toContain('secret-token');
  });

  it('sends a failed view back to the payment page with a code, still no-store', async () => {
    asViewer('ACCOUNTANT', () => json(404, { statusCode: 404, code: 'finance.error.attachmentNotFound', message: 'x' }));
    const { GET } = await import('@/app/api/finance/attachments/view/route');
    const { NextRequest } = await import('next/server');
    const response = await GET(new NextRequest('https://web.test/api/finance/attachments/view?paymentId=p1'));
    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe('https://web.test/finance/payments/p1?slip=finance.attachmentNotFound');
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('refuses a non-https signed URL', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    asViewer('ACCOUNTANT', () => json(200, { data: { url: 'javascript:alert(1)' } }));
    const { GET } = await import('@/app/api/finance/attachments/view/route');
    const { NextRequest } = await import('next/server');
    const response = await GET(new NextRequest('https://web.test/api/finance/attachments/view?paymentId=p1'));
    expect(response.headers.get('location')).toBe('https://web.test/finance/payments/p1?slip=unavailable');
    vi.unstubAllEnvs();
  });

  it('refuses a resident before any signed URL is issued', async () => {
    asViewer('RESIDENT');
    const { GET } = await import('@/app/api/finance/attachments/view/route');
    const { NextRequest } = await import('next/server');
    const response = await GET(new NextRequest('https://web.test/api/finance/attachments/view?paymentId=p1'));
    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe('https://web.test/finance/payments/p1?slip=forbidden');
    expect(backendCalls()).toEqual([]);
  });
});
