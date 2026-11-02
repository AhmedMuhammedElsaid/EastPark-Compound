import { router } from "expo-router";
import { Coins } from "phosphor-react-native";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { ScreenHeader } from "@/components/ui/screen-header";
import { useAppColors } from "@/lib/hooks/use-app-colors";
import { BRAND, FONT, RADIUS, SPACING } from "@/theme/tokens";

function useStyles() {
  const colors = useAppColors();
  return React.useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    body: { flex: 1, alignItems: "center" as const, justifyContent: "center" as const, padding: SPACING.xl, gap: SPACING.md },
    icon: { width: 64, height: 64, borderRadius: 32, backgroundColor: `${BRAND.gold}1f`, alignItems: "center" as const, justifyContent: "center" as const },
    title: { fontFamily: FONT.sans, fontWeight: "700", fontSize: 20, lineHeight: 30, color: colors.text, textAlign: "center" as const },
    text: { fontFamily: FONT.sans, fontSize: 15, lineHeight: 24, color: colors.textMuted, textAlign: "center" as const },
    button: { minHeight: 48, justifyContent: "center" as const, paddingHorizontal: SPACING.xl, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, marginTop: SPACING.md },
    buttonText: { fontFamily: FONT.sans, fontWeight: "600", fontSize: 15, color: colors.text },
  }), [colors]);
}

/** Placeholder landing for the ACCOUNTANT role until the finance screens ship. */
export default function FinanceToday() {
  const { t } = useTranslation();
  const styles = useStyles();
  const colors = useAppColors();
  const gold = "primaryText" in colors ? colors.primaryText : BRAND.gold;
  return (
    <View style={styles.container}>
      <ScreenHeader title={t("finance.title")} back={false} />
      <View style={styles.body}>
        <View style={styles.icon}>
          <Coins size={32} color={gold} />
        </View>
        <Text style={styles.title}>{t("finance.today")}</Text>
        <Text style={styles.text}>{t("finance.placeholder_body")}</Text>
        <Pressable
          style={styles.button}
          onPress={() => router.push("/(tabs)/profile")}
          accessibilityRole="button"
          accessibilityLabel={t("profile.tab_label")}
        >
          <Text style={styles.buttonText}>{t("profile.tab_label")}</Text>
        </Pressable>
      </View>
    </View>
  );
}
