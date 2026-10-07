import type { Order, OrderStatus } from "@/services/api/orders";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { Check, MapPin, NoteBlank, XCircle } from "phosphor-react-native";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { Alert, Linking, ScrollView, StyleSheet, Text, View } from "react-native";

import { showMessage } from "react-native-flash-message";
import { GoldButton } from "@/components/auth/gold-button";
import { DetailErrorScreen } from "@/components/ui/error-state";
import { ScreenHeader } from "@/components/ui/screen-header";
import { Skeleton } from "@/components/ui/skeleton";
import { CANCEL_ORDER_ERROR_KEYS, pickErrorKey } from "@/lib/api-error";
import { formatCurrency } from "@/lib/format-currency";
import { useAppColors } from "@/lib/hooks/use-app-colors";
import { getOrderStatusAccent } from "@/lib/order-status-style";
import { formatOrderNumber } from "@/lib/whatsapp";
import { getOrderItemTotal, getOrderPollInterval, ordersApi } from "@/services/api/orders";
import { getOrdersSocket, joinOrderRoom, leaveOrderRoom, ORDER_STATUS_UPDATE_EVENT } from "@/services/socket/client";
import { BRAND, FONT, RADIUS, SEMANTIC, SPACING } from "@/theme/tokens";

const STATUS_STEPS: OrderStatus[] = ["PLACED", "CONFIRMED", "PREPARING", "READY", "ON_THE_WAY", "DELIVERED"];

function buildStyles(colors: ReturnType<typeof useAppColors>) {
  const goldText = "primaryText" in colors ? colors.primaryText : BRAND.gold;
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    scroll: { padding: SPACING.base, gap: SPACING.md },
    statusHead: { flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "space-between" as const, gap: SPACING.sm },
    pill: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 5,
      borderRadius: RADIUS.full,
    },
    pillDot: { width: 8, height: 8, borderRadius: 4 },
    pillText: { fontFamily: FONT.sans, fontWeight: "600", fontSize: 13, lineHeight: 20, color: colors.text },
    dateText: { fontFamily: FONT.sans, fontSize: 12, lineHeight: 18, color: colors.textMuted },
    card: {
      backgroundColor: colors.card,
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: SPACING.base,
      gap: SPACING.md,
    },
    cardTitle: { fontFamily: FONT.sans, fontWeight: "700", fontSize: 15, lineHeight: 24, color: colors.text },
    stepRow: { flexDirection: "row" as const, alignItems: "stretch" as const, gap: SPACING.md, minHeight: 40 },
    stepRail: { width: 24, alignItems: "center" as const },
    stepDot: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: colors.elevated,
      borderWidth: 2,
      borderColor: colors.border,
      alignItems: "center" as const,
      justifyContent: "center" as const,
    },
    stepDotDone: { backgroundColor: BRAND.gold, borderColor: BRAND.gold },
    stepDotActive: { borderColor: BRAND.gold, borderWidth: 3 },
    stepLine: { flex: 1, width: 2, backgroundColor: colors.border, marginVertical: 2 },
    stepLineDone: { backgroundColor: BRAND.gold },
    stepLabel: { flex: 1, fontFamily: FONT.sans, fontSize: 14, lineHeight: 24, color: colors.textMuted, paddingBottom: SPACING.md },
    stepLabelDone: { color: colors.text },
    stepLabelActive: { fontWeight: "700", color: goldText },
    cancelledCard: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: SPACING.md,
      backgroundColor: `${SEMANTIC.error}1f`,
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      borderColor: `${SEMANTIC.error}55`,
      padding: SPACING.base,
    },
    cancelledText: { flex: 1, fontFamily: FONT.sans, fontWeight: "600", fontSize: 14, lineHeight: 22, color: colors.text },
    itemRow: { flexDirection: "row" as const, alignItems: "center" as const, gap: SPACING.sm },
    itemQty: { fontFamily: FONT.sans, fontWeight: "700", fontSize: 14, lineHeight: 22, color: goldText, minWidth: 32 },
    itemName: { fontFamily: FONT.sans, fontSize: 14, lineHeight: 22, color: colors.text, flex: 1 },
    itemPrice: { fontFamily: FONT.sans, fontWeight: "600", fontSize: 14, lineHeight: 22, color: colors.text },
    infoRow: { flexDirection: "row" as const, alignItems: "flex-start" as const, gap: SPACING.sm },
    infoText: { flex: 1, fontFamily: FONT.sans, fontSize: 14, lineHeight: 22, color: colors.text },
    summaryRow: { flexDirection: "row" as const, justifyContent: "space-between" as const, alignItems: "center" as const },
    summaryLabel: { fontFamily: FONT.sans, fontSize: 14, lineHeight: 22, color: colors.textMuted },
    summaryValue: { fontFamily: FONT.sans, fontWeight: "600", fontSize: 14, lineHeight: 22, color: colors.text },
    totalRow: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: SPACING.md },
    totalLabel: { fontFamily: FONT.sans, fontWeight: "700", fontSize: 16, lineHeight: 24, color: colors.text },
    totalValue: { fontFamily: FONT.sans, fontWeight: "700", fontSize: 18, lineHeight: 28, color: goldText },
  });
}

