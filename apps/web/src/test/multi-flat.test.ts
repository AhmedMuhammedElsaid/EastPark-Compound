import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ResidentUnit } from '@/lib/api/contracts';

import { authUserEnvelopeSchema } from '@/lib/api/auth-schemas';
import { knownBackendCode } from '@/lib/api/bff-errors';
import { leadErrorKey } from '@/lib/api/resident-leads';
import { teamErrorKey } from '@/lib/api/super-admin';
import { unitFieldsSchema } from '@/lib/schemas/registerUnit';
import { acceptInvitationErrorKey } from '@/lib/validation/auth';
import { adminUserItemSchema, parsePage } from '@/lib/validation/super-admin';
import { afterUnitRemoved, defaultUnitChoice, keepUnits, primaryAfterAdd, unitChoices, unitsOf } from '@/lib/units';

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

// Ordering is paused in the shipped config; the order route is exercised as if it were enabled.
vi.mock('@/config/features', async (original) => ({
  ...(await original<typeof import('@/config/features')>()),
  residentOrderingEnabled: true,
}));

let backend: (url: string, init?: RequestInit) => Response;
const fetchMock = vi.fn(async (input: string | URL, init?: RequestInit) => backend(String(input), init));

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function unit(id: string, label: string, createdAt = '2026-10-01T00:00:00.000Z'): ResidentUnit {
  const [building, floor, flatNumber] = label.split('-');
  return { id, building, floor, flatNumber, label, createdAt };
}

const BASE_USER = {
  id: 'u1', name: 'Sara', email: 'sara@example.com', phone: null, unitNumber: 'A1-3-2', avatarUrl: null,
  role: 'RESIDENT', isVerified: true, createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z',
};

function profile(role: string) {
  return { ...BASE_USER, id: 'me', email: 'me@example.com', unitNumber: null, role };
}

/** Backend stub: the profile call answers with `role`, every other call with `other`. */
function asViewer(role: string, other: (url: string, init?: RequestInit) => Response) {
  backend = (url, init) => (url.endsWith('/user/profile') ? json(200, { data: profile(role) }) : other(url, init));
}

