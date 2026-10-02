import { router } from "expo-router";
import { CaretRight, ChartBar, EnvelopeSimple, Megaphone, Trophy } from "phosphor-react-native";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppColors } from "@/lib/hooks/use-app-colors";
import { BRAND, FONT, RADIUS, SPACING } from "@/theme/tokens";

function useStyles() {
  const colors = useAppColors();
  return React.useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    header: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      justifyContent: "space-between" as const,
      paddingHorizontal: SPACING.base,
      paddingVertical: SPACING.md,
      backgroundColor: colors.card,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerTitle: { fontFamily: FONT.sans, fontWeight: "700", fontSize: 20, color: colors.text },
    headerBadge: {
      fontFamily: FONT.sans,
      fontWeight: "700",
      fontSize: 11,
      color: BRAND.goldText,
      backgroundColor: BRAND.goldTint,
      paddingHorizontal: 10,
      paddingVertical: 3,
      borderRadius: RADIUS.full,
    },
    scroll: { padding: SPACING.base, gap: SPACING.sm },
    sectionLabel: {
      fontFamily: FONT.sans,
      fontWeight: "700",
      fontSize: 12,
      color: colors.textMuted,
      textTransform: "uppercase" as const,
      letterSpacing: 1,
      marginBottom: SPACING.xs,
    },
    actionRow: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      backgroundColor: colors.card,
      borderRadius: RADIUS.md,
      padding: SPACING.md,
      gap: SPACING.md,
    },
    actionIcon: { width: 28, alignItems: "center" as const, justifyContent: "center" as const },
    actionLabel: { flex: 1, fontFamily: FONT.sans, fontWeight: "500", fontSize: 15, color: colors.text },
  }), [colors]);
}

export default function AdminDashboard() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const colors = useAppColors();

  const QUICK_ACTIONS = [
    { labelKey: "admin.invitations", icon: <EnvelopeSimple size={20} color={BRAND.gold} />, route: "/(admin)/invitations" },
    { labelKey: "admin.new_announcement", icon: <Megaphone size={20} color={BRAND.gold} />, route: "/(admin)/announcements/new" },
    { labelKey: "admin.new_poll", icon: <ChartBar size={20} color={BRAND.gold} />, route: "/(admin)/polls/new" },
    { labelKey: "admin.new_election", icon: <Trophy size={20} color={BRAND.gold} />, route: "/(admin)/elections/new" },
  ];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t("admin.title")}</Text>
        <Text style={styles.headerBadge}>{t("auth.role_admin")}</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + SPACING.xl }]}
      >
        <Text style={styles.sectionLabel}>{t("admin.tools")}</Text>
        {QUICK_ACTIONS.map(action => (
          <Pressable
            key={action.route}
            style={styles.actionRow}
            onPress={() => router.push(action.route)}
          >
            <View style={styles.actionIcon}>{action.icon}</View>
            <Text style={styles.actionLabel}>{t(action.labelKey)}</Text>
            <CaretRight size={16} color={colors.textMuted} />
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}
