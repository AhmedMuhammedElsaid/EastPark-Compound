import type { MerchantOrder } from "@/services/api/merchant";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { showMessage } from "react-native-flash-message";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { DetailErrorScreen } from "@/components/ui/error-state";

import { ScreenHeader } from "@/components/ui/screen-header";
import { Skeleton } from "@/components/ui/skeleton";
import { getErrorStatus } from "@/lib/api-error";
import { showConfirm } from "@/lib/confirm-dialog";
import { formatCurrency } from "@/lib/format-currency";
import { useAppColors } from "@/lib/hooks/use-app-colors";
import i18n from "@/lib/i18n";
import { formatOrderNumber } from "@/lib/whatsapp";
import { getOrderResidentName, getOrderUnit, merchantApi } from "@/services/api/merchant";
import { getOrderItemTotal } from "@/services/api/orders";
import { canCancelOrder, getNextOrderStatus, isTerminalOrderStatus } from "@/services/orders/status-transitions";
import { BRAND, FONT, RADIUS, SEMANTIC, SPACING } from "@/theme/tokens";

function useStyles() {
  const colors = useAppColors();
  return React.useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    scroll: { padding: SPACING.base, gap: SPACING.md },
    statusCard: {
      backgroundColor: colors.card,
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: SPACING.base,
      borderStartWidth: 4,
      borderStartColor: BRAND.gold,
    },
    statusLabel: { fontFamily: FONT.sans, fontWeight: "700", fontSize: 16, color: colors.text },
    itemsCard: {
      backgroundColor: colors.card,
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: SPACING.base,
      gap: SPACING.sm,
    },
    itemRow: { flexDirection: "row" as const, alignItems: "center" as const, gap: SPACING.sm },
    itemQty: { fontFamily: FONT.sans, fontWeight: "700", fontSize: 14, color: "primaryText" in colors ? colors.primaryText : BRAND.gold, minWidth: 28 },
    itemName: { flex: 1, fontFamily: FONT.sans, fontSize: 14, lineHeight: 22, color: colors.text },
    itemPrice: { fontFamily: FONT.sans, fontWeight: "600", fontSize: 14, color: colors.text },
    totalRow: { flexDirection: "row" as const, justifyContent: "space-between" as const, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: SPACING.sm, marginTop: SPACING.xs },
    totalLabel: { fontFamily: FONT.sans, fontWeight: "600", fontSize: 15, color: colors.text },
    totalValue: { fontFamily: FONT.sans, fontWeight: "700", fontSize: 16, color: "primaryText" in colors ? colors.primaryText : BRAND.gold },
    metaCard: {
      backgroundColor: colors.card,
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: SPACING.base,
      gap: SPACING.sm,
    },
    metaRow: { flexDirection: "row" as const, justifyContent: "space-between" as const, gap: SPACING.sm },
    metaLabel: { fontFamily: FONT.sans, fontSize: 13, lineHeight: 20, color: colors.textMuted },
    metaValue: { fontFamily: FONT.sans, fontSize: 13, color: colors.text, fontWeight: "500", flex: 1, textAlign: "right" as const, lineHeight: 20 },
    actions: { flexDirection: "row" as const, gap: SPACING.md },
    acceptBtn: {
      flex: 1,
      height: 52,
      borderRadius: RADIUS.md,
      backgroundColor: BRAND.gold,
      justifyContent: "center" as const,
      alignItems: "center" as const,
    },
    acceptBtnText: { fontFamily: FONT.sans, fontWeight: "700", fontSize: 15, lineHeight: 22, color: BRAND.ink, textAlign: "center" as const },
    rejectBtn: {
      flex: 1,
      height: 52,
      borderRadius: RADIUS.md,
      borderWidth: 1,
      borderColor: SEMANTIC.error,
      justifyContent: "center" as const,
      alignItems: "center" as const,
    },
    rejectBtnText: { fontFamily: FONT.sans, fontWeight: "600", fontSize: 15, lineHeight: 22, color: SEMANTIC.error, textAlign: "center" as const },
    btnDisabled: { opacity: 0.5 },
    pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
    headerInfo: { gap: 0 },
    headerName: { fontFamily: FONT.sans, fontSize: 12, lineHeight: 18, color: colors.textMuted },
    headerTime: { fontFamily: FONT.sans, fontSize: 13, lineHeight: 20, color: colors.textMuted, paddingHorizontal: SPACING.sm },
  }), [colors]);
}

