import { describe, expect, it } from 'vitest';

import { isBlockedApiPath, isBlockedPagePath, isOpenToRestricted, isRestrictedRole } from './access-policy';

describe('isRestrictedRole (home-only lockdown)', () => {
  it('confines residents to /home', () => {
    expect(isRestrictedRole('RESIDENT')).toBe(true);
  });

  it.each(['ADMIN', 'MERCHANT'])('never restricts %s', (role) => {
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

  it('keeps every other section locked', () => {
    for (const path of ['/directory', '/announcements/1', '/governance', '/feedback', '/notifications', '/orders', '/reports', '/cart', '/checkout', '/admin']) {
      expect(isBlockedPagePath(path)).toBe(true);
    }
    for (const path of ['/api/shops', '/api/announcements', '/api/governance/polls', '/api/feedback', '/api/notifications', '/api/orders', '/api/reports', '/api/admin/polls']) {
      expect(isBlockedApiPath(path)).toBe(true);
    }
  });
});

describe('isOpenToRestricted (navigation links)', () => {
  it.each(['/home', '/home#account', '/profile', '/profile?tab=1', '/profile/details'])('allows %s', (href) => {
    expect(isOpenToRestricted(href)).toBe(true);
  });

  it.each(['/directory', '/profiles', '/homework', '/notifications', '/'])('gates %s', (href) => {
    expect(isOpenToRestricted(href)).toBe(false);
  });
});
