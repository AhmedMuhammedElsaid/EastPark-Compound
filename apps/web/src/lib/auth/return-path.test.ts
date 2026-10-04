import { describe, expect, it } from 'vitest';

import { loginPath, postLoginPath, safeReturnPath, sessionRefreshPath } from './return-path';

describe('safeReturnPath', () => {
  it.each([
    ['/home', '/home'],
    ['/orders/abc?tab=items#top', '/orders/abc?tab=items#top'],
    ['/directory/shop%20one', '/directory/shop%20one'],
    // Encoded slashes are a single same-origin path segment, not a host.
    ['/%2F%2Fevil.com', '/%2F%2Fevil.com'],
    ['/%5Cevil.com', '/%5Cevil.com'],
    ['/a/../governance', '/governance'],
  ])('keeps same-origin path %s', (input, expected) => {
    expect(safeReturnPath(input)).toBe(expected);
  });

  it.each([
    ['/\\evil.com'],
    ['\\\\evil.com'],
    ['/\\/evil.com'],
    ['//evil.com'],
    ['///evil.com'],
    ['https://evil.com'],
    ['http://evil.com/home'],
    ['javascript:alert(1)'],
    ['/\t/evil.com'],
    ['/\n/evil.com'],
    ['/\r\n/evil.com'],
    ['/.//evil.com'],
    ['evil.com'],
    ['%2F%2Fevil.com'],
    ['/api/auth/logout'],
    ['/api'],
    [''],
    [null],
    [undefined],
    [`/${'a'.repeat(3000)}`],
  ])('rejects %j', (input) => {
    expect(safeReturnPath(input)).toBe('/home');
  });

  it('uses the supplied fallback', () => {
    expect(safeReturnPath('//evil.com', '/admin')).toBe('/admin');
  });
});

describe('loginPath / sessionRefreshPath', () => {
  it('encodes a validated next path', () => {
    expect(loginPath('/orders/1')).toBe('/login?next=%2Forders%2F1');
    expect(loginPath('/\\evil.com')).toBe('/login?next=%2Fhome');
    expect(loginPath()).toBe('/login');
  });

  it('builds the refresh bounce URL', () => {
    expect(sessionRefreshPath('/notifications')).toBe('/api/auth/refresh?next=%2Fnotifications');
    expect(sessionRefreshPath('/governance', { optional: true })).toBe(
      '/api/auth/refresh?next=%2Fgovernance&optional=1',
    );
    expect(sessionRefreshPath('https://evil.com')).toBe('/api/auth/refresh?next=%2Fhome');
  });
});

describe('postLoginPath', () => {
  it('honours a safe next path', () => {
    expect(postLoginPath('RESIDENT', '/orders/o1')).toBe('/orders/o1');
  });

  it('falls back to the role home', () => {
    expect(postLoginPath('RESIDENT', null)).toBe('/home');
    expect(postLoginPath('MERCHANT', undefined)).toBe('/home');
    expect(postLoginPath('ADMIN', 'https://evil.example')).toBe('/admin');
    expect(postLoginPath('SUPER_ADMIN', null)).toBe('/admin');
  });

  it('never sends a signed-in user back to the login page', () => {
    expect(postLoginPath('RESIDENT', '/login?next=%2Fhome')).toBe('/home');
    expect(postLoginPath('ADMIN', '/login')).toBe('/admin');
  });
});
