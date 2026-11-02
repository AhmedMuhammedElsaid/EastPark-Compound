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

export type OriginBackOptions = {
  /**
   * Origin used when there is no `?from=`. With a fallback the hook always
   * returns a handler and always takes over hardware Back.
   */
  fallback?: "home" | "profile";
  /** Pop this screen first (default true). False for the root screen of its own stack. */
  popFirst?: boolean;
};

/**
 * Screens opened from another tab (Home quick actions, Profile rows) are
 * pushed onto their own tab's stack, so plain Back would land on that tab's
 * root. When the launcher passed `?from=home|profile` (or a `fallback` is
 * given), this returns a handler for the header Back and also takes over the
 * hardware Back button while the screen is focused. Undefined when there is
 * no origin.
 */
export function useOriginBack(options: OriginBackOptions = {}): (() => void) | undefined {
  const { fallback, popFirst = true } = options;
  const { from } = useLocalSearchParams<{ from?: string }>();
  const origin = getOriginRoute(from) ?? (fallback ? ORIGIN_ROUTES[fallback] : undefined);
  const goOrigin = React.useCallback(() => {
    if (!origin)
      return;
    // Pop this screen off its stack first so the tab shows its root again
    // next time, then return to the launching tab.
    if (popFirst && router.canGoBack())
      router.back();
    router.navigate(origin as never);
  }, [origin, popFirst]);

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
