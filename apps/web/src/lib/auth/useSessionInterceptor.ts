'use client';

import type { AuthUser } from '@/lib/api/contracts';

import { useRouter } from 'next/navigation';
import * as React from 'react';

import { loginPath } from '@/lib/auth/return-path';

/** Focus/visibility re-validation runs at most once per interval (each call hits the backend). */
export const SESSION_REVALIDATE_INTERVAL_MS = 60_000;

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

type SessionInterceptorOptions = {
  user: AuthUser | null;
  clearSession: () => void;
  validateSession: () => Promise<AuthUser | null>;
};

export function useSessionInterceptor({
  user,
  clearSession,
  validateSession,
}: SessionInterceptorOptions): void {
  const router = useRouter();
  const userRef = React.useRef<AuthUser | null>(user);
  const redirectingRef = React.useRef(false);
  const lastValidatedAtRef = React.useRef(0);

  React.useEffect(() => {
    userRef.current = user;
    if (user) redirectingRef.current = false;
  }, [user]);

  const redirectToLogin = React.useCallback(() => {
    if (redirectingRef.current || window.location.pathname === '/login') return;
    redirectingRef.current = true;
    userRef.current = null;
    clearSession();
    router.replace(loginPath(`${window.location.pathname}${window.location.search}`));
  }, [clearSession, router]);

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

  React.useEffect(() => {
    const validateVisibleSession = async () => {
      const hadSession = Boolean(userRef.current);
      if (document.visibilityState !== 'visible' || !hadSession) return;
      const now = Date.now();
      if (now - lastValidatedAtRef.current < SESSION_REVALIDATE_INTERVAL_MS) return;
      lastValidatedAtRef.current = now;
      const sessionUser = await validateSession();
      if (!sessionUser && hadSession) redirectToLogin();
    };

    const handleVisibilityChange = () => {
      void validateVisibleSession();
    };

    window.addEventListener('focus', handleVisibilityChange);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('focus', handleVisibilityChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [redirectToLogin, validateSession]);
}