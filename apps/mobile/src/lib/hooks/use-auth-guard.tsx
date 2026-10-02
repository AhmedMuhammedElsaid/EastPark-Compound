import type { Href } from "expo-router";
import { router, usePathname } from "expo-router";
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
 * If not authenticated → opens AuthWallSheet and remembers where the guest was
 * (`pendingRedirect`). After a successful login, `completeLogin()` replaces
 * the route with it, so the guest lands back on the same screen and can
 * finish the action. Callbacks cannot be stored in Redux, so the screen —
 * not the closure — is what replays.
 */
export function useAuthGuard() {
  const dispatch = useAppDispatch();
  const isAuthenticated = useAppSelector(s => s.auth.isAuthenticated);
  const pathname = usePathname();

  const requireAuth = useCallback(
    (action: () => void, message?: string) => {
      if (isAuthenticated) {
        action();
      }
      else {
        dispatch(showAuthWall({ message, redirectAction: pathname || undefined }));
      }
    },
    [isAuthenticated, dispatch, pathname],
  );

  /**
   * requireAuthNavigation — for tab/route navigation that requires auth.
   * If not auth → shows auth wall and replays the navigation after login.
   */
  const requireAuthNavigation = useCallback(
    (href: string, message?: string) => {
      if (isAuthenticated) {
        router.push(href as Href);
      }
      else {
        dispatch(showAuthWall({ message, redirectAction: href }));
      }
    },
    [isAuthenticated, dispatch],
  );

  return { requireAuth, requireAuthNavigation, isAuthenticated };
}
