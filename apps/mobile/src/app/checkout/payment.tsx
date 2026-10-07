import type { Order, PaymentMethod } from "@/services/api/orders";
import type { CartItem } from "@/store/slices/cart-slice";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { CreditCard, Money } from "phosphor-react-native";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { Alert, Linking, Pressable, StyleSheet, Text, View } from "react-native";

import { showMessage } from "react-native-flash-message";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GoldButton } from "@/components/auth/gold-button";
import { ScreenHeader } from "@/components/ui/screen-header";
import { getErrorCode, isNoResponseError } from "@/lib/api-error";
import { CARD_PAYMENTS_ENABLED, WHATSAPP_ORDER_HANDOFF } from "@/lib/features";
import { formatCurrency } from "@/lib/format-currency";
import { useAppColors } from "@/lib/hooks/use-app-colors";
import { resolveDeliveryUnit } from "@/lib/units";
import { buildOrderMessage, buildWhatsAppUrl, setOrderHandoff, toWhatsAppDigits } from "@/lib/whatsapp";
import { buildPlaceOrderPayload, getOrderItemTotal, ordersApi } from "@/services/api/orders";
import { shopsApi } from "@/services/api/shops";
import { useAppDispatch, useAppSelector } from "@/store";
import { clearCart } from "@/store/slices/cart-slice";
import { BRAND, FONT, RADIUS, SEMANTIC, SPACING } from "@/theme/tokens";

function useStyles() {
  const colors = useAppColors();
  return React.useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    content: { flex: 1, padding: SPACING.base, gap: SPACING.md },
    sectionLabel: { fontFamily: FONT.sans, fontWeight: "700", fontSize: 16, color: colors.text },
    option: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      backgroundColor: colors.card,
      borderRadius: RADIUS.lg,
      padding: SPACING.base,
      minHeight: 56,
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
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: SPACING.base,
      marginTop: SPACING.md,
    },
    summaryLabel: { fontFamily: FONT.sans, fontWeight: "600", fontSize: 15, color: colors.text },
    summaryValue: { fontFamily: FONT.sans, fontWeight: "700", fontSize: 18, color: BRAND.gold },
    unitMissing: { fontFamily: FONT.sans, fontSize: 13, color: SEMANTIC.error, textAlign: "center" as const },
    footer: { padding: SPACING.base, backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.border },
  }), [colors]);
}

// eslint-disable-next-line max-lines-per-function
export default function PaymentScreen() {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === "ar";
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();
  const { notes, deliveryUnit: chosenUnit } = useLocalSearchParams<{ notes?: string; deliveryUnit?: string }>();
  const items = useAppSelector(s => s.cart.items);
  const cartShopId = useAppSelector(s => s.cart.shopId);
  const cartShopName = useAppSelector(s => s.cart.shopName);
  const cartShopNameAr = useAppSelector(s => s.cart.shopNameAr);
  // Backend OrderCreateDto requires deliveryUnit: the flat picked on the
  // address step, else the primary flat (legacy accounts: unitNumber).
  const authUser = useAppSelector(s => s.auth.user);
  const deliveryUnit = resolveDeliveryUnit(authUser, chosenUnit).trim();
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

  /** Builds the shop WhatsApp link + stores the hand-off for the confirmation screen. Never throws. */
  async function prepareWhatsAppHandoff(placed: Order): Promise<string | null> {
    try {
      const shop = cartShopId
        ? (await queryClient.fetchQuery({
            queryKey: ["shop", cartShopId],
            queryFn: () => shopsApi.getShop(cartShopId),
            staleTime: 5 * 60_000,
          })).data.data
        : null;
      const digits = toWhatsAppDigits(shop?.whatsapp);
      const shopName = (isAr ? (shop?.nameAr ?? cartShopNameAr ?? cartShopName) : (shop?.name ?? cartShopName)) ?? "";
      const lines = placed.items?.length
        ? placed.items.map(i => ({ quantity: i.quantity, name: isAr ? i.productNameArSnapshot : i.productNameSnapshot, lineTotal: formatCurrency(getOrderItemTotal(i)) }))
        : items.map((i: CartItem) => ({ quantity: i.quantity, name: isAr ? i.nameAr : i.name, lineTotal: formatCurrency(i.price * i.quantity) }));
      const message = buildOrderMessage({
        isAr,
        orderId: placed.id,
        shopName,
        items: lines,
        total: formatCurrency(Number(placed.totalAmount ?? total)),
        paymentLabel: paymentMethod === "PAYMOB" ? t("checkout.card") : t("checkout.cash"),
        customerName: authUser?.name,
        phone: authUser?.phone,
        deliveryLabel: t("checkout.unit", { number: deliveryUnit }),
        notes,
      });
      setOrderHandoff({ orderId: placed.id, whatsappDigits: digits, shopPhone: shop?.phone ?? null, message });
      return digits ? buildWhatsAppUrl(digits, message) : null;
    }
    catch {
      return null;
    }
  }

  const { mutate, isPending } = useMutation({
    mutationFn: () =>
      ordersApi.placeOrder(buildPlaceOrderPayload({
        items: items.map((item: CartItem) => ({ productId: item.productId, quantity: item.quantity })),
        paymentMethod,
        deliveryUnit,
        notes,
      })),
    onSuccess: async (res) => {
      const placed = res.data.data;
      const orderId = placed.id;
      // The order exists server-side from here on: the cart must never be
      // left intact, otherwise a retap would create a duplicate order.
      dispatch(clearCart());
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      const whatsappUrl = WHATSAPP_ORDER_HANDOFF ? await prepareWhatsAppHandoff(placed) : null;
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
      if (whatsappUrl) {
        Linking.openURL(whatsappUrl).catch(() => {
          showMessage({ message: t("checkout.whatsapp_failed"), type: "warning" });
        });
      }
    },
    onError: async (error) => {
      if (!isNoResponseError(error)) {
        inFlight.current = false;
        const invalidUnit = getErrorCode(error) === "order.error.deliveryUnitInvalid";
        showMessage({ message: t(invalidUnit ? "checkout.unit_invalid" : "checkout.order_failed"), type: "danger", backgroundColor: SEMANTIC.error });
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
    <View style={styles.container}>
      <ScreenHeader title={t("checkout.payment")} />

      <View style={styles.content}>
        <Text style={styles.sectionLabel}>{t("checkout.payment")}</Text>

        <PaymentOption
          label={t("checkout.cash")}
          icon={<Money size={24} color={colors.textMuted} />}
          selected={paymentMethod === "CASH"}
          onPress={() => setPaymentMethod("CASH")}
          styles={styles}
        />
        {CARD_PAYMENTS_ENABLED
          ? (
              <PaymentOption
                label={t("checkout.card")}
                icon={<CreditCard size={24} color={colors.textMuted} />}
                selected={paymentMethod === "PAYMOB"}
                onPress={() => setPaymentMethod("PAYMOB")}
                styles={styles}
              />
            )
          : null}

        <View style={styles.summary}>
          <Text style={styles.summaryLabel}>{t("cart.total")}</Text>
          <Text style={styles.summaryValue}>{formatCurrency(total)}</Text>
        </View>

        {!deliveryUnit
          ? <Text style={styles.unitMissing}>{t("checkout.unit_missing")}</Text>
          : null}
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + SPACING.md }]}>
        <GoldButton
          label={t("checkout.place_order")}
          loading={busy}
          disabled={!canPlaceOrder}
          onPress={() => {
            if (busy || inFlight.current)
              return;
            inFlight.current = true;
            mutate();
          }}
        />
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
