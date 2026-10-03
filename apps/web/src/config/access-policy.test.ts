import { describe, expect, it } from 'vitest';

import { isBlockedApiPath, isBlockedPagePath, isRestrictedRole } from './access-policy';

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
});
