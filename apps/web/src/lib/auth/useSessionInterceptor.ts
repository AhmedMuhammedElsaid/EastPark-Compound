'use client';

import type { AuthUser } from '@/lib/api/contracts';

import * as React from 'react';

import type { SessionCheck } from '@/lib/auth/session-check';

import { loginPath } from '@/lib/auth/return-path';

/** Focus/visibility re-validation runs at most once per interval (each call hits the backend). */
export const SESSION_REVALIDATE_INTERVAL_MS = 60_000;

const PUBLIC_AUTH_ENDPOINTS = new Set([
  '/api/auth/accept-invitation',
  '/api/auth/forgot-password',
  '/api/auth/login',
  '/api/auth/logout',
  '/api/auth/reset-password',
  '/api/auth/session',
]);

type SessionInterceptorOptions = {
  user: AuthUser | null;
  clearSession: () => void;
  /** Deduplicated `/api/auth/session` probe. Only `signed_out` may log the browser out. */
  checkSession: () => Promise<SessionCheck>;
};

export function useSessionInterceptor({
  user,
  clearSession,
  checkSession,
}: SessionInterceptorOptions): void {
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
    // Full-document replace, like a manual sign-out: drops the client router cache and in-memory
    // state, and Back cannot return to the signed-in page.
    window.location.replace(loginPath(`${window.location.pathname}${window.location.search}`));
  }, [clearSession]);

  // A BFF 401 is not proof of a sign-out: a concurrent request may have won the single-use refresh
  // rotation and already stored a newer cookie pair. Re-check the session once before logging out,
  // and never on a throttled/unavailable backend.
  const confirmSignedOut = React.useCallback(async () => {
    if (redirectingRef.current) return;
    const result = await checkSession();
    if (result.status === 'signed_out') redirectToLogin();
  }, [checkSession, redirectToLogin]);

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
        void confirmSignedOut();
      }

      return response;
    };

    window.fetch = interceptedFetch;
    return () => {
      if (window.fetch === interceptedFetch) window.fetch = originalFetch;
    };
  }, [confirmSignedOut]);

  React.useEffect(() => {
    const validateVisibleSession = async () => {
      const hadSession = Boolean(userRef.current);
      if (document.visibilityState !== 'visible' || !hadSession) return;
      const now = Date.now();
      if (now - lastValidatedAtRef.current < SESSION_REVALIDATE_INTERVAL_MS) return;
      lastValidatedAtRef.current = now;
      const result = await checkSession();
      if (result.status === 'signed_out' && hadSession) redirectToLogin();
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
  }, [checkSession, redirectToLogin]);
}