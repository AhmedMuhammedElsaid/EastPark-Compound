import * as Haptics from "expo-haptics";
import * as React from "react";
import { Pressable, StyleSheet, Text } from "react-native";

import { BRAND, FONT, RADIUS, SPACING } from "@/theme/tokens";

import { useTeaserPalette } from "./use-teaser-palette";

type Props = {
  label: string;
  onPress: () => void;
  variant?: "filled" | "outline";
  fullWidth?: boolean;
};

/**
 * Landing call-to-action (web `ButtonLink`): sized to its label unless `fullWidth`. The outline
 * variant uses gold-700 on light so the label passes AA (GoldButton's outline is gold-500).
 */
export function LandingButton({ label, onPress, variant = "filled", fullWidth = false }: Props) {
  const palette = useTeaserPalette();
  const filled = variant === "filled";
  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.base,
        fullWidth && styles.fullWidth,
        filled
          ? { backgroundColor: pressed ? BRAND.goldDark : BRAND.gold }
          : { borderWidth: 1.5, borderColor: palette.node, backgroundColor: pressed ? palette.muted : "transparent" },
      ]}
    >
      <Text style={[styles.label, { color: filled ? BRAND.ink : palette.gold }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
  },
  fullWidth: { alignSelf: "stretch" },
  label: { fontFamily: FONT.sans, fontWeight: "700", fontSize: 15, lineHeight: 22 },
});
