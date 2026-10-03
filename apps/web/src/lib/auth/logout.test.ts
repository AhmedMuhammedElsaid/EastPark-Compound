import { describe, expect, it, vi } from 'vitest';

import { SIGNED_OUT_PATH, signOut } from './logout';

describe('signOut', () => {
  it('calls the logout BFF once, then leaves for /login', async () => {
    const order: string[] = [];
    const request = vi.fn(async () => {
      order.push('request');
    });
    const navigate = vi.fn((path: string) => {
      order.push(`navigate:${path}`);
    });

    await signOut(undefined, { request, navigate });

    expect(request).toHaveBeenCalledTimes(1);
    expect(order).toEqual(['request', `navigate:${SIGNED_OUT_PATH}`]);
    expect(SIGNED_OUT_PATH).toBe('/login');
  });

  it('still leaves the app when the logout request fails', async () => {
    const navigate = vi.fn();

    await expect(
      signOut(undefined, { request: () => Promise.reject(new TypeError('Failed to fetch')), navigate }),
    ).resolves.toBeUndefined();

    expect(navigate).toHaveBeenCalledWith('/login');
  });

  it('honours an explicit destination (account deletion returns to the landing page)', async () => {
    const navigate = vi.fn();

    await signOut('/', { request: async () => undefined, navigate });

    expect(navigate).toHaveBeenCalledWith('/');
  });
});
