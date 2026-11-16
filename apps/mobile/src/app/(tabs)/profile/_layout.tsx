import { Stack } from "expo-router";

import { useAppColors } from "@/lib/hooks/use-app-colors";

// Without this (plus `withAnchor` on the pushing side), a cross-tab push to `profile/listings` (Flats tab -> My listings, a
// LISTING_UPDATE notification) builds the stack as [listings] only, and the Profile
// tab then opens My listings with no Profile screen beneath it. Same fix as orders.
export const unstable_settings = { anchor: "index" };

/**
 * Profile stack layout.
 * No hard redirect — profile shows a guest CTA when not authenticated.
 * This matches the design: guests can reach profile but see a sign-in prompt.
 */
export default function ProfileLayout() {
  const colors = useAppColors();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
      }}
    />
  );
}
