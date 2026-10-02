import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import LottieView from "lottie-react-native";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAppColors } from "@/lib/hooks/use-app-colors";
import { useReducedMotion } from "@/lib/hooks/use-reduced-motion";
import { BRAND, FONT, RADIUS, SPACING } from "@/theme/tokens";

function useStyles() {
  const colors = useAppColors();
  return React.useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bg,
      justifyContent: "space-between" as const,
      paddingHorizontal: SPACING.xl,
    },
    body: {
      flex: 1,
      justifyContent: "center" as const,
      alignItems: "center" as const,
      gap: SPACING.xl,
    },
    iconWrap: {
      justifyContent: "center" as const,
      alignItems: "center" as const,
    },
    textWrap: { alignItems: "center" as const, gap: SPACING.sm },
    title: { fontFamily: FONT.sans, fontWeight: "700", fontSize: 26, color: colors.text, textAlign: "center" as const },
    subtitle: { fontFamily: FONT.sans, fontSize: 15, color: colors.textMuted, textAlign: "center" as const, lineHeight: 24 },
    actions: { gap: SPACING.md },
    viewOrderBtn: {
      height: 52,
      borderRadius: RADIUS.md,
      backgroundColor: BRAND.gold,
      justifyContent: "center" as const,
      alignItems: "center" as const,
    },
    viewOrderBtnText: { fontFamily: FONT.sans, fontWeight: "700", fontSize: 16, color: colors.bg },
    continueBtn: {
      height: 48,
      borderRadius: RADIUS.md,
      borderWidth: 1,
      borderColor: colors.border,
      justifyContent: "center" as const,
      alignItems: "center" as const,
    },
    continueBtnText: { fontFamily: FONT.sans, fontWeight: "600", fontSize: 15, color: colors.textMuted },
  }), [colors]);
}

export default function ConfirmationScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const styles = useStyles();

  // Entry animations
  const scale = React.useRef(new Animated.Value(0)).current;
  const opacity = React.useRef(new Animated.Value(0)).current;

  const reduceMotion = useReducedMotion();

  React.useEffect(() => {
    if (reduceMotion) {
      scale.setValue(1);
      opacity.setValue(1);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return;
    }
    Animated.spring(scale, { toValue: 1, damping: 12, stiffness: 120, useNativeDriver: true }).start();
    Animated.sequence([
      Animated.delay(200),
      Animated.timing(opacity, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [opacity, scale, reduceMotion]);

  const iconStyle = { transform: [{ scale }] };
  const contentStyle = { opacity };

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom + SPACING.xl, paddingTop: insets.top }]}>
      <View style={styles.body}>
        <Animated.View style={[styles.iconWrap, iconStyle]}>
          <LottieView
            source={require("../../../assets/animations/success.json")}
            autoPlay
            loop={false}
            style={{ width: 200, height: 200 }}
          />
        </Animated.View>

        <Animated.View style={[styles.textWrap, contentStyle]}>
          <Text style={styles.title}>{t("checkout.order_placed")}</Text>
          <Text style={styles.subtitle}>{t("checkout.order_placed_subtitle")}</Text>
        </Animated.View>
      </View>

      <Animated.View style={[styles.actions, contentStyle]}>
        <Pressable
          style={styles.viewOrderBtn}
          onPress={() => {
            if (orderId)
              router.replace(`/(tabs)/orders/${orderId}`);
          }}
          accessibilityRole="button"
          accessibilityLabel={t("home.my_orders")}
        >
          <Text style={styles.viewOrderBtnText}>{t("home.my_orders")}</Text>
        </Pressable>

        <Pressable
          style={styles.continueBtn}
          onPress={() => router.replace("/(tabs)/directory")}
          accessibilityRole="button"
          accessibilityLabel={t("directory.title")}
        >
          <Text style={styles.continueBtnText}>{t("directory.title")}</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}
