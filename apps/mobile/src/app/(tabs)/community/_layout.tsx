import { Redirect, Stack, useSegments } from "expo-router";

import { useAppColors } from "@/lib/hooks/use-app-colors";
import { isAccountantRole } from "@/lib/roles";
import { useAppSelector } from "@/store";

/**
 * Community stack. Not public yet: guests reach it only through a deep link (the tab button opens
 * the Coming soon sheet), so a guest is sent back to the Home landing as a backstop.
 * The accountant role may only use `feedback/*` (the backend grants it feedback and nothing else
 * here); every other screen of the stack sends it back to Home.
 */
export default function CommunityLayout() {
  const isAuthenticated = useAppSelector(s => s.auth.isAuthenticated);
  const role = useAppSelector(s => s.auth.user?.role);
  const segments = useSegments() as string[];
  const colors = useAppColors();

  if (!isAuthenticated)
    return <Redirect href="/(tabs)" />;
  // Tabs stay mounted in the background: only judge the route while the user is inside Community.
  if (isAccountantRole(role) && segments[1] === "community" && segments[2] !== "feedback")
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
