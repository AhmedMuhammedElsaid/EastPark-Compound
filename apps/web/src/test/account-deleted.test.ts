import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { knownBackendCode } from '@/lib/api/bff-errors';
import { leadErrorKey } from '@/lib/api/resident-leads';
import { translate } from '@/lib/i18n/resolve';
import { acceptInvitationErrorKey } from '@/lib/validation/auth';
import ar from '@/translations/ar.json';
import en from '@/translations/en.json';

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

const ACCOUNT_DELETED = { statusCode: 409, code: 'user.error.accountDeleted', message: 'user.error.accountDeleted' };

beforeEach(() => {
  vi.resetModules();
  process.env.NEXT_PUBLIC_API_URL = 'https://api.example.test';
  state.cookies.clear();
  fetchMock.mockClear();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('knownBackendCode', () => {
  it('maps the allowlisted backend code, from `code` or the legacy raw-key `message`', () => {
    expect(knownBackendCode(ACCOUNT_DELETED)).toBe('account_deleted');
    expect(knownBackendCode({ message: 'user.error.accountDeleted' })).toBe('account_deleted');
  });

  it('ignores other keys, prose and non-objects', () => {
    expect(knownBackendCode({ code: 'residentLead.error.unitReserved' })).toBeUndefined();
    expect(knownBackendCode({ message: 'An account with this email already exists' })).toBeUndefined();
    expect(knownBackendCode({ code: 'toString' })).toBeUndefined();
    expect(knownBackendCode(null)).toBeUndefined();
    expect(knownBackendCode('user.error.accountDeleted')).toBeUndefined();
  });
});

describe('leadErrorKey for a deleted account', () => {
  it('maps an invite 409 with account_deleted to its own copy', () => {
    expect(leadErrorKey('invite', 409, 'account_deleted')).toBe('account_deleted');
    expect(leadErrorKey('invite', 409)).toBe('unit_reserved');
    expect(leadErrorKey('invite', 409, 'conflict')).toBe('unit_reserved');
  });

  it('has ar and en copy', () => {
    expect(translate(en, 'admin_leads.errors.account_deleted')).toContain('Recycle bin');
    expect(translate(ar, 'admin_leads.errors.account_deleted')).not.toBe('admin_leads.errors.account_deleted');
  });
});

describe('acceptInvitationErrorKey', () => {
  it('never shows the current-password hint for a deleted account', () => {
    expect(acceptInvitationErrorKey('account_deleted')).toBe('auth.errors.invitation_account_deleted');
    expect(acceptInvitationErrorKey('account_exists')).toBe('auth.errors.invitation_account_exists');
    expect(acceptInvitationErrorKey('invalid_invitation')).toBe('auth.invitation_invalid');
    expect(acceptInvitationErrorKey('rate_limited')).toBe('auth.errors.rate_limited');
    expect(acceptInvitationErrorKey(undefined)).toBe('errors.server');
  });

  it('has ar and en copy pointing to the administration', () => {
    const path = 'auth.errors.invitation_account_deleted';
    expect(translate(en, path)).toContain('administration');
    expect(translate(ar, path)).not.toBe(path);
  });
});

describe('POST /api/auth/accept-invitation 409 mapping', () => {
  const request = () =>
    new Request('http://localhost/api/auth/accept-invitation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'a'.repeat(64), name: 'Sara', password: 'Password1!' }),
    });

  it('returns account_deleted for a soft-deleted account', async () => {
    backend = () => json(409, ACCOUNT_DELETED);
    const { POST } = await import('@/app/api/auth/accept-invitation/route');
    const response = await POST(request());
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: 'account_deleted' });
  });

  it('keeps account_exists for the wrong current password', async () => {
    backend = () => json(409, { statusCode: 409, message: 'An account with this email already exists' });
    const { POST } = await import('@/app/api/auth/accept-invitation/route');
    const response = await POST(request());
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: 'account_exists' });
  });
});

describe('accept-invitation password: strength is checked by the backend, for new accounts only', () => {
  const post = async (password: string) => {
    const { POST } = await import('@/app/api/auth/accept-invitation/route');
    return POST(
      new Request('http://localhost/api/auth/accept-invitation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: 'a'.repeat(64), name: 'Sara', password }),
      }),
    );
  };
  const weakNewAccount = {
    statusCode: 400,
    message: 'Bad Request',
    error: ['Password must be 8+ chars with uppercase, lowercase, number, and special character'],
  };

  it('forwards a weak password (it may be the current password of an existing owner) instead of rejecting it', async () => {
    backend = () => json(409, { statusCode: 409, message: 'An account with this email already exists' });
    const response = await post('oldpass');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toMatchObject({ password: 'oldpass' });
    expect(await response.json()).toEqual({ error: 'account_exists' });
  });

  it('still rejects an empty or over-long password without calling the backend', async () => {
    for (const password of ['', 'a'.repeat(257)]) {
      const response = await post(password);
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: 'validation' });
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('maps the backend validation 400 (an error array) to password_weak', async () => {
    backend = () => json(400, weakNewAccount);
    const response = await post('weakpass');
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'password_weak' });
  });

  it('keeps invalid_invitation for the prose 400s and the 404', async () => {
    for (const reply of [
      () => json(400, { statusCode: 400, message: 'Invitation expired', error: 'stack' }),
      () => json(400, { statusCode: 400, message: 'Invitation already used' }),
      () => json(404, { statusCode: 404, message: 'Invitation not found' }),
    ]) {
      backend = reply;
      const response = await post('Password1!');
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: 'invalid_invitation' });
    }
  });

  it('shows the new-password requirements copy, in ar and en', () => {
    const path = acceptInvitationErrorKey('password_weak');
    expect(path).toBe('auth.errors.invitation_password_weak');
    expect(translate(en, path)).toContain('requirement');
    expect(translate(ar, path)).not.toBe(path);
    expect(translate(en, 'auth.invitation_existing_account_hint')).toContain('current password');
    expect(translate(ar, 'auth.invitation_existing_account_hint')).not.toBe('auth.invitation_existing_account_hint');
  });
});

describe('POST /api/admin/residents/leads/[id]/invite 409 mapping', () => {
  function asAdmin(other: () => Response) {
    state.cookies.set('eastpark_access', 'access-1');
    backend = (url) =>
      url.endsWith('/user/profile')
        ? json(200, {
            data: {
              id: 'me', name: 'Me', email: 'me@example.com', phone: null, unitNumber: null, avatarUrl: null,
              role: 'ADMIN', isVerified: true, createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z',
            },
          })
        : other();
  }
  const call = async () => {
    const { POST } = await import('@/app/api/admin/residents/leads/[id]/invite/route');
    return POST(new Request('http://localhost/api/admin/residents/leads/lead-1/invite', { method: 'POST' }), {
      params: Promise.resolve({ id: 'lead-1' }),
    });
  };

  it('returns account_deleted for the email of a soft-deleted account', async () => {
    asAdmin(() => json(409, ACCOUNT_DELETED));
    const response = await call();
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: 'account_deleted' });
  });

  it('keeps the generic conflict code for a reserved unit', async () => {
    asAdmin(() => json(409, { statusCode: 409, code: 'residentLead.error.unitReserved', message: 'residentLead.error.unitReserved' }));
    const response = await call();
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: 'conflict' });
  });
});
