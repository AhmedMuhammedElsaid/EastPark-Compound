import type { PaymentMethod } from "@/services/api/orders";
import type { CartItem } from "@/store/slices/cart-slice";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import { ArrowLeft, CreditCard, Money } from "phosphor-react-native";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { Alert, I18nManager, Linking, Pressable, StyleSheet, Text, View } from "react-native";

import { showMessage } from "react-native-flash-message";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { isNoResponseError } from "@/lib/api-error";
import { formatCurrency } from "@/lib/format-currency";
import { useAppColors } from "@/lib/hooks/use-app-colors";
import { buildPlaceOrderPayload, ordersApi } from "@/services/api/orders";
import { useAppDispatch, useAppSelector } from "@/store";
import { clearCart } from "@/store/slices/cart-slice";
import { BRAND, FONT, RADIUS, SEMANTIC, SPACING } from "@/theme/tokens";

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
    unitMissing: { fontFamily: FONT.sans, fontSize: 13, color: SEMANTIC.error, textAlign: "center" as const },
    placeBtnText: { fontFamily: FONT.sans, fontWeight: "700", fontSize: 16, color: colors.bg },
  }), [colors]);
}

export default function PaymentScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();
  const { notes } = useLocalSearchParams<{ notes?: string }>();
  const items = useAppSelector(s => s.cart.items);
  // Backend OrderCreateDto requires deliveryUnit (pre-filled from the profile).
  const deliveryUnit = useAppSelector(s => s.auth.user?.unitNumber ?? "").trim();
  const canPlaceOrder = items.length > 0 && deliveryUnit.length > 0;
  const [paymentMethod, setPaymentMethod] = React.useState<PaymentMethod>("CASH");
  const styles = useStyles();
  const colors = useAppColors();

  const total = items.reduce((sum: number, item: CartItem) => sum + item.price * item.quantity, 0);

  const queryClient = useQueryClient();
  // Blocks re-taps while the create is in flight AND while we verify, after a
  // timeout, that the server did not already commit the order.
  const [verifying, setVerifying] = React.useState(false);
  // Synchronous guard: state updates are async, so a fast double-tap could fire twice.
  const inFlight = React.useRef(false);

  const { mutate, isPending } = useMutation({
    mutationFn: () =>
      ordersApi.placeOrder(buildPlaceOrderPayload({
        items: items.map((item: CartItem) => ({ productId: item.productId, quantity: item.quantity })),
        paymentMethod,
        deliveryUnit,
        notes,
      })),
    onSuccess: async (res) => {
      const orderId = res.data.data.id;
      // The order exists server-side from here on: the cart must never be
      // left intact, otherwise a retap would create a duplicate order.
      dispatch(clearCart());
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      if (paymentMethod === "PAYMOB") {
        try {
          const payRes = await ordersApi.initiatePaymobPayment(orderId);
          await Linking.openURL(payRes.data.data.iframeUrl);
        }
        catch {
          showMessage({ message: t("checkout.payment_init_failed"), type: "danger" });
          // Order detail offers "pay now" for unpaid card orders.
          router.replace(`/(tabs)/orders/${orderId}`);
          return;
        }
      }
      router.replace({ pathname: "/checkout/confirmation", params: { orderId } });
    },
    onError: async (error) => {
      if (!isNoResponseError(error)) {
        inFlight.current = false;
        showMessage({ message: t("checkout.order_failed"), type: "danger", backgroundColor: SEMANTIC.error });
        return;
      }
      // Timeout / connection loss: the server may have committed the order.
      // Refresh the orders list before allowing another attempt.
      setVerifying(true);
      try {
        await queryClient.refetchQueries({ queryKey: ["orders"] });
      }
      catch {
        // Offline — still tell the user to verify before retrying.
      }
      setVerifying(false);
      inFlight.current = false;
      Alert.alert(
        t("checkout.order_uncertain_title"),
        t("checkout.order_uncertain_body"),
        [
          { text: t("checkout.order_uncertain_view"), onPress: () => router.replace("/(tabs)/orders") },
          { text: t("common.cancel"), style: "cancel" },
        ],
      );
    },
  });

  const busy = isPending || verifying;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.nav}>
        <Pressable style={styles.backBtn} onPress={() => router.back()} hitSlop={8} accessibilityRole="button" accessibilityLabel={t("common.back")}>
          <ArrowLeft mirrored={I18nManager.isRTL} size={18} color={colors.text} />
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

        {!deliveryUnit
          ? <Text style={styles.unitMissing}>{t("checkout.unit_missing")}</Text>
          : null}

        <Pressable
          style={[styles.placeBtn, (busy || !canPlaceOrder) && styles.placeBtnDisabled]}
          onPress={() => {
            if (busy || inFlight.current)
              return;
            inFlight.current = true;
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            mutate();
          }}
          disabled={busy || !canPlaceOrder}
          accessibilityRole="button"
          accessibilityLabel={t("checkout.place_order")}
        >
          <Text style={styles.placeBtnText}>
            {busy ? t("common.loading") : t("checkout.place_order")}
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
