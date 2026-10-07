import type { ShopCategory } from "@/services/api/shops";
import * as React from "react";
import { useTranslation } from "react-i18next";

import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useAppColors } from "@/lib/hooks/use-app-colors";
import { BRAND, FONT, RADIUS, SPACING } from "@/theme/tokens";

type Category = ShopCategory | "ALL";

type Props = {
  selected: Category;
  onSelect: (c: Category) => void;
};

const CATEGORIES: { key: Category; labelKey: string }[] = [
  { key: "ALL", labelKey: "directory.all_categories" },
  { key: "CAFE_AND_FOOD", labelKey: "directory.cafe_food" },
  { key: "GROCERY", labelKey: "directory.grocery" },
  { key: "BUTCHER", labelKey: "directory.butcher" },
  { key: "SERVICES", labelKey: "directory.services" },
  { key: "OTHER", labelKey: "directory.other" },
];

/**
 * Horizontal scroll category chip bar.
 * Active: filled gold pill. Inactive: outlined card pill. 44px touch targets.
 */
export function CategoryChips({ selected, onSelect }: Props) {
  const { t } = useTranslation();
  const colors = useAppColors();
  const styles = useStyles(colors);

  return (
    <View style={styles.wrapper}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {CATEGORIES.map(({ key, labelKey }) => {
          const active = selected === key;
          return (
            <Pressable
              key={key}
              onPress={() => onSelect(key)}
              style={({ pressed }) => [styles.chip, active ? styles.chipActive : styles.chipInactive, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.label, active ? styles.labelActive : styles.labelInactive]}>
                {t(labelKey)}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

function useStyles(colors: ReturnType<typeof useAppColors>) {
  return React.useMemo(
    () =>
      StyleSheet.create({
        wrapper: {
          backgroundColor: colors.bg,
          paddingTop: SPACING.xs,
          paddingBottom: SPACING.sm,
        },
        scroll: {
          paddingHorizontal: SPACING.base,
          gap: SPACING.sm,
          flexDirection: "row",
          alignItems: "center",
        },
        chip: {
          minHeight: 44,
          paddingHorizontal: SPACING.base,
          borderRadius: RADIUS.full,
          justifyContent: "center",
          alignItems: "center",
        },
        chipActive: {
          backgroundColor: BRAND.gold,
          borderWidth: 1,
          borderColor: BRAND.gold,
        },
        chipInactive: {
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.card,
        },
        pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
        label: {
          fontFamily: FONT.sans,
          fontWeight: "600",
          fontSize: 13,
          lineHeight: 20,
          includeFontPadding: false,
        },
        // Ink on gold passes AA in both themes; colors.bg (off-white) on gold does not.
        labelActive: { color: BRAND.ink },
        labelInactive: { color: colors.textMuted },
      }),
    [colors],
  );
}
