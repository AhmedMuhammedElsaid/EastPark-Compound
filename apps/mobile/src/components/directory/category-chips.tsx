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
 * Active: filled gold pill. Inactive: outlined pill.
 * Sticky below search bar on scroll (parent handles positioning).
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
              style={[styles.chip, active ? styles.chipActive : styles.chipInactive]}
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
          paddingVertical: SPACING.sm,
        },
        scroll: {
          paddingHorizontal: SPACING.base,
          gap: SPACING.sm,
          flexDirection: "row",
          alignItems: "center",
        },
        chip: {
          height: 36,
          paddingHorizontal: SPACING.md,
          borderRadius: RADIUS.full,
          justifyContent: "center",
          alignItems: "center",
        },
        chipActive: {
          backgroundColor: BRAND.gold,
        },
        chipInactive: {
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: "transparent",
        },
        label: {
          fontFamily: FONT.sans,
          fontWeight: "500",
          fontSize: 13,
        },
        labelActive: { color: colors.bg },
        labelInactive: { color: colors.textMuted },
      }),
    [colors],
  );
}
