import { Redirect, Stack } from "expo-router";

import { useAppColors } from "@/lib/hooks/use-app-colors";
import { useAppSelector } from "@/store";

/**
 * Orders stack — auth-guarded.
 * Guests who tap the Orders tab are redirected to the auth wall via login screen.
 */
export default function OrdersLayout() {
  const isAuthenticated = useAppSelector(s => s.auth.isAuthenticated);
  const colors = useAppColors();

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
      }}
    />
  );
}
