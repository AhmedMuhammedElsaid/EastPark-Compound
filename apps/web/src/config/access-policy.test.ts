import { describe, expect, it } from 'vitest';

import {
  isBlockedApiPath,
  isBlockedPagePath,
  isOpenToRestricted,
  isPathAllowedForRole,
  isRestrictedRole,
} from './access-policy';

describe('isRestrictedRole (home-only lockdown)', () => {
  it('confines residents to /home', () => {
    expect(isRestrictedRole('RESIDENT')).toBe(true);
  });

  it.each(['ADMIN', 'SUPER_ADMIN', 'MERCHANT'])('never restricts %s', (role) => {
    expect(isRestrictedRole(role)).toBe(false);
  });

  it('does not restrict guests', () => {
    expect(isRestrictedRole(null)).toBe(false);
    expect(isRestrictedRole(undefined)).toBe(false);
  });

  it('still lists the merchant sections as gated paths for restricted roles', () => {
    expect(isBlockedPagePath('/merchant/orders')).toBe(true);
    expect(isBlockedApiPath('/api/merchant/orders')).toBe(true);
  });

  it('opens the profile page and the BFF routes it needs to residents', () => {
    expect(isBlockedPagePath('/profile')).toBe(false);
    expect(isBlockedApiPath('/api/profile')).toBe(false);
    expect(isBlockedApiPath('/api/uploads/image')).toBe(false);
    expect(isBlockedApiPath('/api/auth/logout')).toBe(false);
    expect(isBlockedApiPath('/api/auth/session')).toBe(false);
  });

  it('opens the shops directory and its BFF routes to residents', () => {
    for (const path of ['/directory', '/directory/shop-1', '/directory/shop-1/menu']) {
      expect(isBlockedPagePath(path)).toBe(false);
    }
    for (const path of ['/api/shops', '/api/shops/shop-1', '/api/shops/shop-1/products', '/api/shops/shop-1/reviews', '/api/shops/shop-1/save']) {
      expect(isBlockedApiPath(path)).toBe(false);
    }
  });

  it('keeps ordering and every other section locked', () => {
    for (const path of ['/announcements/1', '/governance', '/feedback', '/notifications', '/orders', '/reports', '/cart', '/checkout', '/admin']) {
      expect(isBlockedPagePath(path)).toBe(true);
    }
    for (const path of ['/api/announcements', '/api/governance/polls', '/api/feedback', '/api/notifications', '/api/orders', '/api/reports', '/api/admin/polls']) {
      expect(isBlockedApiPath(path)).toBe(true);
    }
  });
});

describe('isOpenToRestricted (navigation links)', () => {
  it.each(['/home', '/home#account', '/profile', '/profile?tab=1', '/profile/details'])('allows %s', (href) => {
    expect(isOpenToRestricted(href)).toBe(true);
  });

  it.each(['/directory', '/directory?category=CAFE_AND_FOOD', '/directory/shop-1/menu'])('allows %s', (href) => {
    expect(isOpenToRestricted(href)).toBe(true);
  });

  it.each(['/directories', '/cart', '/checkout', '/orders', '/profiles', '/homework', '/notifications', '/'])('gates %s', (href) => {
    expect(isOpenToRestricted(href)).toBe(false);
  });
});

