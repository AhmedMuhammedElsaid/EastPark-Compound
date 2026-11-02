import type { Href } from "expo-router";
import type { ComingSoonFeature } from "@/lib/coming-soon";
import { router } from "expo-router";
import { useCallback } from "react";

import { openComingSoon } from "@/lib/coming-soon";
import { isAccountantRole } from "@/lib/roles";
import { useAppSelector } from "@/store";

/**
 * useGuestGate — locks the not-yet-public features for guests (mirrors the web `GatedLink`).
 *
 * Usage:
 *   const { gate, gateNavigation } = useGuestGate();
 *   <Pressable onPress={() => gateNavigation("/(tabs)/orders", "market")} />
 *
 * Signed in → the action runs / the route opens as before.
 * Guest → the Coming soon sheet opens instead (with a Sign in button). Nothing is
 * remembered for after login: the guest is choosing to sign in, not finishing an action.
 */
export function useGuestGate() {
  const isAuthenticated = useAppSelector(s => s.auth.isAuthenticated);
  const role = useAppSelector(s => s.auth.user?.role);
  const isAccountant = isAccountantRole(role);

  const gate = useCallback(
    (action: () => void, feature?: ComingSoonFeature) => {
      // The accountant role is confined like a guest, but only for the named market / community
      // features; calls without a feature (notifications) stay open because the backend allows them.
      const locked = !isAuthenticated || (isAccountant && feature !== undefined);
      if (locked)
        openComingSoon(feature);
      else action();
    },
    [isAuthenticated, isAccountant],
  );

  const gateNavigation = useCallback(
    (href: string, feature?: ComingSoonFeature) => gate(() => router.push(href as Href), feature),
    [gate],
  );

  return { gate, gateNavigation, isGuest: !isAuthenticated };
}
