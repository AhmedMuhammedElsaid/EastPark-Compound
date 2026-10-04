import { describe, expect, it } from 'vitest';

import {
  activityItemSchema,
  activityQuerySchema,
  adminUserItemSchema,
  parsePage,
  roleChangeSchema,
  searchParamsObject,
  toQueryString,
  usersQuerySchema,
} from './super-admin';

describe('usersQuerySchema', () => {
  it('trims q, drops empty values and coerces limit', () => {
    expect(usersQuerySchema.parse({ q: '  sam ', limit: '10', cursor: '' })).toEqual({ q: 'sam', limit: 10 });
  });

  it('rejects out-of-range limits and unknown roles', () => {
    expect(usersQuerySchema.safeParse({ limit: '0' }).success).toBe(false);
    expect(usersQuerySchema.safeParse({ limit: '51' }).success).toBe(false);
    expect(usersQuerySchema.safeParse({ role: 'OWNER' }).success).toBe(false);
    expect(usersQuerySchema.safeParse({ role: 'SUPER_ADMIN' }).success).toBe(true);
  });

  it('caps the search length', () => {
    expect(usersQuerySchema.safeParse({ q: 'x'.repeat(101) }).success).toBe(false);
  });
});

describe('activityQuerySchema', () => {
  it('accepts an actor filter and cursor', () => {
    expect(activityQuerySchema.parse({ actorId: 'a1', cursor: 'c1' })).toEqual({ actorId: 'a1', cursor: 'c1' });
  });
});

describe('roleChangeSchema', () => {
  it.each(['RESIDENT', 'MERCHANT', 'ADMIN'])('accepts %s', (role) => {
    expect(roleChangeSchema.safeParse({ role }).success).toBe(true);
  });

  it.each(['SUPER_ADMIN', 'GUEST', 'admin', undefined])('rejects %s', (role) => {
    expect(roleChangeSchema.safeParse({ role }).success).toBe(false);
  });
});

describe('query helpers', () => {
  it('reads only the listed, non-empty search params', () => {
    const params = new URLSearchParams('q=a&role=&evil=1');
    expect(searchParamsObject(params, ['q', 'role'])).toEqual({ q: 'a' });
  });

  it('builds a query string from defined values', () => {
    expect(toQueryString({ cursor: undefined, limit: 20, q: 'a b' })).toBe('?limit=20&q=a+b');
    expect(toQueryString({})).toBe('');
  });
});

describe('parsePage', () => {
  it('keeps valid items, drops invalid ones and reads the cursor', () => {
    const page = parsePage(
      {
        data: {
          items: [
            { id: 'u1', name: 'Sameh', email: 's@example.com', role: 'ADMIN', unitNumber: null, createdAt: '2026-10-01' },
            { id: 'u2', role: 'OWNER' },
          ],
          nextCursor: 'u1',
        },
      },
      adminUserItemSchema,
    );
    expect(page.items.map((item) => item.id)).toEqual(['u1']);
    expect(page.nextCursor).toBe('u1');
  });

  it('tolerates a missing envelope', () => {
    expect(parsePage(null, adminUserItemSchema)).toEqual({ items: [], nextCursor: undefined });
  });

  it('parses activity items with null meta', () => {
    const item = activityItemSchema.parse({
      id: 'a1', action: 'LEAD_APPROVED', entity: 'ResidentLead', entityId: null, meta: null,
      createdAt: '2026-10-04T10:00:00.000Z', actor: { id: 'x', name: 'Sameh', email: 's@example.com', role: 'ADMIN' },
    });
    expect(item.meta).toBeNull();
  });
});