function useStyles() {
  const colors = useAppColors();
  return React.useMemo(() => ({ styles: buildStyles(colors), colors }), [colors]);
}

type Styles = ReturnType<typeof buildStyles>;

function subscribeSocketConnection(onChange: () => void) {
  const socket = getOrdersSocket();
  socket.on("connect", onChange);
  socket.on("disconnect", onChange);
  return () => {
    socket.off("connect", onChange);
    socket.off("disconnect", onChange);
  };
}

function useOrderSocketSync(orderId: string) {
  const queryClient = useQueryClient();

  // Socket.io real-time status (contract: order:join / order:status_update)
  React.useEffect(() => {
    if (!orderId)
      return;
    const socket = getOrdersSocket();

    const handler = (update: { orderId: string; status: OrderStatus }) => {
      if (update?.orderId === orderId) {
        queryClient.invalidateQueries({ queryKey: ["order", orderId] });
        queryClient.invalidateQueries({ queryKey: ["orders"] });
      }
    };

    const onConnect = () => {
      // Updates sent while disconnected were missed: catch up once.
      queryClient.invalidateQueries({ queryKey: ["order", orderId] });
    };
    socket.on(ORDER_STATUS_UPDATE_EVENT, handler);
    socket.on("connect", onConnect);
    joinOrderRoom(orderId);

    return () => {
      leaveOrderRoom(orderId);
      socket.off(ORDER_STATUS_UPDATE_EVENT, handler);
      socket.off("connect", onConnect);
    };
  }, [orderId, queryClient]);
}

