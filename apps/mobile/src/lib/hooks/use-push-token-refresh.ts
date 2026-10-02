import * as React from "react";
import { AppState } from "react-native";

import { registerPushToken } from "@/services/push";

/**
 * Re-registers the Expo push token whenever the app returns to the
 * foreground while signed in. Only sends when the token changed since the
 * last successful registration, and never prompts for permission.
 */
export function usePushTokenRefresh(isAuthenticated: boolean): void {
  React.useEffect(() => {
    if (!isAuthenticated)
      return;
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active")
        registerPushToken({ requestPermission: false, force: false });
    });
    return () => subscription.remove();
  }, [isAuthenticated]);
}
