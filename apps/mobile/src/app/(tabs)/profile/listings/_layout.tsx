import { Redirect, Stack } from "expo-router";

import { useAppColors } from "@/lib/hooks/use-app-colors";
import { canOwnListings } from "@/lib/listings-access";
import { useAppSelector } from "@/store";

// Backing out of a listing opened from a notification lands on My listings, not Profile.
export const unstable_settings = { anchor: "index" };

/**
 * My listings stack. Only residents own listings (merchants and admins get 403 from
 * the owner endpoints), so a guest deep link (for example a LISTING_UPDATE
 * notification tapped after sign-out) goes Home and any other role goes to Profile.
 */
export default function ProfileListingsLayout() {
  const isAuthenticated = useAppSelector(s => s.auth.isAuthenticated);
  const role = useAppSelector(s => s.auth.user?.role);
  const colors = useAppColors();

  if (!isAuthenticated)
    return <Redirect href="/(tabs)" />;
  if (!canOwnListings(role))
    return <Redirect href="/(tabs)/profile" />;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
      }}
    />
  );
}
