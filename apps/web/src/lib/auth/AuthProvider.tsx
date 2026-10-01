'use client';

import type { AuthUser, LoginPayload } from '@/lib/api/contracts';

import * as React from 'react';

export type LoginError = 'invalid_credentials' | 'network' | 'rate_limited' | 'server' | 'validation';
type LoginResult = { ok: true } | { ok: false; error: LoginError };

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
      return { ok: true };
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
