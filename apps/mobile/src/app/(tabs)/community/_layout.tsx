import { Redirect, Stack } from "expo-router";

import { useAppColors } from "@/lib/hooks/use-app-colors";
import { useAppSelector } from "@/store";

/**
 * Community stack. Not public yet: guests reach it only through a deep link (the tab button opens
 * the Coming soon sheet), so a guest is sent back to the Home landing as a backstop.
 */
export default function CommunityLayout() {
  const isAuthenticated = useAppSelector(s => s.auth.isAuthenticated);
  const colors = useAppColors();

  if (!isAuthenticated)
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
