import { describe, expect, it, vi } from 'vitest';

import { readSessionCheck, shareInFlight } from './session-check';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('readSessionCheck', () => {
  it('reports signed_out only for an explicit null user', async () => {
    await expect(readSessionCheck(json(200, { data: { user: null } }))).resolves.toEqual({ status: 'signed_out' });
  });

  it('reports the user when authenticated', async () => {
    await expect(readSessionCheck(json(200, { data: { user: { id: 'u1' } } }))).resolves.toMatchObject({
      status: 'authenticated',
      user: { id: 'u1' },
    });
  });

  it.each([
    [429, { error: 'rate_limited' }],
    [503, { error: 'network' }],
    [200, { unexpected: true }],
  ])('treats %s as unknown, never as a sign-out', async (status, body) => {
    await expect(readSessionCheck(json(status, body))).resolves.toEqual({ status: 'unknown' });
  });
});

describe('shareInFlight', () => {
  it('runs one task for concurrent callers and a fresh one afterwards', async () => {
    let release!: () => void;
    const task = vi.fn(() => new Promise<string>((resolve) => { release = () => resolve('done'); }));
    const run = shareInFlight(task);
    const first = run();
    const second = run();
    expect(second).toBe(first);
    release();
    await expect(first).resolves.toBe('done');
    void run();
    expect(task).toHaveBeenCalledTimes(2);
  });
});
