import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";

import { authApi } from "@/services/api/auth";

// Last Expo push token successfully sent to the backend. Not a secret: the
// token is only an address; it cannot be used to authenticate.
const LAST_PUSH_TOKEN_KEY = "eastpark_last_push_token";

type RegisterOptions = {
  /** Ask for permission when not yet granted (login flows only). */
  requestPermission?: boolean;
  /** Send even if the token matches the last one sent (new session). */
  force?: boolean;
};

async function readLastToken(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(LAST_PUSH_TOKEN_KEY);
  }
  catch {
    return null;
  }
}

/**
 * Registers the Expo push token with the backend via PATCH /auth/push-token.
 * - After login/OTP/invitation: `registerPushToken()` (prompts + force-sends).
 * - On app foreground: `registerPushToken({ requestPermission: false, force: false })`
 *   re-sends only when the token changed and never shows a permission dialog.
 */
export async function registerPushToken({ requestPermission = true, force = true }: RegisterOptions = {}) {
  try {
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== "granted" && requestPermission) {
      const result = await Notifications.requestPermissionsAsync();
      status = result.status;
    }
    if (status !== "granted")
      return;

    const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
    const token = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    if (!force && (await readLastToken()) === token.data)
      return;

    await authApi.updatePushToken(token.data);
    await AsyncStorage.setItem(LAST_PUSH_TOKEN_KEY, token.data);
  }
  catch (err) {
    if (__DEV__)
      console.warn("[push] token registration failed", err);
  }
}

/**
 * The Expo push token last sent for the current session, if any. Sign-out
 * reads it BEFORE teardown forgets it, so logout can detach it server-side.
 */
export function getRegisteredPushToken(): Promise<string | null> {
  return readLastToken();
}

/** Forget the last-sent token so the next session always re-registers. */
export async function clearRegisteredPushToken() {
  try {
    await AsyncStorage.removeItem(LAST_PUSH_TOKEN_KEY);
  }
  catch {}
}
