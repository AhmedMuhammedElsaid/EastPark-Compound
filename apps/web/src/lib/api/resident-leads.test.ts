import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  type LeadStats,
  leadActions,
  fetchLeadPage,
  leadErrorKey,
  maskIdentifier,
  normalizeSearch,
  shiftStats,
} from './resident-leads';

describe('leadActions', () => {
  it('offers invite + reject while pending or invited', () => {
    expect(leadActions('PENDING')).toEqual({ invite: 'send', reject: true });
    expect(leadActions('INVITED')).toEqual({ invite: 'resend', reject: true });
  });

  it('offers only re-invite for rejected and nothing for registered leads', () => {
    expect(leadActions('REJECTED')).toEqual({ invite: 'reinvite', reject: false });
    expect(leadActions('CONVERTED')).toEqual({ invite: null, reject: false });
  });

  it('offers "add to account" instead of an invitation when the email already has an account', () => {
    expect(leadActions('PENDING', true)).toEqual({ invite: 'attach', reject: true });
    expect(leadActions('INVITED', true)).toEqual({ invite: 'attach', reject: true });
    expect(leadActions('REJECTED', true)).toEqual({ invite: 'attach', reject: false });
    expect(leadActions('CONVERTED', true)).toEqual({ invite: null, reject: false });
  });
});

describe('leadErrorKey', () => {
  it('maps a 409 by action', () => {
    expect(leadErrorKey('invite', 409)).toBe('unit_reserved');
    expect(leadErrorKey('reject', 409)).toBe('already_registered');
  });

  it('maps transport and auth failures', () => {
    expect(leadErrorKey('invite', 0)).toBe('network');
    expect(leadErrorKey('reject', 503)).toBe('network');
    expect(leadErrorKey('invite', 401)).toBe('session');
    expect(leadErrorKey('invite', 403)).toBe('forbidden');
    expect(leadErrorKey('invite', 404)).toBe('not_found');
    expect(leadErrorKey('invite', 429)).toBe('rate_limited');
    expect(leadErrorKey('load', 502)).toBe('generic');
  });
});

describe('shiftStats', () => {
  const stats: LeadStats = { PENDING: 2, INVITED: 0, CONVERTED: 1, REJECTED: 0, total: 3 };

  it('moves one lead between buckets and keeps the total', () => {
    expect(shiftStats(stats, 'PENDING', 'INVITED')).toEqual({ ...stats, PENDING: 1, INVITED: 1 });
  });

  it('never goes negative and ignores no-op or missing stats', () => {
    expect(shiftStats(stats, 'INVITED', 'REJECTED')).toEqual({ ...stats, INVITED: 0, REJECTED: 1 });
    expect(shiftStats(stats, 'INVITED', 'INVITED')).toBe(stats);
    expect(shiftStats(null, 'PENDING', 'INVITED')).toBeNull();
  });
});

describe('fetchLeadPage search', () => {
  afterEach(() => vi.unstubAllGlobals());

  function stub() {
    const fetchMock = vi.fn<(url: string) => Promise<Response>>(async () => new Response(JSON.stringify({ data: { items: [] } }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  }

  it('sends a trimmed q alongside status and cursor', async () => {
    const fetchMock = stub();
    await fetchLeadPage('PENDING', 'c1', '  A1-1-4  ');
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/admin/residents/leads?status=PENDING&cursor=c1&q=A1-1-4');
  });

  it('omits an empty q and caps a long one at 100 characters', async () => {
    const fetchMock = stub();
    await fetchLeadPage('ALL', undefined, '   ');
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/admin/residents/leads');
    await fetchLeadPage('ALL', undefined, 'x'.repeat(150));
    expect(String(fetchMock.mock.calls[1]?.[0])).toBe(`/api/admin/residents/leads?q=${'x'.repeat(100)}`);
  });
});

describe('search', () => {
  it('folds Arabic-Indic digits', () => {
    expect(normalizeSearch(' ٠١٠ ')).toBe('010');
    expect(normalizeSearch('۱۲۳')).toBe('123');
  });
});

describe('maskIdentifier', () => {
  it('keeps only the last four characters', () => {
    expect(maskIdentifier('29801011234567')).toBe('••••••••••4567');
    expect(maskIdentifier('A123')).toBe('••••A123');
  });
});
