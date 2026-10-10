import { useIsFocused } from "@react-navigation/native";
import * as React from "react";
import { AppState } from "react-native";

/**
 * True while the screen is focused AND the app is in the foreground. Tabs stay mounted when they
 * lose focus, so decorative loops (tickers, demo animations) use this to stop burning CPU/battery
 * off-screen or in the background, and resume when it flips back.
 */
export function useScreenActive(): boolean {
  const focused = useIsFocused();
  const [foreground, setForeground] = React.useState(() => AppState.currentState !== "background");

  React.useEffect(() => {
    const sub = AppState.addEventListener("change", state => setForeground(state === "active"));
    return () => sub.remove();
  }, []);

  return focused && foreground;
}
