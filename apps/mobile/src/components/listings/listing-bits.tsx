import type { ListingStatus, ListingType } from "@/services/api/listings";
import { Armchair, Bathtub, Bed, Ruler } from "phosphor-react-native";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";

import { formatCurrency } from "@/lib/format-currency";
import { formatNumber } from "@/lib/format-number";
import { useAppColors } from "@/lib/hooks/use-app-colors";
import { statusTone } from "@/lib/listings";
import { BRAND, FONT, RADIUS, SEMANTIC, SPACING } from "@/theme/tokens";

type AppColors = ReturnType<typeof useAppColors>;

/** "EGP 2,500,000" for a sale, "EGP 15,000 / month" for a rent. */
export function usePriceLabel() {
  const { t } = useTranslation();
  return React.useCallback(
    (type: ListingType, price: number) =>
      type === "RENT" ? t("listings.per_month", { price: formatCurrency(price) }) : formatCurrency(price),
    [t],
  );
}

export function toneColor(status: ListingStatus, colors: AppColors): string {
  switch (statusTone(status)) {
    case "success": return SEMANTIC.success;
    case "warning": return SEMANTIC.warning;
    case "error": return SEMANTIC.error;
    default: return colors.textMuted;
  }
}

/** Status pill: tinted fill, body-colour text (the tint alone carries no meaning). */
export function StatusPill({ status }: { status: ListingStatus }) {
  const { t } = useTranslation();
  const colors = useAppColors();
  const color = toneColor(status, colors);
  return (
    <View style={[pillStyles.pill, { backgroundColor: `${color}33`, borderColor: `${color}66` }]}>
      <View style={[pillStyles.dot, { backgroundColor: color }]} />
      <Text style={[pillStyles.text, { color: colors.text }]}>{t(`listings.status_${status}`)}</Text>
    </View>
  );
}

/** Sale / Rent tag shown on covers. */
export function TypeTag({ type }: { type: ListingType }) {
  const { t } = useTranslation();
  return (
    <View style={pillStyles.typeTag}>
      <Text style={pillStyles.typeText}>{t(`listings.type_${type}`)}</Text>
    </View>
  );
}

type SpecsProps = {
  areaSqm: number;
  bedrooms: number;
  bathrooms: number;
  furnished?: boolean;
  /** Show the furnished chip (detail screens). */
  showFurnished?: boolean;
};

/** Area · bedrooms · bathrooms (· furnished), locale digits, icons with spoken labels. */
export function ListingSpecs({ areaSqm, bedrooms, bathrooms, furnished, showFurnished }: SpecsProps) {
  const { t, i18n } = useTranslation();
  const colors = useAppColors();
  const n = (value: number) => formatNumber(value, i18n.language);
  const items = [
    { key: "area", icon: <Ruler size={16} color={colors.textMuted} />, text: t("listings.area_value", { area: n(areaSqm) }), label: t("listings.area") },
    { key: "bed", icon: <Bed size={16} color={colors.textMuted} />, text: n(bedrooms), label: t("listings.bedrooms") },
    { key: "bath", icon: <Bathtub size={16} color={colors.textMuted} />, text: n(bathrooms), label: t("listings.bathrooms") },
  ];
  if (showFurnished) {
    items.push({
      key: "furn",
      icon: <Armchair size={16} color={colors.textMuted} />,
      text: t(furnished ? "listings.furnished" : "listings.unfurnished"),
      label: t(furnished ? "listings.furnished" : "listings.unfurnished"),
    });
  }
  return (
    <View style={pillStyles.specs}>
      {items.map(item => (
        <View key={item.key} style={pillStyles.spec} accessible accessibilityLabel={`${item.label}: ${item.text}`}>
          {item.icon}
          <Text style={[pillStyles.specText, { color: colors.textMuted }]}>{item.text}</Text>
        </View>
      ))}
    </View>
  );
}

const pillStyles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
    borderWidth: 1,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  text: { fontFamily: FONT.sans, fontSize: 12, lineHeight: 18, fontWeight: "600" },
  typeTag: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
    backgroundColor: BRAND.gold,
  },
  typeText: { fontFamily: FONT.sans, fontSize: 12, lineHeight: 18, fontWeight: "700", color: BRAND.ink },
  specs: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: SPACING.md, rowGap: SPACING.xs },
  spec: { flexDirection: "row", alignItems: "center", gap: SPACING.xs },
  specText: { fontFamily: FONT.sans, fontSize: 13, lineHeight: 20 },
});
