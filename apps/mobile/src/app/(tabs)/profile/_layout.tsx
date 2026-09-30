import { Stack } from "expo-router";

import { useAppColors } from "@/lib/hooks/use-app-colors";

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