describe('finance lockdown (accounting 8.1)', () => {
  it('blocks staff finance for a resident, in both directions', () => {
    for (const path of ['/finance', '/finance/flats/x']) {
      expect(isBlockedPagePath(path)).toBe(true);
      expect(isPathAllowedForRole('RESIDENT', path, 'page')).toBe(false);
    }
    expect(isBlockedApiPath('/api/finance/payments')).toBe(true);
    expect(isPathAllowedForRole('RESIDENT', '/api/finance/payments', 'api')).toBe(false);
    for (const path of ['/home/finance', '/home/finance/reports/1']) {
      expect(isBlockedPagePath(path)).toBe(false);
      expect(isPathAllowedForRole('RESIDENT', path, 'page')).toBe(true);
    }
    expect(isBlockedApiPath('/api/me/finance/flats')).toBe(false);
    expect(isPathAllowedForRole('RESIDENT', '/api/me/finance/flats', 'api')).toBe(true);
  });

  it('confines ACCOUNTANT to its own allow-list and does not make it unrestricted', () => {
    expect(isRestrictedRole('ACCOUNTANT')).toBe(true);
    for (const path of ['/finance', '/finance/flats/1', '/home', '/profile', '/notifications']) {
      expect(isPathAllowedForRole('ACCOUNTANT', path, 'page')).toBe(true);
    }
    for (const path of ['/api/finance/payments', '/api/me/finance/flats', '/api/auth/logout', '/api/profile', '/api/uploads/image', '/api/notifications/preferences']) {
      expect(isPathAllowedForRole('ACCOUNTANT', path, 'api')).toBe(true);
    }
    for (const path of ['/orders', '/cart', '/checkout', '/merchant', '/admin', '/directory', '/directory/shop-1', '/announcements', '/governance', '/feedback', '/reports', '/financex']) {
      expect(isPathAllowedForRole('ACCOUNTANT', path, 'page')).toBe(false);
    }
    for (const path of ['/api/orders', '/api/admin/polls', '/api/merchant/orders', '/api/shops', '/api/announcements']) {
      expect(isPathAllowedForRole('ACCOUNTANT', path, 'api')).toBe(false);
    }
  });

  it.each(['ADMIN', 'SUPER_ADMIN', 'MERCHANT'])('leaves %s unrestricted', (role) => {
    for (const path of ['/finance', '/admin', '/orders', '/directory']) {
      expect(isPathAllowedForRole(role, path, 'page')).toBe(true);
    }
    expect(isPathAllowedForRole(role, '/api/orders', 'api')).toBe(true);
  });

  // Slice 8 desk: every page and BFF route the accountant uses; a resident reaches none of them.
  // (MERCHANT passes the proxy like every unrestricted role; the `/finance` layout guard
  // `getFinanceSession` and the backend refuse it, see test/finance-session.test.ts.)
  const DESK_PAGES = ['/finance', '/finance/flats', '/finance/flats/flat_A1-3-2', '/finance/payments', '/finance/payments/new', '/finance/payments/p1', '/finance/audit'];
  const DESK_APIS = ['/api/finance/flats', '/api/finance/flats/flat_A1-3-2/apply-credit', '/api/finance/charges', '/api/finance/payments', '/api/finance/payments/p1/cheque-bounced', '/api/finance/attachments', '/api/finance/attachments/view', '/api/finance/audit'];

  it('opens the whole desk to ACCOUNTANT and none of it to a resident', () => {
    for (const path of DESK_PAGES) {
      expect(isPathAllowedForRole('ACCOUNTANT', path, 'page')).toBe(true);
      expect(isPathAllowedForRole('RESIDENT', path, 'page')).toBe(false);
    }
    for (const path of DESK_APIS) {
      expect(isPathAllowedForRole('ACCOUNTANT', path, 'api')).toBe(true);
      expect(isPathAllowedForRole('RESIDENT', path, 'api')).toBe(false);
    }
  });

  it('judges links by role: ACCOUNTANT opens /finance, a resident does not', () => {
    expect(isOpenToRestricted('/finance', 'ACCOUNTANT')).toBe(true);
    expect(isOpenToRestricted('/notifications', 'ACCOUNTANT')).toBe(true);
    expect(isOpenToRestricted('/directory', 'ACCOUNTANT')).toBe(false);
    expect(isOpenToRestricted('/finance', 'RESIDENT')).toBe(false);
    expect(isOpenToRestricted('/finance')).toBe(false);
    expect(isOpenToRestricted('/directory', 'RESIDENT')).toBe(true);
  });
});

describe('lockdown flag off (RESIDENT_HOME_ONLY = false)', () => {
  it('keeps ACCOUNTANT confined to its allow-list', () => {
    expect(isRestrictedRole('ACCOUNTANT', false)).toBe(true);
    for (const path of ['/finance', '/home', '/profile', '/notifications']) {
      expect(isPathAllowedForRole('ACCOUNTANT', path, 'page', false)).toBe(true);
    }
    for (const path of ['/directory', '/orders', '/cart', '/merchant', '/admin', '/announcements']) {
      expect(isPathAllowedForRole('ACCOUNTANT', path, 'page', false)).toBe(false);
    }
    expect(isPathAllowedForRole('ACCOUNTANT', '/api/orders', 'api', false)).toBe(false);
    expect(isPathAllowedForRole('ACCOUNTANT', '/api/finance/payments', 'api', false)).toBe(true);
  });

  it.each(['RESIDENT', 'ADMIN', 'SUPER_ADMIN', 'MERCHANT'])('frees %s', (role) => {
    expect(isRestrictedRole(role, false)).toBe(false);
    expect(isPathAllowedForRole(role, '/orders', 'page', false)).toBe(true);
    expect(isPathAllowedForRole(role, '/api/orders', 'api', false)).toBe(true);
  });

  it('does not restrict guests', () => {
    expect(isRestrictedRole(null, false)).toBe(false);
    expect(isRestrictedRole(undefined, false)).toBe(false);
  });
});
