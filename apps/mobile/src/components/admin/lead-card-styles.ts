import type { useAppColors } from "@/lib/hooks/use-app-colors";
import type { LeadStatus } from "@/services/api/admin";
import { I18nManager, StyleSheet } from "react-native";

import { BRAND, FONT, RADIUS, SEMANTIC, SPACING } from "@/theme/tokens";

export type LeadCardColors = ReturnType<typeof useAppColors>;

export const LEAD_STATUS_COLOR: Record<LeadStatus, string> = {
  PENDING: SEMANTIC.warning,
  INVITED: SEMANTIC.info,
  CONVERTED: SEMANTIC.success,
  REJECTED: SEMANTIC.error,
};

export function buildLeadCardStyles(colors: LeadCardColors) {
  const gold = "primaryText" in colors ? colors.primaryText : BRAND.gold;
  return StyleSheet.create({
    card: {
      backgroundColor: colors.card,
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: SPACING.base,
      marginBottom: SPACING.md,
      gap: SPACING.xs,
    },
    top: { flexDirection: "row", alignItems: "flex-start", gap: SPACING.sm },
    main: { flex: 1, gap: 2 },
    name: { fontFamily: FONT.sans, fontWeight: "700", fontSize: 15, lineHeight: 24, color: colors.text },
    meta: { fontFamily: FONT.sans, fontSize: 13, lineHeight: 20, color: colors.textMuted, writingDirection: "ltr", textAlign: I18nManager.isRTL ? "right" : "left" },
    side: { alignItems: "flex-end", gap: 4 },
    unit: { fontFamily: FONT.sans, fontWeight: "700", fontSize: 14, lineHeight: 22, color: gold, writingDirection: "ltr" },
    pill: { paddingHorizontal: SPACING.sm, paddingVertical: 2, borderRadius: RADIUS.full },
    pillText: { fontFamily: FONT.sans, fontWeight: "600", fontSize: 11, lineHeight: 18, color: colors.text },
    date: { fontFamily: FONT.sans, fontSize: 12, lineHeight: 18, color: colors.textMuted },
    actions: { flexDirection: "row", gap: SPACING.sm, marginTop: SPACING.sm },
    primary: {
      flex: 1,
      minHeight: 48,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: SPACING.xs,
      borderRadius: RADIUS.md,
      borderWidth: 1,
      borderColor: `${BRAND.gold}8c`,
      backgroundColor: `${BRAND.gold}1a`,
    },
    primaryText: { fontFamily: FONT.sans, fontWeight: "700", fontSize: 14, lineHeight: 22, color: gold },
    reject: {
      minHeight: 48,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: SPACING.xs,
      paddingHorizontal: SPACING.base,
      borderRadius: RADIUS.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    rejectText: { fontFamily: FONT.sans, fontWeight: "600", fontSize: 14, lineHeight: 22, color: colors.text },
    busy: { opacity: 0.6 },
    pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  });
}

export type LeadCardStyles = ReturnType<typeof buildLeadCardStyles>;
