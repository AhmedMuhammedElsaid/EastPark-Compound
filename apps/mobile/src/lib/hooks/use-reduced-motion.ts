import * as React from "react";
import { AccessibilityInfo } from "react-native";

/**
 * True when the OS "reduce motion" accessibility setting is on.
 * Reactive — updates when the user toggles the setting while the app is open.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = React.useState(false);

  React.useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => {
        if (mounted)
          setReduced(v);
      })
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduced);
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  return reduced;
}
