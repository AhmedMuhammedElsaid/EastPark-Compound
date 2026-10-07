import { describe, expect, it } from 'vitest';

import {
  type LeadStats,
  type ResidentLead,
  leadActions,
  leadErrorKey,
  leadMatches,
  maskIdentifier,
  normalizeSearch,
  shiftStats,
} from './resident-leads';

const lead: ResidentLead = {
  id: 'lead-1',
  name: 'Jane Doe',
  email: 'jane@example.com',
  phone: '01000400163',
  building: 'A2',
  floor: 'G',
  flatNumber: '3',
  status: 'PENDING',
  createdAt: '2026-10-01T10:00:00.000Z',
};

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

describe('search', () => {
  it('folds Arabic-Indic digits', () => {
    expect(normalizeSearch(' ٠١٠ ')).toBe('010');
    expect(normalizeSearch('۱۲۳')).toBe('123');
  });

  it('matches name, email, unit and phone digits', () => {
    expect(leadMatches(lead, 'jane')).toBe(true);
    expect(leadMatches(lead, 'EXAMPLE.com')).toBe(true);
    expect(leadMatches(lead, 'a2 g 3')).toBe(true);
    expect(leadMatches(lead, '0100 0400')).toBe(true);
    expect(leadMatches(lead, '٠١٠٠٠٤')).toBe(true);
    expect(leadMatches(lead, 'someone else')).toBe(false);
    expect(leadMatches(lead, '   ')).toBe(true);
  });
});

describe('maskIdentifier', () => {
  it('keeps only the last four characters', () => {
    expect(maskIdentifier('29801011234567')).toBe('••••••••••4567');
    expect(maskIdentifier('A123')).toBe('••••A123');
  });
});
