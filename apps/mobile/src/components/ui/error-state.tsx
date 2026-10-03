import { router } from "expo-router";
import { ArrowLeft, WarningCircle } from "phosphor-react-native";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { I18nManager, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAppColors } from "@/lib/hooks/use-app-colors";
import { FONT, RADIUS, SEMANTIC, SPACING } from "@/theme/tokens";
import { Text } from "./text";

type ErrorStateProps = {
  onRetry?: () => void;
  message?: string;
};

export function ErrorState({ onRetry, message }: ErrorStateProps) {
  const { t } = useTranslation();
  const colors = useAppColors();
  const styles = useStyles(colors);

  return (
    <View style={styles.container}>
      <WarningCircle size={48} color={SEMANTIC.error} />
      <Text style={styles.message}>
        {message ?? t("common.error")}
      </Text>
      {onRetry && (
        <Pressable
          style={styles.retryButton}
          onPress={onRetry}
          accessibilityRole="button"
          accessibilityLabel={t("common.retry")}
        >
          <Text style={styles.retryText}>{t("common.retry")}</Text>
        </Pressable>
      )}
    </View>
  );
}

/**
 * Full-screen error for detail screens whose query failed before any data
 * arrived (404, offline after retries). Keeps a back button because the
 * screen's own header is not rendered without data.
 */
export function DetailErrorScreen({ onRetry, message }: ErrorStateProps) {
  const { t } = useTranslation();
  const colors = useAppColors();
  const styles = useStyles(colors);
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.screen, { paddingTop: insets.top + SPACING.sm, paddingBottom: insets.bottom }]}>
      <Pressable
        style={styles.backButton}
        // Screens reached via router.replace (merchant dashboard) have no history.
        onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={t("common.back")}
      >
        <ArrowLeft mirrored={I18nManager.isRTL} size={18} color={colors.text} />
      </Pressable>
      <ErrorState onRetry={onRetry} message={message} />
    </View>
  );
}

function useStyles(colors: ReturnType<typeof useAppColors>) {
  return React.useMemo(
    () =>
      StyleSheet.create({
        screen: {
          flex: 1,
          backgroundColor: colors.bg,
        },
        backButton: {
          width: 44,
          height: 44,
          marginHorizontal: SPACING.base,
          borderRadius: RADIUS.full,
          backgroundColor: colors.elevated,
          justifyContent: "center",
          alignItems: "center",
        },
        container: {
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: SPACING.xl,
          gap: SPACING.md,
        },
        message: {
          fontFamily: FONT.sans,
          fontSize: 15,
          color: colors.textMuted,
          textAlign: "center",
        },
        retryButton: {
          marginTop: SPACING.sm,
          paddingHorizontal: SPACING.xl,
          paddingVertical: SPACING.md,
          borderRadius: RADIUS.full,
          borderWidth: 1,
          borderColor: colors.border,
        },
        retryText: {
          fontFamily: FONT.sans,
          fontSize: 14,
          color: colors.text,
        },
      }),
    [colors],
  );
}
