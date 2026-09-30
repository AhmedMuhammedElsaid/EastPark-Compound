import type { Socket } from "socket.io-client";
import type { Order, OrderStatus } from "@/services/api/orders";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { ArrowLeft } from "phosphor-react-native";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/format-currency";
import { useAppColors } from "@/lib/hooks/use-app-colors";
import { ordersApi } from "@/services/api/orders";
import { getOrdersSocket, joinOrderRoom, leaveOrderRoom } from "@/services/socket/client";
import { BRAND, FONT, RADIUS, SEMANTIC, SPACING } from "@/theme/tokens";

const STATUS_STEPS: OrderStatus[] = ["PLACED", "CONFIRMED", "PREPARING", "READY", "ON_THE_WAY", "DELIVERED"];

const STATUS_COLOR: Record<string, string> = {
  PLACED: SEMANTIC.info,
  CONFIRMED: SEMANTIC.info,
  PREPARING: SEMANTIC.warning,
  READY: SEMANTIC.warning,
  ON_THE_WAY: BRAND.gold,
  DELIVERED: SEMANTIC.success,
};

function useStyles() {
  const colors = useAppColors();
  return React.useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    nav: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      paddingHorizontal: SPACING.base,
      paddingVertical: SPACING.md,
      gap: SPACING.md,
      backgroundColor: colors.card,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    backBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.elevated,
      justifyContent: "center" as const,
      alignItems: "center" as const,
    },
    navInfo: { flex: 1, flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "space-between" as const, gap: SPACING.sm },
    navShop: { fontFamily: FONT.sans, fontWeight: "700", fontSize: 16, color: colors.text, flex: 1 },
    statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.full },
    statusText: { fontFamily: FONT.sans, fontWeight: "600", fontSize: 11, color: colors.text },
    scroll: { padding: SPACING.base, gap: SPACING.md },
    timeline: {
      flexDirection: "row" as const,
      alignItems: "flex-start" as const,
      backgroundColor: colors.card,
      borderRadius: RADIUS.md,
      padding: SPACING.md,
      overflow: "hidden" as const,
    },
    timelineItem: { flex: 1, alignItems: "center" as const, gap: 6 },
    timelineDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.elevated, borderWidth: 2, borderColor: colors.border },
    timelineDotDone: { backgroundColor: BRAND.gold, borderColor: BRAND.gold },
    timelineDotActive: { width: 16, height: 16, borderRadius: 8 },
    timelineLine: {
      position: "absolute" as const,
      top: 6,
      left: "50%",
      right: -40,
      height: 2,
      backgroundColor: colors.border,
      zIndex: -1,
    },
    timelineLineDone: { backgroundColor: BRAND.gold },
    timelineLabel: { fontFamily: FONT.sans, fontSize: 9, color: colors.textMuted, textAlign: "center" as const },
    timelineLabelDone: { color: BRAND.gold },
    section: {
      backgroundColor: colors.card,
      borderRadius: RADIUS.md,
      padding: SPACING.md,
      gap: SPACING.sm,
    },
    summarySection: { gap: SPACING.md },
    itemRow: { flexDirection: "row" as const, alignItems: "center" as const, gap: SPACING.sm },
    itemQty: { fontFamily: FONT.sans, fontWeight: "700", fontSize: 14, color: BRAND.gold, minWidth: 28 },
    itemName: { fontFamily: FONT.sans, fontSize: 14, color: colors.text, flex: 1 },
    itemPrice: { fontFamily: FONT.sans, fontWeight: "600", fontSize: 14, color: colors.text },
    summaryRow: { flexDirection: "row" as const, justifyContent: "space-between" as const, alignItems: "center" as const },
    summaryLabel: { fontFamily: FONT.sans, fontSize: 14, color: colors.textMuted },
    summaryValue: { fontFamily: FONT.sans, fontWeight: "600", fontSize: 14, color: colors.text },
    totalRow: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: SPACING.md, marginTop: SPACING.xs },
    totalLabel: { fontFamily: FONT.sans, fontWeight: "700", fontSize: 16, color: colors.text },
    totalValue: { fontFamily: FONT.sans, fontWeight: "700", fontSize: 18, color: BRAND.gold },
    cancelBtn: {
      height: 48,
      borderRadius: RADIUS.md,
      borderWidth: 1,
      borderColor: SEMANTIC.error,
      justifyContent: "center" as const,
      alignItems: "center" as const,
    },
    cancelBtnDisabled: { opacity: 0.5 },
    cancelBtnText: { fontFamily: FONT.sans, fontWeight: "600", fontSize: 14, color: SEMANTIC.error },
  }), [colors]);
}

