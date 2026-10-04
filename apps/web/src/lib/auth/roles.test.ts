import { describe, expect, it } from 'vitest';

import { isAdminRole, isSuperAdminRole } from './roles';

describe('isAdminRole', () => {
  it.each(['ADMIN', 'SUPER_ADMIN'])('treats %s as admin-like', (role) => {
    expect(isAdminRole(role)).toBe(true);
  });

  it.each(['RESIDENT', 'MERCHANT', 'GUEST', 'admin', '', null, undefined])('rejects %s', (role) => {
    expect(isAdminRole(role)).toBe(false);
  });
});

describe('isSuperAdminRole', () => {
  it('accepts only SUPER_ADMIN', () => {
    expect(isSuperAdminRole('SUPER_ADMIN')).toBe(true);
    expect(isSuperAdminRole('ADMIN')).toBe(false);
    expect(isSuperAdminRole(null)).toBe(false);
  });
});
