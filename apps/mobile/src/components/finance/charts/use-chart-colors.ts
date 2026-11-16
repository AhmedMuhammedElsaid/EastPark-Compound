import { useAppColors } from "@/lib/hooks/use-app-colors";
import { CHART_DARK, CHART_LIGHT, DARK } from "@/theme/tokens";

/** Theme chart palette plus the surface tokens the charts draw with (mockup `--elev`, `--line`, `--tx`, `--mut`). */
export function useChartColors() {
  const colors = useAppColors();
  const palette = colors === DARK ? CHART_DARK : CHART_LIGHT;
  return { ...palette, elev: colors.elevated, line: colors.border, tx: colors.text, mut: colors.textMuted, bg: colors.bg, card: colors.card, gold: colors.primary };
}

export type ChartColors = ReturnType<typeof useChartColors>;
