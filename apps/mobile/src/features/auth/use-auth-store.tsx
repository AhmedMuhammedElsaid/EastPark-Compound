/**
 * Auth store — migrated from Zustand to Redux Toolkit.
 * This file is a thin compat shim. The real auth state lives in:
 *   src/store/slices/auth-slice.ts
 *
 * Phase 2 will remove this file and use authSlice selectors directly.
 */

import { useAppSelector } from "@/store";

export function useIsAuthenticated() {
  return useAppSelector(state => state.auth.isAuthenticated);
}

export function useAuthUser() {
  return useAppSelector(state => state.auth.user);
}
