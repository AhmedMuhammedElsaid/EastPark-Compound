import { describe, expect, it } from 'vitest';

import { isBlockedApiPath, isBlockedPagePath, isOpenToRestricted, isRestrictedRole } from './access-policy';

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
