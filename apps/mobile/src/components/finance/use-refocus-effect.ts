import { useFocusEffect } from "expo-router";
import * as React from "react";

/**
 * Runs `onRefocus` every time the screen is shown again, e.g. back from
 * "Record payment" (which leaves this screen mounted underneath). The first
 * focus is skipped: the money queries already fetch on mount.
 */
export function useRefocusEffect(onRefocus: () => void) {
  const firstFocusRef = React.useRef(true);
  const callbackRef = React.useRef(onRefocus);
  React.useEffect(() => {
    callbackRef.current = onRefocus;
  });
  useFocusEffect(React.useCallback(() => {
    if (firstFocusRef.current) {
      firstFocusRef.current = false;
      return;
    }
    callbackRef.current();
  }, []));
}
