import type { RootState } from "@/store";
import { Redirect, Stack } from "expo-router";
import { useSelector } from "react-redux";

export default function MerchantLayout() {
  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);
  const role = useSelector((state: RootState) => state.auth.user?.role);
  if (!isAuthenticated)
    return <Redirect href="/(auth)/login" />;
  if (role !== "MERCHANT")
    return <Redirect href="/(tabs)" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
