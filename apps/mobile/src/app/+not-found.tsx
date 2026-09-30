import { Link, Stack } from "expo-router";
import { MagnifyingGlass } from "phosphor-react-native";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";

import { useAppColors } from "@/lib/hooks/use-app-colors";
import { BRAND, FONT, SPACING } from "@/theme/tokens";

/**
 * Global 404 fallback for unmatched routes.
 * Replaces the obytes boilerplate `[...messing].tsx` screen.
 */
export default function NotFoundScreen() {
  const { t } = useTranslation();
  const colors = useAppColors();
  const styles = useStyles(colors);

  return (
    <>
      <Stack.Screen options={{ title: t("common.not_found_title") }} />
      <View style={styles.container}>
        <MagnifyingGlass size={48} color={colors.textMuted} />
        <Text style={styles.title}>{t("common.not_found_title")}</Text>
        <Text style={styles.subtitle}>{t("common.not_found_subtitle")}</Text>
        <Link href="/(tabs)" style={styles.link}>
          <Text style={styles.linkText}>{t("common.go_home")}</Text>
        </Link>
      </View>
    </>
  );
}

function useStyles(colors: ReturnType<typeof useAppColors>) {
  return React.useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: SPACING.xl,
          gap: SPACING.md,
          backgroundColor: colors.bg,
        },
        title: {
          fontFamily: FONT.sans,
          fontWeight: "700",
          fontSize: 20,
          color: colors.text,
          textAlign: "center",
        },
        subtitle: {
          fontFamily: FONT.sans,
          fontSize: 14,
          color: colors.textMuted,
          textAlign: "center",
          lineHeight: 20,
        },
        link: {
          marginTop: SPACING.md,
        },
        linkText: {
          fontFamily: FONT.sans,
          fontWeight: "600",
          fontSize: 15,
          color: BRAND.gold,
        },
      }),
    [colors],
  );
}
