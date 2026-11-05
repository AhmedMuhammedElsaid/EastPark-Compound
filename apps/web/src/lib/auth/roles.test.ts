import { describe, expect, it } from 'vitest';

import { ASSIGNABLE_ROLES, isAdminRole, isFinanceRole, isSuperAdminRole, ROLES } from './roles';

describe('isAdminRole', () => {
  it.each(['ADMIN', 'SUPER_ADMIN'])('treats %s as admin-like', (role) => {
    expect(isAdminRole(role)).toBe(true);
  });

  it.each(['RESIDENT', 'MERCHANT', 'GUEST', 'ACCOUNTANT', 'admin', '', null, undefined])('rejects %s', (role) => {
    expect(isAdminRole(role)).toBe(false);
  });
});

describe('isFinanceRole', () => {
  it.each(['ACCOUNTANT', 'ADMIN', 'SUPER_ADMIN'])('accepts %s', (role) => {
    expect(isFinanceRole(role)).toBe(true);
  });

  it.each(['RESIDENT', 'MERCHANT', 'GUEST', 'accountant', '', null, undefined])('rejects %s', (role) => {
    expect(isFinanceRole(role)).toBe(false);
  });

  it('lists ACCOUNTANT as a known and assignable role', () => {
    expect(ROLES).toContain('ACCOUNTANT');
    expect(ASSIGNABLE_ROLES).toContain('ACCOUNTANT');
  });
});

describe('isSuperAdminRole', () => {
  it('accepts only SUPER_ADMIN', () => {
    expect(isSuperAdminRole('SUPER_ADMIN')).toBe(true);
    expect(isSuperAdminRole('ADMIN')).toBe(false);
    expect(isSuperAdminRole(null)).toBe(false);
  });
});