export default function OrderDetailScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const colors = useAppColors();
  const styles = useStyles();
  const isAr = i18n.language === "ar";

  const { data, isLoading } = useQuery({
    queryKey: ["order", orderId],
    queryFn: () => ordersApi.getOrder(orderId),
    enabled: !!orderId,
  });

  const order = data?.data.data;

  // Socket.io real-time status
  React.useEffect(() => {
    if (!orderId)
      return;
    let mounted = true;
    let socketRef: Socket | null = null;

    const handler = (update: { orderId: string; status: OrderStatus }) => {
      if (!mounted)
        return;
      if (update.orderId === orderId) {
        queryClient.invalidateQueries({ queryKey: ["order", orderId] });
        queryClient.invalidateQueries({ queryKey: ["orders"] });
      }
    };

    getOrdersSocket().then((socket) => {
      if (!mounted)
        return;
      socketRef = socket;
      joinOrderRoom(orderId);
      socket.on("order_status_updated", handler);
    });

    return () => {
      mounted = false;
      leaveOrderRoom(orderId);
      if (socketRef) {
        socketRef.off("order_status_updated", handler);
      }
    };
  }, [orderId, queryClient]);

  const { mutate: cancelOrder, isPending: cancelling } = useMutation({
    mutationFn: () => ordersApi.cancelOrder(orderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["order", orderId] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
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

  if (isLoading || !order)
    return <OrderDetailSkeleton insets={insets} />;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <OrderNav order={order} isAr={isAr} colors={colors} styles={styles} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + SPACING.xl }]}
      >
        {order.status !== "CANCELLED" && (
          <StatusTimeline currentStatus={order.status} styles={styles} />
        )}
        <OrderItems order={order} isAr={isAr} styles={styles} />
        <OrderSummary order={order} styles={styles} />
        {order.status === "PLACED" && (
          <Pressable
            style={[styles.cancelBtn, cancelling && styles.cancelBtnDisabled]}
            onPress={handleCancel}
            disabled={cancelling}
          >
            <Text style={styles.cancelBtnText}>{t("orders.cancel_order")}</Text>
          </Pressable>
        )}
      </ScrollView>
    </View>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function OrderNav({ order, isAr, colors, styles }: { order: Order; isAr: boolean; colors: any; styles: any }) {
  const { t } = useTranslation();
  const shopName = isAr ? order.shop?.nameAr : order.shop?.name;
  const statusColor = order.status === "CANCELLED" ? colors.elevated : (STATUS_COLOR[order.status] ?? colors.elevated);

  return (
    <View style={styles.nav}>
      <Pressable style={styles.backBtn} onPress={() => router.back()} hitSlop={8}>
        <ArrowLeft size={18} color={colors.text} />
      </Pressable>
      <View style={styles.navInfo}>
        <Text style={styles.navShop} numberOfLines={1}>{shopName ?? t("orders.unknown_shop")}</Text>
        <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
          <Text style={styles.statusText}>{t(`orders.${order.status}`)}</Text>
        </View>
      </View>
    </View>
  );
}

function StatusTimeline({ currentStatus, styles }: { currentStatus: OrderStatus; styles: any }) {
  const { t } = useTranslation();
  const currentIdx = STATUS_STEPS.indexOf(currentStatus);

  return (
    <View style={styles.timeline}>
      {STATUS_STEPS.map((step, idx) => {
        const done = idx <= currentIdx;
        const active = idx === currentIdx;
        return (
          <View key={step} style={styles.timelineItem}>
            <View style={[styles.timelineDot, done && styles.timelineDotDone, active && styles.timelineDotActive]} />
            {idx < STATUS_STEPS.length - 1 && (
              <View style={[styles.timelineLine, done && styles.timelineLineDone]} />
            )}
            <Text style={[styles.timelineLabel, done && styles.timelineLabelDone]}>
              {t(`orders.${step}`)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function OrderItems({ order, isAr, styles }: { order: Order; isAr: boolean; styles: any }) {
  return (
    <View style={styles.section}>
      {(order.items ?? []).map(item => (
        <View key={item.id} style={styles.itemRow}>
          <Text style={styles.itemQty}>
            {item.quantity}
            ×
          </Text>
          <Text style={styles.itemName} numberOfLines={1}>
            {isAr ? item.productNameArSnapshot : item.productNameSnapshot}
          </Text>
          <Text style={styles.itemPrice}>
            {formatCurrency(item.totalPrice)}
          </Text>
        </View>
      ))}
    </View>
  );
}

function OrderSummary({ order, styles }: { order: Order; styles: any }) {
  const { t } = useTranslation();
  return (
    <View style={[styles.section, styles.summarySection]}>
      <View style={styles.summaryRow}>
        <Text style={styles.summaryLabel}>{t("checkout.payment")}</Text>
        <Text style={styles.summaryValue}>
          {order.paymentMethod === "CASH" ? t("checkout.cash") : t("checkout.card")}
        </Text>
      </View>
      <View style={styles.summaryRow}>
        <Text style={styles.summaryLabel}>{t("orders.paid")}</Text>
        <Text style={[styles.summaryValue, { color: order.isPaid ? SEMANTIC.success : SEMANTIC.error }]}>
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

function OrderDetailSkeleton({ insets }: { insets: { top: number } }) {
  const colors = useAppColors();
  const styles = useStyles();
  return (
    <View style={styles.container}>
      <View style={{ height: insets.top + 56, backgroundColor: colors.card }} />
      <View style={{ padding: SPACING.base, gap: SPACING.md }}>
        <Skeleton width="100%" height={80} borderRadius={RADIUS.md} />
        <Skeleton width="100%" height={120} borderRadius={RADIUS.md} />
        <Skeleton width="100%" height={80} borderRadius={RADIUS.md} />
      </View>
    </View>
  );
}
