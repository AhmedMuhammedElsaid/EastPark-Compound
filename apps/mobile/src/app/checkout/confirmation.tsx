import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import { Check } from "phosphor-react-native";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { Animated, BackHandler, Linking, StyleSheet, Text, View } from "react-native";
import { showMessage } from "react-native-flash-message";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { GoldButton } from "@/components/auth/gold-button";
import { useAppColors } from "@/lib/hooks/use-app-colors";
import { useReducedMotion } from "@/lib/hooks/use-reduced-motion";
import { formatOrderNumber, getOrderHandoff, openWhatsAppChat } from "@/lib/whatsapp";
import { BRAND, DARK, FONT, RADIUS, SEMANTIC, SPACING } from "@/theme/tokens";

const BADGE_SIZE = 128;

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
    badge: {
      width: BADGE_SIZE,
      height: BADGE_SIZE,
      borderRadius: RADIUS.full,
      backgroundColor: SEMANTIC.success,
      justifyContent: "center" as const,
      alignItems: "center" as const,
    },
    halo: {
      position: "absolute" as const,
      width: BADGE_SIZE,
      height: BADGE_SIZE,
      borderRadius: RADIUS.full,
      borderWidth: 2,
      borderColor: SEMANTIC.success,
    },
    badgeWrap: { width: BADGE_SIZE * 1.6, height: BADGE_SIZE * 1.6, justifyContent: "center" as const, alignItems: "center" as const },
    orderNumber: {
      fontFamily: FONT.sans,
      fontWeight: "700",
      fontSize: 15,
      lineHeight: 22,
      color: "primaryText" in colors ? colors.primaryText : BRAND.gold,
      textAlign: "center" as const,
      backgroundColor: `${BRAND.gold}1f`,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.xs,
      borderRadius: RADIUS.full,
      overflow: "hidden" as const,
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

  const reduceMotion = useReducedMotion();
  const { badgeStyle, checkStyle, haloStyle, contentStyle } = useSuccessAnimation(reduceMotion);

  // Success haptic exactly once, independent of the reduced-motion value
  // (which may flip after mount and re-run the animation effect).
  React.useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, []);

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom + SPACING.xl, paddingTop: insets.top }]}>
      <View style={styles.body}>
        <View style={styles.badgeWrap} accessible={false}>
          <Animated.View style={[styles.halo, haloStyle]} />
          <Animated.View style={[styles.badge, badgeStyle]}>
            <Animated.View style={checkStyle}>
              <Check size={64} color={DARK.text} weight="bold" />
            </Animated.View>
          </Animated.View>
        </View>

        <Animated.View style={[styles.textWrap, contentStyle]}>
          <Text style={styles.title} accessibilityRole="header">{t("checkout.order_placed")}</Text>
          {orderId
            ? (
                // LRM keeps "#" attached to the start of the number in Arabic.
                <Text style={styles.orderNumber}>{t("checkout.order_number", { number: `‎${formatOrderNumber(orderId)}` })}</Text>
              )
            : null}
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

/**
 * Success moment (DESIGN.md motion): the olive badge springs in, the check
 * pops a beat later, a soft halo ripples out once and the copy fades up.
 * Reduced motion shows the final state at once.
 */
function useSuccessAnimation(reduceMotion: boolean) {
  const badge = React.useRef(new Animated.Value(0)).current;
  const check = React.useRef(new Animated.Value(0)).current;
  const halo = React.useRef(new Animated.Value(0)).current;
  const content = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (reduceMotion) {
      badge.setValue(1);
      check.setValue(1);
      halo.setValue(1);
      content.setValue(1);
      return;
    }
    const animation = Animated.parallel([
      Animated.spring(badge, { toValue: 1, damping: 11, stiffness: 140, useNativeDriver: true }),
      Animated.sequence([
        Animated.delay(180),
        Animated.spring(check, { toValue: 1, damping: 8, stiffness: 180, useNativeDriver: true }),
      ]),
      Animated.sequence([
        Animated.delay(240),
        Animated.timing(halo, { toValue: 1, duration: 700, useNativeDriver: true }),
      ]),
      Animated.sequence([
        Animated.delay(280),
        Animated.timing(content, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]),
    ]);
    animation.start();
    return () => animation.stop();
  }, [badge, check, halo, content, reduceMotion]);

  return {
    badgeStyle: { transform: [{ scale: badge }] },
    checkStyle: {
      opacity: check.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 1, 1] }),
      transform: [
        { scale: check.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) },
        { rotate: check.interpolate({ inputRange: [0, 1], outputRange: ["-25deg", "0deg"] }) },
      ],
    },
    // One ripple that grows and fades out; with reduced motion it stays hidden.
    haloStyle: {
      opacity: reduceMotion ? 0 : halo.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 0.5, 0] }),
      transform: [{ scale: halo.interpolate({ inputRange: [0, 1], outputRange: [1, 1.5] }) }],
    },
    contentStyle: {
      opacity: content,
      transform: [{ translateY: content.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
    },
  };
}
