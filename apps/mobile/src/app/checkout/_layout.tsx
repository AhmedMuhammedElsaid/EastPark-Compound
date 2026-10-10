import { Redirect, Stack } from "expo-router";

import { useAppColors } from "@/lib/hooks/use-app-colors";
import { useAppSelector } from "@/store";

/**
 * Checkout stack. Ordering is not public yet: the header cart opens the Coming soon sheet for
 * guests, so a guest deep link here is sent back to the Home landing as a backstop.
 */
export default function CheckoutLayout() {
  const colors = useAppColors();
  const isAuthenticated = useAppSelector(s => s.auth.isAuthenticated);

  if (!isAuthenticated)
    return <Redirect href="/(tabs)" />;

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
      <Stack.Screen name="confirmation" options={{ gestureEnabled: false }} />
    </Stack>
  );
}
