/** Where every sign-out lands. */
export const SIGNED_OUT_PATH = '/login';

type SignOutDeps = {
  /** Clears the HttpOnly session cookies (and revokes the refresh token) through the BFF. */
  request?: () => Promise<unknown>;
  /** Leaves the app. Defaults to a full-document `location.replace`. */
  navigate?: (path: string) => void;
};

function requestLogout(): Promise<unknown> {
  return fetch('/api/auth/logout', {
    method: 'POST',
    cache: 'no-store',
    signal: AbortSignal.timeout(10_000),
  });
}

/**
 * Signs out and leaves the app. The navigation is a full-document `location.replace`, not a client
 * router push: it drops the React tree, every in-memory cache and the client router cache, and it
 * replaces the current history entry so Back cannot return to it. It runs even when the logout
 * request fails, so the button always leaves the app shell. Never throws.
 */
export async function signOut(destination: string = SIGNED_OUT_PATH, deps: SignOutDeps = {}): Promise<void> {
  try {
    await (deps.request ?? requestLogout)();
  } catch {
    // The BFF clears the cookies even when the backend is down; only a failure to reach the BFF
    // itself lands here, and the user must still leave the app.
  }
  (deps.navigate ?? ((path: string) => window.location.replace(path)))(destination);
}
