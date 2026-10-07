import { router } from "expo-router";
import { CaretRight, ChartBar, EnvelopeSimple, Megaphone, Trophy } from "phosphor-react-native";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { I18nManager, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScreenHeader } from "@/components/ui/screen-header";
import { useAppColors } from "@/lib/hooks/use-app-colors";
import { BRAND, FONT, RADIUS, SPACING } from "@/theme/tokens";

function useStyles() {
  const colors = useAppColors();
  return React.useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    scroll: { padding: SPACING.base, gap: SPACING.sm },
    sectionLabel: {
      fontFamily: FONT.sans,
      fontWeight: "700",
      fontSize: 13,
      lineHeight: 20,
      color: colors.textMuted,
      marginBottom: SPACING.xs,
    },
    actionRow: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      minHeight: 64,
      backgroundColor: colors.card,
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: SPACING.md,
      gap: SPACING.md,
    },
    pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
    actionIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: `${BRAND.gold}1f`, alignItems: "center" as const, justifyContent: "center" as const },
    actionLabel: { flex: 1, fontFamily: FONT.sans, fontWeight: "600", fontSize: 15, lineHeight: 24, color: colors.text },
  }), [colors]);
}

export default function AdminDashboard() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const colors = useAppColors();

  const gold = "primaryText" in colors ? colors.primaryText : BRAND.gold;
  const QUICK_ACTIONS = [
    { labelKey: "admin.invitations", icon: <EnvelopeSimple size={20} color={gold} />, route: "/(admin)/invitations" },
    { labelKey: "admin.new_announcement", icon: <Megaphone size={20} color={gold} />, route: "/(admin)/announcements/new" },
    { labelKey: "admin.new_poll", icon: <ChartBar size={20} color={gold} />, route: "/(admin)/polls/new" },
    { labelKey: "admin.new_election", icon: <Trophy size={20} color={gold} />, route: "/(admin)/elections/new" },
  ];

  return (
    <View style={styles.container}>
      <ScreenHeader title={t("admin.title")} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + SPACING.xl }]}
      >
        <Text style={styles.sectionLabel}>{t("admin.tools")}</Text>
        {QUICK_ACTIONS.map(action => (
          <Pressable
            key={action.route}
            style={({ pressed }) => [styles.actionRow, pressed && styles.pressed]}
            onPress={() => router.push(action.route)}
            accessibilityRole="button"
            accessibilityLabel={t(action.labelKey)}
          >
            <View style={styles.actionIcon}>{action.icon}</View>
            <Text style={styles.actionLabel}>{t(action.labelKey)}</Text>
            <CaretRight mirrored={I18nManager.isRTL} size={16} color={colors.textMuted} />
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}
