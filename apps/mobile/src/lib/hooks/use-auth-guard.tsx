import { router } from "expo-router";
import { useCallback } from "react";

import { useAppDispatch, useAppSelector } from "@/store";
import { showAuthWall } from "@/store/slices/auth-slice";

/**
 * useAuthGuard — for in-screen actions that require auth (e.g. "Add to Cart" as guest).
 *
 * Usage:
 *   const { requireAuth } = useAuthGuard();
 *   <Pressable onPress={() => requireAuth(() => addToCart(item))} />
 *
 * If authenticated → runs the action immediately.
 * If not authenticated → opens AuthWallSheet.
 * The action re-plays after successful login is not automatic in this version —
 * screens with critical post-login actions should check isAuthenticated on re-render.
 */
export function useAuthGuard() {
  const dispatch = useAppDispatch();
  const isAuthenticated = useAppSelector(s => s.auth.isAuthenticated);

  const requireAuth = useCallback(
    (action: () => void, message?: string) => {
      if (isAuthenticated) {
        action();
      }
      else {
        dispatch(showAuthWall({ message }));
      }
    },
    [isAuthenticated, dispatch],
  );

  /**
   * requireAuthNavigation — for tab/route navigation that requires auth.
   * If not auth → shows auth wall. If auth → navigates to the route.
   */
  const requireAuthNavigation = useCallback(
    (href: string, message?: string) => {
      if (isAuthenticated) {
        router.push(href as any);
      }
      else {
        dispatch(showAuthWall({ message }));
      }
    },
    [isAuthenticated, dispatch],
  );

  return { requireAuth, requireAuthNavigation, isAuthenticated };
}