export default function MerchantOrderDetailScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const styles = useStyles();
  const colors = useAppColors();

  const { data, isError, isLoading, refetch } = useQuery({
    queryKey: ["merchant-order", orderId],
    queryFn: () => merchantApi.getOrder(orderId),
    enabled: !!orderId,
    // Poll only while the order can still change.
    refetchInterval: (query) => {
      const status = query.state.data?.data.data.status;
      return status && isTerminalOrderStatus(status) ? false : 10_000;
    },
  });

  const order = data?.data.data;

  // 409 = the order moved (or was paid) since this screen loaded: refetch so
  // the merchant sees the real state, and say so.
  function handleStatusError(error: unknown) {
    const conflict = getErrorStatus(error) === 409;
    if (conflict) {
      queryClient.invalidateQueries({ queryKey: ["merchant-order", orderId] });
      queryClient.invalidateQueries({ queryKey: ["merchant-orders"] });
    }
    showMessage({
      message: t(conflict ? "merchant.status_conflict" : "common.error"),
      type: "danger",
      backgroundColor: SEMANTIC.error,
    });
  }

  const { mutate: updateStatus, isPending } = useMutation({
    mutationFn: (status: string) => merchantApi.updateOrderStatus(orderId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["merchant-order", orderId] });
      queryClient.invalidateQueries({ queryKey: ["merchant-orders"] });
    },
    onError: handleStatusError,
  });

  const { mutate: rejectOrder, isPending: rejecting } = useMutation({
    mutationFn: () => merchantApi.updateOrderStatus(orderId, "CANCELLED"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["merchant-order", orderId] });
      queryClient.invalidateQueries({ queryKey: ["merchant-orders"] });
      router.back();
    },
    onError: handleStatusError,
  });

  if (isError && !order)
    return <DetailErrorScreen onRetry={() => refetch()} />;
  if (isLoading || !order)
    return <OrderDetailSkeleton insets={insets} />;

  const nextStatus = getNextOrderStatus(order.status);
  const isActive = !isTerminalOrderStatus(order.status);
  const canCancel = canCancelOrder(order);
  const locale = i18n.language === "ar" ? "ar-EG" : "en-GB";
  const time = new Date(order.createdAt).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });

  return (
    <View style={styles.container}>
      <ScreenHeader
        title={t("checkout.unit", { number: getOrderUnit(order) })}
        right={<Text style={styles.headerTime}>{`${formatOrderNumber(order.id)} · ${time}`}</Text>}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + SPACING.xl }]}
      >
        <OrderStatusBadge status={order.status} name={getOrderResidentName(order) ?? undefined} styles={styles} colors={colors} />
        <OrderItemsList order={order} styles={styles} />
        <OrderMeta order={order} styles={styles} />

        {isActive && (
          <ActionButtons
            status={order.status}
            nextStatus={nextStatus}
            canCancel={canCancel}
            onAdvance={() => {
              if (nextStatus)
                updateStatus(nextStatus);
            }}
            onReject={async () => {
              if (await confirmEndOrder(order.status === "PLACED"))
                rejectOrder();
            }}
            isPending={isPending || rejecting}
            isRejecting={rejecting || isPending}
            styles={styles}
          />
        )}
      </ScrollView>
    </View>
  );
}

