import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import * as React from "react";
import { BackHandler } from "react-native";

/** Tabs that can launch a Community sub-screen (`?from=` param) and want Back to return to them. */
const ORIGIN_ROUTES: Record<string, string> = {
  home: "/(tabs)",
  profile: "/(tabs)/profile",
};

/** Route Back should return to for a `from` param, or undefined for plain stack Back. */
export function getOriginRoute(from: string | string[] | undefined): string | undefined {
  const key = Array.isArray(from) ? from[0] : from;
  return key && Object.hasOwn(ORIGIN_ROUTES, key) ? ORIGIN_ROUTES[key] : undefined;
}

/**
 * Community sub-screens opened from another tab (Home quick actions, Profile
 * rows) are pushed onto the Community stack, so plain Back would land on the
 * Community feed. When the launcher passed `?from=home|profile`, this returns
 * a handler for the header Back and also takes over the hardware Back button
 * while the screen is focused. Undefined when there is no origin.
 */
export function useOriginBack(): (() => void) | undefined {
  const { from } = useLocalSearchParams<{ from?: string }>();
  const origin = getOriginRoute(from);
  const goOrigin = React.useCallback(() => {
    if (!origin)
      return;
    // Pop this screen off the Community stack first so the Community tab
    // shows its feed again next time, then return to the launching tab.
    if (router.canGoBack())
      router.back();
    router.navigate(origin as never);
  }, [origin]);

  useFocusEffect(
    React.useCallback(() => {
      if (!origin)
        return;
      const sub = BackHandler.addEventListener("hardwareBackPress", () => {
        goOrigin();
        return true;
      });
      return () => sub.remove();
    }, [origin, goOrigin]),
  );

  return origin ? goOrigin : undefined;
}
