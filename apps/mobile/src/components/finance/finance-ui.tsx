import type { FinanceFlatListItem } from "@/services/api/finance";
import * as Haptics from "expo-haptics";
import { CaretRight } from "phosphor-react-native";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { I18nManager, Pressable, StyleSheet, Text, View } from "react-native";

import { Skeleton } from "@/components/ui/skeleton";
import { balanceLabel } from "@/lib/finance";
import { formatNumber } from "@/lib/format-number";
import { useAppColors } from "@/lib/hooks/use-app-colors";
import { DARK, FONT, RADIUS, SEMANTIC, SPACING } from "@/theme/tokens";

function useStyles() {
  const colors = useAppColors();
  return React.useMemo(() => ({
    colors,
    styles: StyleSheet.create({
      row: {
        flexDirection: "row",
        alignItems: "center",
        minHeight: 72,
        gap: SPACING.md,
        padding: SPACING.md,
        marginBottom: SPACING.sm,
        borderRadius: RADIUS.md,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.card,
      },
      pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
      main: { flex: 1, gap: 2 },
      label: { fontFamily: FONT.sans, fontWeight: "700", fontSize: 16, lineHeight: 24, color: colors.text, textAlign: "left" },
      owner: { fontFamily: FONT.sans, fontSize: 13, lineHeight: 20, color: colors.textMuted, textAlign: "left" },
      end: { alignItems: "flex-end", gap: SPACING.xs },
      amount: { fontFamily: FONT.sans, fontWeight: "600", fontSize: 14, lineHeight: 22, color: colors.text },
      credit: { color: colors.textMuted },
      badge: { paddingHorizontal: SPACING.sm, paddingVertical: 2, borderRadius: RADIUS.full, backgroundColor: SEMANTIC.error },
      badgeText: { fontFamily: FONT.sans, fontWeight: "600", fontSize: 12, lineHeight: 18, color: DARK.text },
      tile: {
        flex: 1,
        minWidth: 140,
        gap: SPACING.xs,
        padding: SPACING.base,
        borderRadius: RADIUS.md,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.card,
      },
      tileLabel: { fontFamily: FONT.sans, fontWeight: "500", fontSize: 13, lineHeight: 20, color: colors.textMuted, textAlign: "left" },
      tileValue: { fontFamily: FONT.sans, fontWeight: "700", fontSize: 20, lineHeight: 30, color: colors.text, textAlign: "left" },
      tileHint: { fontFamily: FONT.sans, fontSize: 12, lineHeight: 18, color: colors.textMuted, textAlign: "left" },
    }),
  }), [colors]);
}

/** "Overdue 23 days" badge (solid error fill keeps AA contrast on both themes). */
export function OverdueBadge({ days }: { days: number }) {
  const { t, i18n } = useTranslation();
  const { styles } = useStyles();
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>{t("finance.overdue_days", { days: formatNumber(days, i18n.language) })}</Text>
    </View>
  );
}

export function FinanceFlatRow({ flat, onPress, selected }: { flat: FinanceFlatListItem; onPress: () => void; selected?: boolean }) {
  const { t } = useTranslation();
  const { styles, colors } = useStyles();
  const balance = balanceLabel(t, flat.balance);
  const owner = flat.ownerName ?? t("finance.no_owner");
  return (
    <Pressable
      style={({ pressed }) => [styles.row, selected && { borderColor: colors.primary }, pressed && styles.pressed]}
      onPress={() => {
        Haptics.selectionAsync();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityState={selected === undefined ? undefined : { selected }}
      accessibilityLabel={`${flat.label}, ${owner}, ${balance}`}
    >
      <View style={styles.main}>
        <Text style={styles.label}>{flat.label}</Text>
        <Text style={styles.owner} numberOfLines={1}>{owner}</Text>
      </View>
      <View style={styles.end}>
        <Text style={[styles.amount, flat.balance <= 0 && styles.credit]}>{balance}</Text>
        {flat.oldestDueDays && flat.overdueAmount > 0 ? <OverdueBadge days={flat.oldestDueDays} /> : null}
      </View>
      <CaretRight mirrored={I18nManager.isRTL} size={16} color={colors.textMuted} />
    </Pressable>
  );
}

export function FinanceFlatRowSkeleton() {
  const { styles } = useStyles();
  return (
    <View style={styles.row} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={styles.main}>
        <Skeleton width={90} height={18} />
        <Skeleton width={140} height={14} />
      </View>
      <Skeleton width={80} height={16} />
    </View>
  );
}

export function StatTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  const { styles } = useStyles();
  return (
    <View style={styles.tile} accessible accessibilityLabel={hint ? `${label}: ${value}. ${hint}` : `${label}: ${value}`}>
      <Text style={styles.tileLabel}>{label}</Text>
      <Text style={styles.tileValue} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      {hint ? <Text style={styles.tileHint}>{hint}</Text> : null}
    </View>
  );
}

export function StatTileSkeleton() {
  const { styles } = useStyles();
  return (
    <View style={styles.tile}>
      <Skeleton width={90} height={14} />
      <Skeleton width={120} height={24} />
    </View>
  );
}
