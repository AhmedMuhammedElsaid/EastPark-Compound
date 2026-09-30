import AsyncStorage from "@react-native-async-storage/async-storage";
import * as React from "react";
import { Uniwind } from "uniwind";

import { useAppDispatch, useAppSelector } from "@/store";
import { setTheme as setThemeAction } from "@/store/slices/preferences-slice";

const SELECTED_THEME = "SELECTED_THEME";
export type ColorSchemeType = "light" | "dark" | "system";

export function useSelectedTheme() {
  // Read initial value from Redux (persisted) — avoids the 'system' flash on mount.
  const persistedTheme = useAppSelector(s => s.preferences.theme) as ColorSchemeType;
  const dispatch = useAppDispatch();

  const setSelectedTheme = React.useCallback((t: ColorSchemeType) => {
    Uniwind.setTheme(t);
    dispatch(setThemeAction(t as "dark" | "light" | "system"));
    AsyncStorage.setItem(SELECTED_THEME, t); // keep for loadSelectedTheme() on next boot
  }, [dispatch]);

  return { selectedTheme: persistedTheme, setSelectedTheme } as const;
}

// Called from RootLayout useEffect to restore Uniwind theme on mount before first paint.
// Reads from AsyncStorage directly because Redux hasn't rehydrated yet at that moment.
export async function loadSelectedTheme() {
  const theme = await AsyncStorage.getItem(SELECTED_THEME);
  if (theme) {
    Uniwind.setTheme(theme as ColorSchemeType);
  }
}
