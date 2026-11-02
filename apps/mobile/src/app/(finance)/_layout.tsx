import type { RootState } from "@/store";
import { Redirect, Stack } from "expo-router";
import { useSelector } from "react-redux";

import { isFinanceRole } from "@/lib/roles";

export default function FinanceLayout() {
  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);
  const role = useSelector((state: RootState) => state.auth.user?.role);
  if (!isAuthenticated)
    return <Redirect href="/(auth)/login" />;
  if (!isFinanceRole(role))
    return <Redirect href="/(tabs)" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
