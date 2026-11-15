import * as Haptics from "expo-haptics";
import * as React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useAppColors } from "@/lib/hooks/use-app-colors";
import { BRAND, FONT, RADIUS, SEMANTIC, SPACING } from "@/theme/tokens";

export type ChipOption = { value: string; label: string };

type Props = {
  label: string;
  options: ChipOption[];
  value: string;
  onChange: (value: string) => void;
  error?: string;
  /** Shown instead of the chips while there is nothing to choose from yet. */
  emptyHint?: string;
};

/** Single-choice chips (building, floor, flat, marital status): no native picker needed. */
export function ChipGroup({ label, options, value, onChange, error, emptyHint }: Props) {
  const colors = useAppColors();
  const styles = React.useMemo(() => StyleSheet.create({
    wrap: { marginBottom: SPACING.md, gap: SPACING.xs },
    label: { fontFamily: FONT.sans, fontWeight: "500", fontSize: 14, lineHeight: 22, color: colors.textMuted },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm },
    chip: {
      minHeight: 44,
      minWidth: 56,
      paddingHorizontal: SPACING.base,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: RADIUS.full,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
    },
    chipActive: { backgroundColor: BRAND.gold, borderColor: BRAND.gold },
    chipError: { borderColor: SEMANTIC.error },
    chipText: { fontFamily: FONT.sans, fontWeight: "600", fontSize: 14, lineHeight: 22, color: colors.textMuted },
    chipTextActive: { color: BRAND.ink, fontWeight: "700" },
    hint: { fontFamily: FONT.sans, fontSize: 13, lineHeight: 20, color: colors.textMuted },
    error: { fontFamily: FONT.sans, fontSize: 12, lineHeight: 18, color: SEMANTIC.error },
    pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  }), [colors]);

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      {options.length === 0 && emptyHint
        ? <Text style={styles.hint}>{emptyHint}</Text>
        : (
            <View style={styles.chips} accessibilityRole="radiogroup">
              {options.map((o) => {
                const active = o.value === value;
                return (
                  <Pressable
                    key={o.value}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      onChange(o.value);
                    }}
                    style={({ pressed }) => [styles.chip, active && styles.chipActive, !!error && !active && styles.chipError, pressed && styles.pressed]}
                    accessibilityRole="radio"
                    accessibilityLabel={o.label}
                    accessibilityState={{ checked: active }}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{o.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          )}
      {error ? <Text style={styles.error} accessibilityLiveRegion="polite">{error}</Text> : null}
    </View>
  );
}
