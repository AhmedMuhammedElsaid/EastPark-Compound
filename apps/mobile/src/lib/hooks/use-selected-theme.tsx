import AsyncStorage from "@react-native-async-storage/async-storage";
import * as React from "react";
import { Uniwind } from "uniwind";

import { store, useAppDispatch, useAppSelector } from "@/store";
import { setTheme as setThemeAction } from "@/store/slices/preferences-slice";

// Legacy key (pre-MOB-31). Theme now lives only in the redux-persist `preferences` slice.
const LEGACY_SELECTED_THEME = "SELECTED_THEME";
const PERSISTED_PREFERENCES = "persist:preferences";
export type ColorSchemeType = "light" | "dark" | "system";

export function useSelectedTheme() {
  // Read initial value from Redux (persisted) — avoids the 'system' flash on mount.
  const persistedTheme = useAppSelector(s => s.preferences.theme) as ColorSchemeType;
  const dispatch = useAppDispatch();

  const setSelectedTheme = React.useCallback((t: ColorSchemeType) => {
    Uniwind.setTheme(t);
    dispatch(setThemeAction(t as "dark" | "light" | "system"));
  }, [dispatch]);

  return { selectedTheme: persistedTheme, setSelectedTheme } as const;
}

// Called from RootLayout useEffect to restore the Uniwind theme before first paint.
// Redux has not rehydrated yet at that moment, so peek at the redux-persist blob directly.
// One-time migration: a value left in the legacy AsyncStorage key is moved into redux, then removed.
export async function loadSelectedTheme() {
  let theme: string | undefined;
  try {
    const raw = await AsyncStorage.getItem(PERSISTED_PREFERENCES);
    // redux-persist stores each field JSON-encoded inside the outer JSON object
    if (raw)
      theme = JSON.parse(JSON.parse(raw).theme ?? "null") ?? undefined;
  }
  catch {}

  try {
    const legacy = await AsyncStorage.getItem(LEGACY_SELECTED_THEME);
    if (legacy) {
      if (!theme) {
        theme = legacy;
        store.dispatch(setThemeAction(legacy as "dark" | "light" | "system"));
      }
      await AsyncStorage.removeItem(LEGACY_SELECTED_THEME);
    }
  }
  catch {}

  if (theme) {
    Uniwind.setTheme(theme as ColorSchemeType);
  }
}
