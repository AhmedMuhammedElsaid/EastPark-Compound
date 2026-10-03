import { beforeEach, describe, expect, it, vi } from 'vitest';

const authCookies = vi.fn();
const getProfile = vi.fn();

vi.mock('@/lib/auth/server', () => ({
  authCookies: () => authCookies(),
  getProfile: () => getProfile(),
  BackendRateLimitedError: class extends Error {},
}));

const { GET } = await import('./route');

describe('GET /api/auth/session', () => {
  beforeEach(() => {
    authCookies.mockReset();
    getProfile.mockReset();
  });

  it('marks a signed-out answer private, no-store', async () => {
    authCookies.mockResolvedValue({});
    const response = await GET();
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    await expect(response.json()).resolves.toEqual({ data: { user: null } });
  });

  it.each([
    [{ status: 'authenticated', user: { id: 'u1' } }, 200],
    [{ status: 'rate_limited' }, 429],
    [{ status: 'unavailable' }, 503],
    [{ status: 'unauthenticated' }, 200],
  ])('marks %o private, no-store', async (profile, status) => {
    authCookies.mockResolvedValue({ accessToken: 'a' });
    getProfile.mockResolvedValue(profile);
    const response = await GET();
    expect(response.status).toBe(status);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
  });
});
