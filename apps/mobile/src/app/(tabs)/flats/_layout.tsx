import { Redirect, Stack } from "expo-router";

import { useAppColors } from "@/lib/hooks/use-app-colors";
import { canBrowseListings } from "@/lib/listings-access";
import { useAppSelector } from "@/store";

/**
 * Flats (sell / rent listings) stack. Signed-in only: the tab button opens the
 * Coming soon sheet for guests, so a guest deep link goes back to the Home landing.
 * Merchants cannot browse listings (backend 403), so they go Home too.
 */
export default function FlatsLayout() {
  const isAuthenticated = useAppSelector(s => s.auth.isAuthenticated);
  const role = useAppSelector(s => s.auth.user?.role);
  const colors = useAppColors();

  if (!isAuthenticated || !canBrowseListings(role))
    return <Redirect href="/(tabs)" />;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
      }}
    />
  );
}