function backendCalls(): [string, RequestInit | undefined][] {
  return fetchMock.mock.calls
    .map(([url, init]) => [String(url), init] as [string, RequestInit | undefined])
    .filter(([url]) => !url.endsWith('/user/profile'));
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

describe('units in user contracts', () => {
  it('defaults units to [] when the response has none (login, PUT /user, older backend)', () => {
    const parsed = authUserEnvelopeSchema.parse({ data: BASE_USER });
    expect(parsed.data.units).toEqual([]);
    expect(parsed.data.unitNumber).toBe('A1-3-2');
  });

  it('parses the profile flats', () => {
    const units = [unit('f1', 'A1-3-2'), unit('f2', 'A2-G-1')];
    expect(authUserEnvelopeSchema.parse({ data: { ...BASE_USER, units } }).data.units).toEqual(units);
  });

  it('degrades a malformed flat list to [] instead of failing the session', () => {
    expect(authUserEnvelopeSchema.parse({ data: { ...BASE_USER, units: [{ id: 1 }] } }).data.units).toEqual([]);
  });

  it('keeps a team row whose flats are malformed or missing', () => {
    const row = { id: 'u1', name: 'Sara', email: 'sara@example.com', role: 'RESIDENT', unitNumber: null, createdAt: '' };
    const page = parsePage({ data: { items: [row, { ...row, id: 'u2', units: 'nope' }, { ...row, id: 'u3', units: [unit('f1', 'B1-2-4')] }] } }, adminUserItemSchema);
    expect(page.items.map((item) => [item.id, item.units.length])).toEqual([['u1', 0], ['u2', 0], ['u3', 1]]);
  });
});

describe('unit helpers', () => {
  const two = { id: 'u1', unitNumber: 'A2-G-1', units: [unit('f1', 'A1-3-2'), unit('f2', 'A2-G-1')] };

  it('offers the flat labels, or the legacy unit number, or nothing', () => {
    expect(unitChoices(two)).toEqual(['A1-3-2', 'A2-G-1']);
    expect(unitChoices({ unitNumber: ' 12B ', units: [] })).toEqual(['12B']);
    expect(unitChoices({ unitNumber: null, units: [] })).toEqual([]);
    expect(unitChoices({ unitNumber: 'X', units: undefined })).toEqual(['X']);
    expect(unitsOf(null)).toEqual([]);
  });

  it('pre-selects the primary flat, else the first', () => {
    expect(defaultUnitChoice(two)).toBe('A2-G-1');
    expect(defaultUnitChoice({ ...two, unitNumber: 'gone' })).toBe('A1-3-2');
    expect(defaultUnitChoice({ ...two, unitNumber: null })).toBe('A1-3-2');
    expect(defaultUnitChoice({ unitNumber: null, units: [] })).toBe('');
  });

  it('keeps the previous flats when a units-less response replaces the same user', () => {
    const next = { id: 'u1', unitNumber: 'A2-G-1', units: [] as ResidentUnit[], name: 'New' };
    expect(keepUnits(two, next)).toEqual({ ...next, units: two.units });
    expect(keepUnits({ ...two, id: 'other' }, next)).toBe(next);
    expect(keepUnits(null, next)).toBe(next);
    const fresh = { ...next, units: [unit('f9', 'C1-1-1')] };
    expect(keepUnits(two, fresh)).toBe(fresh);
  });

  it('sets the primary only when the account had none', () => {
    expect(primaryAfterAdd(null, unit('f3', 'B1-2-4'))).toBe('B1-2-4');
    expect(primaryAfterAdd('A1-3-2', unit('f3', 'B1-2-4'))).toBe('A1-3-2');
  });

  it('moves the primary to the oldest remaining flat when the primary is removed', () => {
    expect(afterUnitRemoved(two.units, 'A2-G-1', 'f2')).toEqual({ units: [two.units[0]], unitNumber: 'A1-3-2' });
    expect(afterUnitRemoved(two.units, 'A2-G-1', 'f1')).toEqual({ units: [two.units[1]], unitNumber: 'A2-G-1' });
    expect(afterUnitRemoved([two.units[0]], 'A1-3-2', 'f1')).toEqual({ units: [], unitNumber: null });
    expect(afterUnitRemoved(two.units, 'A2-G-1', 'missing')).toEqual({ units: two.units, unitNumber: 'A2-G-1' });
  });
});

describe('unitFieldsSchema (shared with /register-unit)', () => {
  it('accepts a real flat and refuses a floor the building does not have', () => {
    expect(unitFieldsSchema.safeParse({ building: 'A2', floor: 'G', flatNumber: '3' }).success).toBe(true);
    const groundInPhase1 = unitFieldsSchema.safeParse({ building: 'A1', floor: 'G', flatNumber: '3' });
    expect(groundInPhase1.success).toBe(false);
    expect(groundInPhase1.error?.issues[0]?.message).toBe('register.errors.invalid_floor');
    expect(unitFieldsSchema.safeParse({ building: 'Z9', floor: '1', flatNumber: '1' }).success).toBe(false);
    expect(unitFieldsSchema.safeParse({ building: 'A1', floor: '1', flatNumber: '6' }).success).toBe(false);
    expect(unitFieldsSchema.safeParse({ building: 'A1', floor: '1', flatNumber: '1', userId: 'x' }).success).toBe(false);
  });
});

describe('error codes', () => {
  it('allowlists the multi-flat backend codes only', () => {
    expect(knownBackendCode({ code: 'unit.error.alreadyOwned' })).toBe('unit_already_owned');
    expect(knownBackendCode({ code: 'user.error.unitNotOwned' })).toBe('unit_not_owned');
    expect(knownBackendCode({ code: 'order.error.deliveryUnitInvalid' })).toBe('delivery_unit_invalid');
    expect(knownBackendCode({ code: 'unit.error.notFound' })).toBeUndefined();
    expect(knownBackendCode({ code: 'residentLead.error.unitReserved' })).toBeUndefined();
  });

  it('maps the team flat codes to their own copy', () => {
    for (const code of ['unit_already_owned', 'unit_reserved', 'unit_not_found', 'unit_validation'] as const) {
      expect(teamErrorKey(409, code)).toBe(code);
    }
    expect(teamErrorKey(404, 'not_found')).toBe('not_found');
  });

  it('maps an owned flat on accept-invitation to its own copy', () => {
    expect(acceptInvitationErrorKey('unit_already_owned')).toBe('auth.errors.invitation_unit_owned');
  });
});

describe('POST /api/admin/residents/leads/[id]/invite — flat owned by another account', () => {
  const call = async () => {
    const { POST } = await import('@/app/api/admin/residents/leads/[id]/invite/route');
    return POST(new Request('http://localhost/api/admin/residents/leads/lead-1/invite', { method: 'POST' }), {
      params: Promise.resolve({ id: 'lead-1' }),
    });
  };

  it('returns unit_already_owned, which leadErrorKey turns into the owned-flat copy', async () => {
    asViewer('ADMIN', () => json(409, { statusCode: 409, code: 'unit.error.alreadyOwned', message: 'unit.error.alreadyOwned' }));
    const response = await call();
    expect(response.status).toBe(409);
    const body = (await response.json()) as { error: string };
    expect(body).toEqual({ error: 'unit_already_owned' });
    expect(leadErrorKey('invite', 409, body.error)).toBe('unit_owned');
  });

  it('keeps the reserved-unit copy for any other conflict', () => {
    expect(leadErrorKey('invite', 409, 'conflict')).toBe('unit_reserved');
    expect(leadErrorKey('reject', 409, 'unit_already_owned')).toBe('already_registered');
  });
});

describe('POST /api/admin/users/[id]/units', () => {
  const call = async (body: unknown, id = 'u1') => {
    const { POST } = await import('@/app/api/admin/users/[id]/units/route');
    return POST(
      new Request(`https://web.test/api/admin/users/${id}/units`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
      { params: Promise.resolve({ id }) },
    );
  };

  it('forwards only the validated flat and relays the 201 flat', async () => {
    const added = unit('f3', 'A2-G-3');
    asViewer('SUPER_ADMIN', () => json(201, { success: true, message: 'unit.success.added', data: added }));
    const response = await call({ building: 'A2', floor: 'G', flatNumber: '3' });
    expect(response.status).toBe(201);
    expect(((await response.json()) as { data: unknown }).data).toEqual(added);
    const [[url, init]] = backendCalls();
    expect(url).toBe('https://api.example.test/v1/admin/user/u1/units');
    expect(init?.method).toBe('POST');
    expect(JSON.parse(String(init?.body))).toEqual({ building: 'A2', floor: 'G', flatNumber: '3' });
  });

  it('refuses an impossible flat without calling the backend', async () => {
    asViewer('SUPER_ADMIN', () => json(201, {}));
    const response = await call({ building: 'A1', floor: 'G', flatNumber: '3' });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'unit_validation' });
    expect(backendCalls()).toHaveLength(0);
  });

  it('refuses a plain admin', async () => {
    asViewer('ADMIN', () => json(201, {}));
    const response = await call({ building: 'A2', floor: 'G', flatNumber: '3' });
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'super_admin_required' });
    expect(backendCalls()).toHaveLength(0);
  });

  it.each([
    [409, 'unit.error.alreadyOwned', 'unit_already_owned'],
    [409, 'residentLead.error.unitReserved', 'unit_reserved'],
    [404, 'user.error.notFound', 'not_found'],
  ])('maps a backend %i %s to %s', async (status, code, expected) => {
    asViewer('SUPER_ADMIN', () => json(status, { statusCode: status, code, message: code }));
    const response = await call({ building: 'B1', floor: '2', flatNumber: '4' });
    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ error: expected });
  });
});

