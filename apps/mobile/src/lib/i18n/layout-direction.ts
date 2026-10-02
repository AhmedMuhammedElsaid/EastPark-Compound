import AsyncStorage from "@react-native-async-storage/async-storage";
import { I18nManager, Platform } from "react-native";

import { reloadApp } from "./utils";

// Direction ("rtl" | "ltr") we already reloaded once to apply. Prevents a
// reload loop where forceRTL() does not stick (e.g. Expo Go).
export const RTL_RELOAD_FLAG_KEY = "eastpark_rtl_reload_target";

/**
 * Native layout direction only changes after a reload. On first launch the
 * persisted/default language is Arabic but the native layout is still LTR,
 * so apply forceRTL and reload exactly once. Returns true when a reload was
 * triggered.
 */
export async function ensureLayoutDirection(language: "ar" | "en"): Promise<boolean> {
  if (Platform.OS === "web")
    return false;

  const wantRTL = language === "ar";
  const target = wantRTL ? "rtl" : "ltr";

  try {
    if (I18nManager.isRTL === wantRTL) {
      await AsyncStorage.removeItem(RTL_RELOAD_FLAG_KEY);
      return false;
    }

    I18nManager.allowRTL(wantRTL);
    I18nManager.forceRTL(wantRTL);

    if ((await AsyncStorage.getItem(RTL_RELOAD_FLAG_KEY)) === target)
      return false; // Already reloaded once for this direction — never loop.

    await AsyncStorage.setItem(RTL_RELOAD_FLAG_KEY, target);
    reloadApp();
    return true;
  }
  catch {
    return false;
  }
}
