import { Redirect, Stack } from "expo-router";

import { useAppColors } from "@/lib/hooks/use-app-colors";
import { useAppSelector } from "@/store";

export default function FeedbackLayout() {
  const isAuthenticated = useAppSelector(s => s.auth.isAuthenticated);
  const colors = useAppColors();

  if (!isAuthenticated)
    return <Redirect href="/(auth)/login" />;

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />
  );
}
