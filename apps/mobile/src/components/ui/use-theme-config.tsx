import type { Theme } from "@react-navigation/native";

import { DarkTheme as _DarkTheme, DefaultTheme } from "@react-navigation/native";
import { useUniwind } from "uniwind";

// EastPark brand colors
const EastParkDarkTheme: Theme = {
  ..._DarkTheme,
  colors: {
    ..._DarkTheme.colors,
    primary: "#b8966a", // gold-500
    background: "#0d0c0b", // dark-bg
    text: "#faf8f5", // dark-text
    border: "#3d3830", // dark-border
    card: "#221f1c", // dark-card
    notification: "#b8966a", // gold-500
  },
};

const EastParkLightTheme: Theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: "#7a5e38", // gold-700 (passes WCAG AA on light)
    background: "#faf8f5", // light-bg
    text: "#1a1714", // light-text
    border: "#e4ceae", // light-border
    card: "#ffffff", // light-card
    notification: "#7a5e38",
  },
};

export function useThemeConfig() {
  const { theme } = useUniwind();

  if (theme === "dark")
    return EastParkDarkTheme;

  return EastParkLightTheme;
}
