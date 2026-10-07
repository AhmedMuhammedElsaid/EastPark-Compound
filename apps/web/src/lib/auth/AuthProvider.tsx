'use client';

import type { AuthUser, LoginPayload } from '@/lib/api/contracts';

import * as React from 'react';

import { signOut } from '@/lib/auth/logout';
import { readSessionCheck, shareInFlight, type SessionCheck } from '@/lib/auth/session-check';
import { useSessionInterceptor } from '@/lib/auth/useSessionInterceptor';
import { keepUnits } from '@/lib/units';

export type LoginError = 'invalid_credentials' | 'network' | 'rate_limited' | 'server' | 'unverified' | 'validation';
type LoginResult = { ok: true; user: AuthUser } | { ok: false; error: LoginError };

type AuthContextValue = {
  user: AuthUser | null;
  isLoading: boolean;
  login: (payload: LoginPayload) => Promise<LoginResult>;
  establishSession: (user: AuthUser) => void;
  /** Signs out and leaves the app for `/login` (or `redirectTo`) with a full-page replace. */
  logout: (options?: { redirectTo?: string }) => Promise<void>;
  refreshUser: () => Promise<AuthUser | null>;
};

const AuthContext = React.createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  const refreshUser = React.useCallback(async (): Promise<AuthUser | null> => {
    try {
      const response = await fetch('/api/auth/session', {
        cache: 'no-store',
        signal: AbortSignal.timeout(30_000),
      });
      if (!response.ok) return null;
      const payload = (await response.json()) as { data: { user: AuthUser | null } };
      setUser(payload.data.user);
      return payload.data.user;
    } catch {
      return null;
    }
  }, []);

  React.useEffect(() => {
    let active = true;
    void fetch('/api/auth/session', {
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    })
      .then(async (response) => {
        if (!response.ok) return null;
        const payload = (await response.json()) as { data: { user: AuthUser | null } };
        return payload.data.user;
      })
      .catch(() => null)
      .then((sessionUser) => {
        if (active) {
          setUser(sessionUser);
          setIsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  // One deduplicated `/api/auth/session` probe. It also adopts a newer cookie pair that a
  // concurrent request may have stored, so a lost refresh race does not look like a sign-out.
  const checkSession = React.useMemo(
    () =>
      shareInFlight(async (): Promise<SessionCheck> => {
        try {
          const response = await fetch('/api/auth/session', {
            cache: 'no-store',
            signal: AbortSignal.timeout(30_000),
          });
          const result = await readSessionCheck(response);
          if (result.status === 'authenticated') setUser(result.user);
          return result;
        } catch {
          return { status: 'unknown' };
        }
      }),
    [],
  );

  const clearSession = React.useCallback(() => setUser(null), []);
  useSessionInterceptor({ user, clearSession, checkSession });

  const authenticate = React.useCallback(async (path: string, payload: unknown): Promise<LoginResult> => {
    try {
      const response = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(30_000),
      });
      const result = (await response.json()) as
        | { data: { user: AuthUser } }
        | { error: LoginError };

      if (!response.ok || !('data' in result)) {
        return { ok: false, error: 'error' in result ? result.error : 'server' };
      }

      // Login responses carry no `units`; keep any already known and load them from the profile.
      setUser((previous) => keepUnits(previous, result.data.user));
      void refreshUser();
      return { ok: true, user: result.data.user };
    } catch {
      return { ok: false, error: 'network' };
    }
  }, [refreshUser]);

  const login = React.useCallback(
    (payload: LoginPayload) => authenticate('/api/auth/login', payload),
    [authenticate],
  );

  const logout = React.useCallback(async (options?: { redirectTo?: string }) => {
    // Drop the signed-in UI at once (no Profile/Logout/Admin items) while the request runs.
    // `isLoading` keeps auth guards from firing their own client redirects meanwhile; `signOut`
    // then replaces the whole document.
    setIsLoading(true);
    setUser(null);
    await signOut(options?.redirectTo);
  }, []);

  // A page restored from the back/forward cache keeps its old in-memory user. Re-check the session
  // so Back after signing out shows the signed-out state instead of the old account.
  React.useEffect(() => {
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) void refreshUser();
    };
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, [refreshUser]);

  // Accept-invitation responses carry no `units`: keep any already known, then load the profile.
  const establishSession = React.useCallback((sessionUser: AuthUser) => {
    setUser((previous) => keepUnits(previous, sessionUser));
    void refreshUser();
  }, [refreshUser]);

  const value = React.useMemo(
    () => ({ user, isLoading, login, establishSession, logout, refreshUser }),
    [user, isLoading, login, establishSession, logout, refreshUser],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = React.useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used within AuthProvider');
  return value;
}