/** Reject (still PLACED) or cancel confirm. Dismiss is "Keep order", never a second "cancel". */
function confirmEndOrder(isReject: boolean): Promise<boolean> {
  const action = i18n.t(isReject ? "merchant.reject" : "orders.cancel_order");
  return showConfirm({
    title: action,
    message: i18n.t(isReject ? "merchant.confirm_reject" : "merchant.confirm_cancel_order"),
    confirmLabel: action,
    cancelLabel: i18n.t("orders.cancel_keep"),
    destructive: true,
  });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function OrderStatusBadge({ status, name, styles, colors }: { status: string; name?: string; styles: any; colors: any }) {
  const { t } = useTranslation();
  const statusColors: Record<string, string> = {
    PLACED: SEMANTIC.info,
    CONFIRMED: SEMANTIC.info,
    PREPARING: SEMANTIC.warning,
    READY: SEMANTIC.success,
    ON_THE_WAY: BRAND.gold,
    DELIVERED: colors.textMuted,
    CANCELLED: SEMANTIC.error,
  };
  return (
    <View style={[styles.statusCard, { borderStartColor: statusColors[status] ?? colors.border }]}>
      <Text style={styles.statusLabel}>{t(`orders.${status}`)}</Text>
      {name ? <Text style={styles.headerName}>{name}</Text> : null}
    </View>
  );
}

function OrderItemsList({ order, styles }: { order: MerchantOrder; styles: any }) {
  const { t } = useTranslation();
  return (
    <View style={styles.itemsCard}>
      {(order.items ?? []).map(item => (
        <View key={item.id} style={styles.itemRow}>
          <Text style={styles.itemQty}>
            {item.quantity}
            ×
          </Text>
          <Text style={styles.itemName} numberOfLines={1}>{item.productNameSnapshot}</Text>
          <Text style={styles.itemPrice}>{formatCurrency(getOrderItemTotal(item))}</Text>
        </View>
      ))}
      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>{t("cart.total")}</Text>
        <Text style={styles.totalValue}>{formatCurrency(order.totalAmount)}</Text>
      </View>
    </View>
  );
}

function OrderMeta({ order, styles }: { order: MerchantOrder; styles: any }) {
  const { t } = useTranslation();
  return (
    <View style={styles.metaCard}>
      <View style={styles.metaRow}>
        <Text style={styles.metaLabel}>{t("checkout.payment")}</Text>
        <Text style={styles.metaValue}>{order.paymentMethod === "CASH" ? t("checkout.cash") : t("checkout.card")}</Text>
      </View>
      {order.notes && (
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>{t("checkout.notes")}</Text>
          <Text style={styles.metaValue}>{order.notes}</Text>
        </View>
      )}
    </View>
  );
}

function ActionButtons({
  status,
  nextStatus,
  canCancel,
  onAdvance,
  onReject,
  isPending,
  isRejecting,
  styles,
}: {
  status: string;
  nextStatus: string | null;
  canCancel: boolean;
  onAdvance: () => void;
  onReject: () => void;
  isPending: boolean;
  isRejecting: boolean;
  styles: any;
}) {
  const { t } = useTranslation();
  return (
    <View style={styles.actions}>
      {canCancel && (
        <Pressable
          style={({ pressed }) => [styles.rejectBtn, isRejecting && styles.btnDisabled, pressed && styles.pressed]}
          accessibilityRole="button"
          onPress={onReject}
          disabled={isRejecting}
        >
          <Text style={styles.rejectBtnText}>{status === "PLACED" ? t("merchant.reject") : t("orders.cancel_order")}</Text>
        </Pressable>
      )}
      {nextStatus && (
        <Pressable
          style={({ pressed }) => [styles.acceptBtn, isPending && styles.btnDisabled, pressed && styles.pressed]}
          accessibilityRole="button"
          onPress={onAdvance}
          disabled={isPending}
        >
          <Text style={styles.acceptBtnText}>
            {status === "PLACED" ? t("merchant.accept") : t(`merchant.advance_to_${nextStatus}`)}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

function OrderDetailSkeleton({ insets }: { insets: { top: number } }) {
  const colors = useAppColors();
  const styles = useStyles();
  return (
    <View style={styles.container}>
      <View style={{ height: insets.top + 60, backgroundColor: colors.bg, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }} />
      <View style={{ padding: SPACING.base, gap: SPACING.md }}>
        <Skeleton width="100%" height={60} borderRadius={RADIUS.md} />
        <Skeleton width="100%" height={140} borderRadius={RADIUS.md} />
        <Skeleton width="100%" height={80} borderRadius={RADIUS.md} />
      </View>
    </View>
  );
}
