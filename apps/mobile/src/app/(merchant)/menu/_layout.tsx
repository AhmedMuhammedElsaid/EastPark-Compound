import { Stack } from "expo-router";

import { useAppColors } from "@/lib/hooks/use-app-colors";

export default function MerchantMenuLayout() {
  const colors = useAppColors();
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />
  );
}
