import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import LottieView from "lottie-react-native";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { Animated, BackHandler, Linking, StyleSheet, Text, View } from "react-native";
import { showMessage } from "react-native-flash-message";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { GoldButton } from "@/components/auth/gold-button";
import { useAppColors } from "@/lib/hooks/use-app-colors";
import { useReducedMotion } from "@/lib/hooks/use-reduced-motion";
import { getOrderHandoff, openWhatsAppChat } from "@/lib/whatsapp";
import { FONT, SPACING } from "@/theme/tokens";

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
    actions: { gap: SPACING.xs },
  }), [colors]);
}

export default function ConfirmationScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const styles = useStyles();
  const handoff = getOrderHandoff(orderId);

  // Order is placed: Back always leaves checkout for home, never a stale step.
  React.useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      router.dismissTo("/(tabs)");
      return true;
    });
    return () => sub.remove();
  }, []);

  // Entry animations
  const scale = React.useRef(new Animated.Value(0)).current;
  const opacity = React.useRef(new Animated.Value(0)).current;

  const reduceMotion = useReducedMotion();

  // Success haptic exactly once, independent of the reduced-motion value
  // (which may flip after mount and re-run the animation effect).
  React.useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, []);

  React.useEffect(() => {
    if (reduceMotion) {
      scale.setValue(1);
      opacity.setValue(1);
      return;
    }
    Animated.spring(scale, { toValue: 1, damping: 12, stiffness: 120, useNativeDriver: true }).start();
    Animated.sequence([
      Animated.delay(200),
      Animated.timing(opacity, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();
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
        <GoldButton
          label={t("home.my_orders")}
          onPress={() => router.dismissTo("/(tabs)/orders")}
        />
        {handoff?.whatsappDigits
          ? (
              <GoldButton
                label={t("orders.send_whatsapp")}
                variant="outline"
                onPress={() => {
                  openWhatsAppChat(handoff.whatsappDigits as string, handoff.message, url => Linking.openURL(url)).catch(() => {
                    showMessage({ message: t("checkout.whatsapp_failed"), type: "warning" });
                  });
                }}
              />
            )
          : handoff?.shopPhone
            ? (
                <GoldButton
                  label={t("orders.call_shop")}
                  variant="outline"
                  onPress={() => {
                    Linking.openURL(`tel:${handoff.shopPhone}`).catch(() => {});
                  }}
                />
              )
            : null}
        <GoldButton label={t("orders.browse_shops")} variant="ghost" onPress={() => router.dismissTo("/(tabs)/directory")} />
      </Animated.View>
    </View>
  );
}
