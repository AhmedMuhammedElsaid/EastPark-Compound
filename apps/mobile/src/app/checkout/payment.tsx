import type { PaymentMethod } from "@/services/api/orders";
import type { CartItem } from "@/store/slices/cart-slice";
import { useMutation } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import { ArrowLeft, CreditCard, Money } from "phosphor-react-native";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";

import { showMessage } from "react-native-flash-message";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { formatCurrency } from "@/lib/format-currency";
import { useAppColors } from "@/lib/hooks/use-app-colors";
import { ordersApi } from "@/services/api/orders";
import { useAppDispatch, useAppSelector } from "@/store";
import { clearCart } from "@/store/slices/cart-slice";
import { BRAND, FONT, RADIUS, SPACING } from "@/theme/tokens";

function useStyles() {
  const colors = useAppColors();
  return React.useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    nav: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      paddingHorizontal: SPACING.base,
      paddingVertical: SPACING.md,
      backgroundColor: colors.card,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      gap: SPACING.sm,
    },
    backBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.elevated,
      justifyContent: "center" as const,
      alignItems: "center" as const,
    },
    navTitle: { fontFamily: FONT.sans, fontWeight: "700", fontSize: 18, color: colors.text },
    content: { padding: SPACING.base, gap: SPACING.md },
    sectionLabel: { fontFamily: FONT.sans, fontWeight: "700", fontSize: 16, color: colors.text },
    option: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      backgroundColor: colors.card,
      borderRadius: RADIUS.md,
      padding: SPACING.md,
      gap: SPACING.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    optionSelected: { borderColor: BRAND.gold },
    optionIcon: { width: 24, height: 24, justifyContent: "center" as const, alignItems: "center" as const },
    optionLabel: { flex: 1, fontFamily: FONT.sans, fontWeight: "500", fontSize: 15, color: colors.textMuted },
    optionLabelSelected: { color: colors.text },
    radio: {
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 2,
      borderColor: colors.border,
      justifyContent: "center" as const,
      alignItems: "center" as const,
    },
    radioSelected: { borderColor: BRAND.gold },
    radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: BRAND.gold },
    summary: {
      flexDirection: "row" as const,
      justifyContent: "space-between" as const,
      alignItems: "center" as const,
      backgroundColor: colors.card,
      borderRadius: RADIUS.md,
      padding: SPACING.md,
      marginTop: SPACING.md,
    },
    summaryLabel: { fontFamily: FONT.sans, fontWeight: "600", fontSize: 15, color: colors.text },
    summaryValue: { fontFamily: FONT.sans, fontWeight: "700", fontSize: 18, color: BRAND.gold },
    placeBtn: {
      height: 52,
      borderRadius: RADIUS.md,
      backgroundColor: BRAND.gold,
      justifyContent: "center" as const,
      alignItems: "center" as const,
      marginTop: SPACING.sm,
    },
    placeBtnDisabled: { opacity: 0.5 },
    placeBtnText: { fontFamily: FONT.sans, fontWeight: "700", fontSize: 16, color: colors.bg },
  }), [colors]);
}

export default function PaymentScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();
  const { notes } = useLocalSearchParams<{ notes?: string }>();
  const { items, shopId } = useAppSelector(s => s.cart);
  const [paymentMethod, setPaymentMethod] = React.useState<PaymentMethod>("CASH");
  const styles = useStyles();
  const colors = useAppColors();

  const total = items.reduce((sum: number, item: CartItem) => sum + item.price * item.quantity, 0);

  const { mutate, isPending } = useMutation({
    mutationFn: () =>
      ordersApi.placeOrder({
        shopId: shopId!,
        items: items.map((item: CartItem) => ({ productId: item.productId, quantity: item.quantity })),
        paymentMethod,
        notes: notes || undefined,
      }),
    onSuccess: async (res) => {
      const orderId = res.data.data.id;
      if (paymentMethod === "PAYMOB") {
        try {
          const payRes = await ordersApi.initiatePaymobPayment(orderId);
          await Linking.openURL(payRes.data.data.iframeUrl);
        }
        catch {
          showMessage({ message: t("common.error"), type: "danger" });
          return; // stop here — don't clear cart or navigate on Paymob failure
        }
      }
      dispatch(clearCart());
      router.replace({ pathname: "/checkout/confirmation" as any, params: { orderId } });
    },
  });

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.nav}>
        <Pressable style={styles.backBtn} onPress={() => router.back()} hitSlop={8} accessibilityRole="button" accessibilityLabel={t("common.back")}>
          <ArrowLeft size={18} color={colors.text} />
        </Pressable>
        <Text style={styles.navTitle}>{t("checkout.payment")}</Text>
      </View>

      <View style={styles.content}>
        <Text style={styles.sectionLabel}>{t("checkout.payment")}</Text>

        <PaymentOption
          label={t("checkout.cash")}
          icon={<Money size={24} color={colors.textMuted} />}
          selected={paymentMethod === "CASH"}
          onPress={() => setPaymentMethod("CASH")}
          styles={styles}
        />
        <PaymentOption
          label={t("checkout.card")}
          icon={<CreditCard size={24} color={colors.textMuted} />}
          selected={paymentMethod === "PAYMOB"}
          onPress={() => setPaymentMethod("PAYMOB")}
          styles={styles}
        />

        <View style={styles.summary}>
          <Text style={styles.summaryLabel}>{t("cart.total")}</Text>
          <Text style={styles.summaryValue}>{formatCurrency(total)}</Text>
        </View>

        <Pressable
          style={[styles.placeBtn, isPending && styles.placeBtnDisabled]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            mutate();
          }}
          disabled={isPending}
          accessibilityRole="button"
          accessibilityLabel={t("checkout.place_order")}
        >
          <Text style={styles.placeBtnText}>
            {isPending ? t("common.loading") : t("checkout.place_order")}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function PaymentOption({
  label,
  icon,
  selected,
  onPress,
  styles,
}: {
  label: string;
  icon: React.ReactNode;
  selected: boolean;
  onPress: () => void;
  styles: any;
}) {
  return (
    <Pressable
      style={[styles.option, selected && styles.optionSelected]}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ checked: selected }}
    >
      <View style={styles.optionIcon}>{icon}</View>
      <Text style={[styles.optionLabel, selected && styles.optionLabelSelected]}>{label}</Text>
      <View style={[styles.radio, selected && styles.radioSelected]}>
        {selected && <View style={styles.radioInner} />}
      </View>
    </Pressable>
  );
}
