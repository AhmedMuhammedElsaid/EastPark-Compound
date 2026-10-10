import * as React from "react";

import { useAppColors } from "@/lib/hooks/use-app-colors";
import { BRAND, DARK, LIGHT } from "@/theme/tokens";

/**
 * Colours of the teaser surfaces (mirrors the web `.home-hero` variables). Gold text is gold-400 on
 * dark and gold-700 on light (gold-500 fails AA on the light background).
 */
export function useTeaserPalette() {
  const colors = useAppColors();
  const isDark = colors.bg === DARK.bg;
  return React.useMemo(() => ({
    isDark,
    bg: colors.bg,
    card: colors.card,
    muted: colors.elevated,
    border: colors.border,
    text: colors.text,
    textMuted: colors.textMuted,
    /** Gold for text and icons: eyebrows, accents, links. */
    gold: isDark ? BRAND.goldLight : LIGHT.primaryText,
    /** Filled timeline nodes and connectors. */
    node: isDark ? BRAND.gold : LIGHT.primaryText,
    nodeForeground: isDark ? DARK.bg : LIGHT.bg,
    /** 14% text-colour track behind the timeline. */
    track: `${colors.text}24`,
  }), [colors, isDark]);
}

export type TeaserPalette = ReturnType<typeof useTeaserPalette>;
