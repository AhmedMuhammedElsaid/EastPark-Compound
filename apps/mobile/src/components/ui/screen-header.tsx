import type { ReactNode } from "react";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { ArrowLeft } from "phosphor-react-native";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { I18nManager, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAppColors } from "@/lib/hooks/use-app-colors";
import { FONT, RADIUS, SPACING } from "@/theme/tokens";

type Props = {
  title: string;
  /** Show the back button (default true). Tab roots pass false. */
  back?: boolean;
  onBack?: () => void;
  /** Trailing action(s), e.g. an icon button. */
  right?: ReactNode;
  /** Pad for the status bar (default true). Pass false when the parent already does. */
  safeTop?: boolean;
};

/**
 * Stack screen header — same anatomy as the web header: page background,
 * hairline bottom border, 44px back target, title at the start.
 */
export function ScreenHeader({ title, back = true, onBack, right, safeTop = true }: Props) {
  const { t } = useTranslation();
  const colors = useAppColors();
  const insets = useSafeAreaInsets();
  const styles = React.useMemo(() => buildStyles(colors), [colors]);

  return (
    <View style={[styles.bar, safeTop && { paddingTop: insets.top }]}>
      <View style={styles.row}>
        {back && (
          <Pressable
            style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              if (onBack)
                onBack();
              else if (router.canGoBack())
                router.back();
              else router.replace("/(tabs)");
            }}
            accessibilityRole="button"
            accessibilityLabel={t("common.back")}
            hitSlop={4}
          >
            <ArrowLeft mirrored={I18nManager.isRTL} size={22} color={colors.text} />
          </Pressable>
        )}
        <Text style={[styles.title, !back && styles.titleRoot]} numberOfLines={1} accessibilityRole="header">
          {title}
        </Text>
        {right ? <View style={styles.right}>{right}</View> : null}
      </View>
    </View>
  );
}

function buildStyles(colors: ReturnType<typeof useAppColors>) {
  return StyleSheet.create({
    bar: {
      backgroundColor: colors.bg,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    row: {
      minHeight: 60,
      flexDirection: "row",
      alignItems: "center",
      gap: SPACING.xs,
      paddingHorizontal: SPACING.sm,
    },
    iconBtn: {
      width: 44,
      height: 44,
      borderRadius: RADIUS.md,
      alignItems: "center",
      justifyContent: "center",
    },
    pressed: { backgroundColor: colors.elevated },
    title: { flex: 1, fontFamily: FONT.sans, fontWeight: "700", fontSize: 18, lineHeight: 28, color: colors.text },
    titleRoot: { fontSize: 22, lineHeight: 34, paddingHorizontal: SPACING.sm },
    right: { flexDirection: "row", alignItems: "center", gap: SPACING.xs },
  });
}
