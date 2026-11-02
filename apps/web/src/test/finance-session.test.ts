import { beforeEach, describe, expect, it, vi } from 'vitest';

const getProfile = vi.fn();

vi.mock('@/lib/auth/server', () => ({
  getProfile: (options: unknown) => getProfile(options),
}));

const { getFinanceSession } = await import('@/lib/auth/finance.server');

const user = (role: string) => ({ id: 'u1', name: 'User', role });

describe('getFinanceSession (the /finance layout guard)', () => {
  beforeEach(() => getProfile.mockReset());

  it.each(['ACCOUNTANT', 'ADMIN', 'SUPER_ADMIN'])('lets %s into the desk', async (role) => {
    getProfile.mockResolvedValue({ status: 'authenticated', accessToken: 'a', user: user(role) });
    await expect(getFinanceSession()).resolves.toMatchObject({ status: 'authenticated', token: 'a' });
  });

  it.each(['RESIDENT', 'MERCHANT'])('refuses %s', async (role) => {
    getProfile.mockResolvedValue({ status: 'authenticated', accessToken: 'a', user: user(role) });
    await expect(getFinanceSession()).resolves.toEqual({ status: 'forbidden' });
  });

  it('never refreshes cookies from the layout (read-only render)', async () => {
    getProfile.mockResolvedValue({ status: 'refresh-required' });
    await expect(getFinanceSession()).resolves.toEqual({ status: 'refresh-required' });
    expect(getProfile).toHaveBeenCalledWith({ mutateCookies: false });
  });
});