describe('DELETE /api/admin/users/[id]/units/[unitId]', () => {
  const call = async () => {
    const { DELETE } = await import('@/app/api/admin/users/[id]/units/[unitId]/route');
    return DELETE(new Request('https://web.test/api/admin/users/u1/units/f2', { method: 'DELETE' }), {
      params: Promise.resolve({ id: 'u1', unitId: 'f2' }),
    });
  };

  it('forwards without a body', async () => {
    asViewer('SUPER_ADMIN', () => json(200, { success: true, message: 'unit.success.removed', data: { message: 'unit.success.removed' } }));
    const response = await call();
    expect(response.status).toBe(200);
    const [[url, init]] = backendCalls();
    expect(url).toBe('https://api.example.test/v1/admin/user/u1/units/f2');
    expect(init?.method).toBe('DELETE');
    expect(init?.body).toBeUndefined();
  });

  it('maps a 404 to unit_not_found', async () => {
    asViewer('SUPER_ADMIN', () => json(404, { statusCode: 404, code: 'unit.error.notFound', message: 'unit.error.notFound' }));
    const response = await call();
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'unit_not_found' });
  });
});

describe('resident flat errors', () => {
  it('POST /api/orders maps a delivery flat that is not the caller\'s', async () => {
    backend = () => json(400, { statusCode: 400, code: 'order.error.deliveryUnitInvalid', message: 'order.error.deliveryUnitInvalid' });
    const { POST } = await import('@/app/api/orders/route');
    const response = await POST(
      new Request('https://web.test/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: [{ productId: 'p1', quantity: 1 }], deliveryUnit: 'B1-2-4', paymentMethod: 'CASH' }),
      }),
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'delivery_unit_invalid' });
  });

  it('POST /api/orders keeps request_failed for other 400s', async () => {
    backend = () => json(400, { statusCode: 400, message: 'validation failed' });
    const { POST } = await import('@/app/api/orders/route');
    const response = await POST(
      new Request('https://web.test/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: [{ productId: 'p1', quantity: 1 }], deliveryUnit: 'B1-2-4', paymentMethod: 'CASH' }),
      }),
    );
    expect(await response.json()).toEqual({ error: 'request_failed' });
  });

  it('PUT /api/profile maps a primary flat that is not owned', async () => {
    backend = () => json(400, { statusCode: 400, code: 'user.error.unitNotOwned', message: 'user.error.unitNotOwned' });
    const { PUT } = await import('@/app/api/profile/route');
    const response = await PUT(
      new Request('https://web.test/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Sara', phone: '', unitNumber: 'B1-2-4', avatarUrl: '' }),
      }),
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'unit_not_owned' });
  });
});