function formatOrderDate(createdAt: string, isAr: boolean) {
  return new Date(createdAt).toLocaleString(isAr ? "ar-EG" : "en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function OrderDetailScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const { styles } = useStyles();
  const isAr = i18n.language === "ar";

  const socketConnected = React.useSyncExternalStore(subscribeSocketConnection, () => getOrdersSocket().connected, () => false);

  const { data, isError, isLoading, refetch } = useQuery({
    queryKey: ["order", orderId],
    queryFn: () => ordersApi.getOrder(orderId),
    enabled: !!orderId,
    // Fallback only: poll while the socket is down and the order is still active.
    refetchInterval: query => getOrderPollInterval(query.state.data?.data.data.status, socketConnected),
  });

  const order = data?.data.data;

  useOrderSocketSync(orderId);

  const { mutate: cancelOrder, isPending: cancelling } = useMutation({
    mutationFn: () => ordersApi.cancelOrder(orderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["order", orderId] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
    onError: (error) => {
      showMessage({ message: t(pickErrorKey(error, CANCEL_ORDER_ERROR_KEYS, "common.error")), type: "danger" });
      // The order may have moved on (confirmed/paid) since this screen loaded.
      queryClient.invalidateQueries({ queryKey: ["order", orderId] });
    },
  });

  const { mutate: payNow, isPending: paying } = useMutation({
    mutationFn: async () => {
      const res = await ordersApi.initiatePaymobPayment(orderId);
      await Linking.openURL(res.data.data.iframeUrl);
    },
    onError: () => {
      showMessage({ message: t("checkout.payment_init_failed"), type: "danger" });
    },
  });

  function handleCancel() {
    Alert.alert(
      t("orders.cancel_order"),
      t("orders.cancel_confirm"),
      [
        { text: t("common.cancel"), style: "cancel" },
        { text: t("orders.cancel_order"), style: "destructive", onPress: () => cancelOrder() },
      ],
    );
  }

  if (isError && !order)
    return <DetailErrorScreen onRetry={() => refetch()} />;
  if (isLoading || !order)
    return <OrderDetailSkeleton />;

  const shopName = (isAr ? order.shop?.nameAr : order.shop?.name) ?? t("orders.unknown_shop");
  const accent = getOrderStatusAccent(order.status);
  const date = formatOrderDate(order.createdAt, isAr);
  const deliveryUnit = order.deliveryUnit?.trim();
  const notes = order.notes?.trim();

  return (
    <View style={styles.container}>
      <ScreenHeader title={shopName} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: SPACING.xl }]}
      >
        <View style={styles.statusHead}>
          <View style={[styles.pill, { backgroundColor: `${accent}2e` }]}>
            <View style={[styles.pillDot, { backgroundColor: accent }]} />
            <Text style={styles.pillText}>{t(`orders.${order.status}`)}</Text>
          </View>
          <Text style={styles.dateText}>{`${formatOrderNumber(order.id)} · ${date}`}</Text>
        </View>

        {order.status === "CANCELLED"
          ? (
              <View style={styles.cancelledCard}>
                <XCircle size={28} color={SEMANTIC.error} weight="fill" />
                <Text style={styles.cancelledText}>{t("orders.CANCELLED")}</Text>
              </View>
            )
          : <StatusTimeline currentStatus={order.status} styles={styles} />}

        <OrderItems order={order} isAr={isAr} styles={styles} />

        <DeliveryInfo deliveryUnit={deliveryUnit} notes={notes} styles={styles} />

        <OrderSummary order={order} styles={styles} />

        {order.paymentMethod === "PAYMOB" && !order.isPaid && order.status !== "CANCELLED" && (
          <GoldButton label={t("orders.pay_now")} onPress={() => payNow()} loading={paying} />
        )}
        {order.status === "PLACED" && !order.isPaid && (
          <GoldButton label={t("orders.cancel_order")} variant="outline" onPress={handleCancel} disabled={cancelling} />
        )}
      </ScrollView>
    </View>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function DeliveryInfo({ deliveryUnit, notes, styles }: { deliveryUnit?: string; notes?: string; styles: Styles }) {
  const { t } = useTranslation();
  if (!deliveryUnit && !notes)
    return null;
  return (
    <View style={styles.card}>
      {deliveryUnit
        ? (
            <View style={styles.infoRow}>
              <MapPin size={20} color={BRAND.gold} />
              <Text style={styles.infoText}>{t("checkout.unit", { number: deliveryUnit })}</Text>
            </View>
          )
        : null}
      {notes
        ? (
            <View style={styles.infoRow}>
              <NoteBlank size={20} color={BRAND.gold} />
              <Text style={styles.infoText}>{notes}</Text>
            </View>
          )
        : null}
    </View>
  );
}

function StatusTimeline({ currentStatus, styles }: { currentStatus: OrderStatus; styles: Styles }) {
  const { t } = useTranslation();
  const currentIdx = STATUS_STEPS.indexOf(currentStatus);

  return (
    <View style={styles.card}>
      {STATUS_STEPS.map((step, idx) => {
        const done = idx <= currentIdx;
        const active = idx === currentIdx;
        const last = idx === STATUS_STEPS.length - 1;
        return (
          <View key={step} style={[styles.stepRow, last && { minHeight: 24 }]}>
            <View style={styles.stepRail}>
              <View style={[styles.stepDot, done && styles.stepDotDone, active && styles.stepDotActive]}>
                {done && !active ? <Check size={13} color={BRAND.ink} weight="bold" /> : null}
              </View>
              {!last && <View style={[styles.stepLine, idx < currentIdx && styles.stepLineDone]} />}
            </View>
            <Text style={[styles.stepLabel, done && styles.stepLabelDone, active && styles.stepLabelActive, last && { paddingBottom: 0 }]}>
              {t(`orders.${step}`)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function OrderItems({ order, isAr, styles }: { order: Order; isAr: boolean; styles: Styles }) {
  const locale = isAr ? "ar-EG" : "en-GB";
  return (
    <View style={styles.card}>
      {(order.items ?? []).map(item => (
        <View key={item.id} style={styles.itemRow}>
          <Text style={styles.itemQty}>
            {item.quantity.toLocaleString(locale)}
            ×
          </Text>
          <Text style={styles.itemName} numberOfLines={2}>
            {isAr ? item.productNameArSnapshot : item.productNameSnapshot}
          </Text>
          <Text style={styles.itemPrice}>
            {formatCurrency(getOrderItemTotal(item))}
          </Text>
        </View>
      ))}
    </View>
  );
}

function OrderSummary({ order, styles }: { order: Order; styles: Styles }) {
  const { t } = useTranslation();
  return (
    <View style={styles.card}>
      <View style={styles.summaryRow}>
        <Text style={styles.summaryLabel}>{t("checkout.payment")}</Text>
        <Text style={styles.summaryValue}>
          {order.paymentMethod === "CASH" ? t("checkout.cash") : t("checkout.card")}
        </Text>
      </View>
      <View style={styles.summaryRow}>
        <Text style={styles.summaryLabel}>{t("orders.paid")}</Text>
        <Text style={[styles.summaryValue, { color: order.isPaid ? SEMANTIC.success : SEMANTIC.warning }]}>
          {order.isPaid ? t("orders.paid") : t("orders.unpaid")}
        </Text>
      </View>
      <View style={[styles.summaryRow, styles.totalRow]}>
        <Text style={styles.totalLabel}>{t("cart.total")}</Text>
        <Text style={styles.totalValue}>
          {formatCurrency(order.totalAmount)}
        </Text>
      </View>
    </View>
  );
}

function OrderDetailSkeleton() {
  const { styles } = useStyles();
  return (
    <View style={styles.container}>
      <ScreenHeader title="" />
      <View style={{ padding: SPACING.base, gap: SPACING.md }}>
        <Skeleton width="100%" height={32} borderRadius={RADIUS.full} />
        <Skeleton width="100%" height={220} borderRadius={RADIUS.lg} />
        <Skeleton width="100%" height={120} borderRadius={RADIUS.lg} />
        <Skeleton width="100%" height={100} borderRadius={RADIUS.lg} />
      </View>
    </View>
  );
}
