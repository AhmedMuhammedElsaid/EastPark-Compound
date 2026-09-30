import Constants from "expo-constants";
import * as Notifications from "expo-notifications";

import { authApi } from "@/services/api/auth";

/**
 * Requests push notification permission (if not yet granted) then registers
 * the Expo push token with the backend via PATCH /auth/push-token.
 * Called after every successful login or OTP verification.
 */
export async function registerPushToken() {
  try {
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== "granted") {
      const result = await Notifications.requestPermissionsAsync();
      status = result.status;
    }
    if (status === "granted") {
      const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
      const token = await Notifications.getExpoPushTokenAsync(
        projectId ? { projectId } : undefined,
      );
      await authApi.updatePushToken(token.data);
    }
  }
  catch (err) {
    if (__DEV__)
      console.warn("[push] token registration failed", err);
  }
}
