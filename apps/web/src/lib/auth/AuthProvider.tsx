'use client';

import type { AuthUser, LoginPayload } from '@/lib/api/contracts';

import { useRouter } from 'next/navigation';
import * as React from 'react';

export type LoginError = 'invalid_credentials' | 'network' | 'rate_limited' | 'server' | 'validation';
type LoginResult = { ok: true; user: AuthUser } | { ok: false; error: LoginError };

type AuthContextValue = {
  user: AuthUser | null;
  isLoading: boolean;
  login: (payload: LoginPayload) => Promise<LoginResult>;
  verifyOtp: (email: string, otp: string) => Promise<LoginResult>;
  establishSession: (user: AuthUser) => void;
  logout: () => Promise<void>;
  refreshUser: () => Promise<AuthUser | null>;
};

const AuthContext = React.createContext<AuthContextValue | null>(null);

const PUBLIC_AUTH_ENDPOINTS = new Set([
  '/api/auth/accept-invitation',
  '/api/auth/forgot-password',
  '/api/auth/login',
  '/api/auth/logout',
  '/api/auth/register',
  '/api/auth/resend-otp',
  '/api/auth/reset-password',
  '/api/auth/session',
  '/api/auth/verify-otp',
]);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = React.useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const userRef = React.useRef<AuthUser | null>(null);
  const redirectingRef = React.useRef(false);

  React.useEffect(() => {
    userRef.current = user;
  }, [user]);

  const redirectToLogin = React.useCallback(() => {
    if (redirectingRef.current || window.location.pathname === '/login') return;
    redirectingRef.current = true;
    userRef.current = null;
    setUser(null);
    const requestedPath = `${window.location.pathname}${window.location.search}`;
    router.replace(`/login?next=${encodeURIComponent(requestedPath)}`);
  }, [router]);

  React.useEffect(() => {
    const originalFetch = window.fetch.bind(window);
    const interceptedFetch: typeof window.fetch = async (input, init) => {
      const response = await originalFetch(input, init);
      const rawUrl = typeof input === 'string' || input instanceof URL ? input.toString() : input.url;
      const url = new URL(rawUrl, window.location.origin);

      if (
        response.status === 401 &&
        url.origin === window.location.origin &&
        url.pathname.startsWith('/api/') &&
        !PUBLIC_AUTH_ENDPOINTS.has(url.pathname)
      ) {
        redirectToLogin();
      }

      return response;
    };

    window.fetch = interceptedFetch;
    return () => {
      if (window.fetch === interceptedFetch) window.fetch = originalFetch;
    };
  }, [redirectToLogin]);

  const refreshUser = React.useCallback(async (): Promise<AuthUser | null> => {
    try {
      const response = await fetch('/api/auth/session', {
        cache: 'no-store',
        signal: AbortSignal.timeout(30_000),
      });
      if (!response.ok) return null;
      const payload = (await response.json()) as { data: { user: AuthUser | null } };
      if (!payload.data.user && userRef.current) redirectToLogin();
      setUser(payload.data.user);
      return payload.data.user;
    } catch {
      return null;
    }
  }, [redirectToLogin]);

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

  React.useEffect(() => {
    const validateVisibleSession = () => {
      if (document.visibilityState === 'visible' && userRef.current) void refreshUser();
    };
    window.addEventListener('focus', validateVisibleSession);
    document.addEventListener('visibilitychange', validateVisibleSession);
    return () => {
      window.removeEventListener('focus', validateVisibleSession);
      document.removeEventListener('visibilitychange', validateVisibleSession);
    };
  }, [refreshUser]);

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

      setUser(result.data.user);
      redirectingRef.current = false;
      return { ok: true, user: result.data.user };
    } catch {
      return { ok: false, error: 'network' };
    }
  }, []);

  const login = React.useCallback(
    (payload: LoginPayload) => authenticate('/api/auth/login', payload),
    [authenticate],
  );

  const verifyOtp = React.useCallback(
    (email: string, otp: string) => authenticate('/api/auth/verify-otp', { email, otp }),
    [authenticate],
  );

  const logout = React.useCallback(async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        signal: AbortSignal.timeout(10_000),
      });
    } finally {
      setUser(null);
    }
  }, []);

  const establishSession = React.useCallback((sessionUser: AuthUser) => {
    setUser(sessionUser);
  }, []);

  const value = React.useMemo(
    () => ({ user, isLoading, login, verifyOtp, establishSession, logout, refreshUser }),
    [user, isLoading, login, verifyOtp, establishSession, logout, refreshUser],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = React.useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used within AuthProvider');
  return value;
}
