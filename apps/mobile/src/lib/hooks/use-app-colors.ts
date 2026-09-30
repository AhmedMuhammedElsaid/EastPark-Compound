import { useUniwind } from "uniwind";

import { DARK, LIGHT } from "@/theme/tokens";

/**
 * Returns the correct color token set for the current theme.
 * Reactive — re-renders when Uniwind theme changes via setSelectedTheme().
 *
 * Usage:
 *   const colors = useAppColors();
 *   <View style={{ backgroundColor: colors.bg }} />
 */
export function useAppColors(): typeof DARK | typeof LIGHT {
  const { theme } = useUniwind();
  return theme === "dark" ? DARK : LIGHT;
}
