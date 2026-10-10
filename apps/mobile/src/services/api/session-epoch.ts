/**
 * Session generation counter + a tiny lock for the stored auth tokens.
 *
 * Every sign-out (teardown) and every sign-in bumps the epoch. Work that
 * started under an older epoch (a token refresh still in flight, a request
 * sent by the previous session) must never write tokens or replay requests
 * once the epoch moved on.
 *
 * SecureStore writes and deletes are not ordered against each other, so the
 * phases that touch the stored token pair (refresh write, teardown delete,
 * login write) run one at a time through `withAuthStorageLock`.
 *
 * Leaf module: no imports, so session and client code can both use it
 * without import cycles.
 */

let epoch = 0;

export function getSessionEpoch(): number {
  return epoch;
}

/** Synchronous: call it before any await in sign-out / sign-in paths. */
export function bumpSessionEpoch(): number {
  epoch += 1;
  return epoch;
}

let lockTail: Promise<unknown> = Promise.resolve();

/** Runs `fn` after every earlier holder released the lock (even on error). */
export function withAuthStorageLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = lockTail.then(fn, fn);
  lockTail = run.catch(() => {});
  return run;
}
