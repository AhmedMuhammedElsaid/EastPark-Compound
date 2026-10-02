import type { AxiosResponse } from "axios";
import type { MerchantOrder } from "@/services/api/merchant";
import { FlashList } from "@shopify/flash-list";
import { useInfiniteQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { ArrowLeft, Tray } from "phosphor-react-native";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/format-currency";
import { useAppColors } from "@/lib/hooks/use-app-colors";
import i18n from "@/lib/i18n";
import { getOrderResidentName, getOrderUnit, merchantApi } from "@/services/api/merchant";
import { BRAND, FONT, RADIUS, SEMANTIC, SPACING } from "@/theme/tokens";

const STATUS_FILTERS = ["ALL", "PLACED", "CONFIRMED", "PREPARING", "READY"] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

const STATUS_COLOR: Record<string, string> = {
  PLACED: SEMANTIC.info,
  CONFIRMED: SEMANTIC.info,
  PREPARING: SEMANTIC.warning,
  READY: SEMANTIC.success,
  ON_THE_WAY: BRAND.gold,
  DELIVERED: "", // overridden at render with colors.elevated
  CANCELLED: "", // overridden at render with colors.elevated
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
    filterBar: {
      backgroundColor: colors.bg,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    filterBarContent: {
      flexDirection: "row" as const,
      paddingHorizontal: SPACING.base,
      paddingVertical: SPACING.sm,
      gap: SPACING.sm,
    },
    filterChip: {
      paddingHorizontal: SPACING.md,
      paddingVertical: 6,
      borderRadius: RADIUS.full,
      borderWidth: 1,
      borderColor: colors.border,
    },
    filterChipActive: { backgroundColor: BRAND.gold, borderColor: BRAND.gold },
    filterChipText: { fontFamily: FONT.sans, fontSize: 12, color: colors.textMuted, fontWeight: "500" },
    filterChipTextActive: { color: colors.bg },
    loadingPad: { padding: SPACING.base },
    listContent: { padding: SPACING.base },
    empty: { alignItems: "center" as const, paddingTop: 80, gap: SPACING.md },
    emptyText: { fontFamily: FONT.sans, fontSize: 15, color: colors.textMuted },
    card: {
      backgroundColor: colors.card,
      borderRadius: RADIUS.md,
      padding: SPACING.md,
      marginBottom: SPACING.md,
      gap: SPACING.xs,
    },
    cardTop: { flexDirection: "row" as const, justifyContent: "space-between" as const, alignItems: "flex-start" as const },
    cardLeft: { gap: 2 },
    cardRight: { alignItems: "flex-end" as const, gap: 4 },
    unitLabel: { fontFamily: FONT.sans, fontWeight: "700", fontSize: 14, color: BRAND.gold },
    customerName: { fontFamily: FONT.sans, fontSize: 13, color: colors.textMuted },
    statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.full },
    statusText: { fontFamily: FONT.sans, fontWeight: "600", fontSize: 11, color: colors.text },
    time: { fontFamily: FONT.sans, fontSize: 12, color: colors.textMuted },
    items: { fontFamily: FONT.sans, fontSize: 13, color: colors.textMuted },
    total: { fontFamily: FONT.sans, fontWeight: "700", fontSize: 15, color: colors.text },
  }), [colors]);
}

export default function MerchantOrdersScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const colors = useAppColors();
  const [filter, setFilter] = React.useState<StatusFilter>("ALL");

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, refetch }
    = useInfiniteQuery<
      AxiosResponse<{ data: { items: MerchantOrder[]; nextCursor: string | null } }>,
      Error,
      { pages: AxiosResponse<{ data: { items: MerchantOrder[]; nextCursor: string | null } }>[] },
      string[],
      string | undefined
    >({
      queryKey: ["merchant-orders", filter],
      queryFn: ({ pageParam }) =>
        merchantApi.getIncomingOrders({
          cursor: pageParam,
          limit: 20,
          status: filter === "ALL" ? undefined : filter,
        }),
      getNextPageParam: last => last.data.data.nextCursor ?? undefined,
      initialPageParam: undefined,
      refetchInterval: 15000,
    });

  const orders = data?.pages.flatMap(p => p.data.data.items).filter(Boolean) ?? [];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.nav}>
        <Pressable style={styles.backBtn} onPress={() => router.back()} hitSlop={8} accessibilityRole="button" accessibilityLabel={t("common.back")}>
          <ArrowLeft size={18} color={colors.text} />
        </Pressable>
        <Text style={styles.navTitle}>{t("merchant.orders")}</Text>
      </View>

      <StatusFilterBar filter={filter} onSelect={setFilter} styles={styles} />

      {isLoading
        ? (
            <View style={styles.loadingPad}>
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={`morder-sk-${i}`} width="100%" height={104} borderRadius={RADIUS.md} style={{ marginBottom: 12 }} />
              ))}
            </View>
          )
        : (
            <FlashList
              data={orders}
              keyExtractor={item => item.id}
              renderItem={({ item }) => <MerchantOrderCard order={item} styles={styles} colors={colors} />}
              onEndReached={() => {
                if (hasNextPage && !isFetchingNextPage)
                  fetchNextPage();
              }}
              onEndReachedThreshold={0.5}
              contentContainerStyle={styles.listContent}
              onRefresh={refetch}
              refreshing={false}
              ListEmptyComponent={(
                <View style={styles.empty}>
                  <Tray size={48} color={colors.textMuted} />
                  <Text style={styles.emptyText}>{t("common.no_results")}</Text>
                </View>
              )}
              ListFooterComponent={
                isFetchingNextPage ? <Skeleton width="100%" height={104} borderRadius={RADIUS.md} /> : null
              }
            />
          )}
    </View>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusFilterBar({ filter, onSelect, styles }: { filter: StatusFilter; onSelect: (f: StatusFilter) => void; styles: any }) {
  const { t } = useTranslation();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.filterBar}
      contentContainerStyle={styles.filterBarContent}
    >
      {STATUS_FILTERS.map((key) => {
        const active = filter === key;
        const label = key === "ALL" ? t("directory.all_categories") : t(`orders.${key}`);
        return (
          <Pressable
            key={key}
            style={[styles.filterChip, active && styles.filterChipActive]}
            onPress={() => onSelect(key)}
          >
            <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function MerchantOrderCard({ order, styles, colors }: { order: MerchantOrder; styles: any; colors: any }) {
  const { t } = useTranslation();
  const statusColor = (order.status === "DELIVERED" || order.status === "CANCELLED")
    ? colors.elevated
    : (STATUS_COLOR[order.status] ?? colors.elevated);
  const locale = i18n.language === "ar" ? "ar-EG" : "en-GB";
  const time = new Date(order.createdAt).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });

  return (
    <Pressable
      style={styles.card}
      onPress={() => router.push(`/(merchant)/orders/${order.id}`)}
    >
      <View style={styles.cardTop}>
        <View style={styles.cardLeft}>
          <Text style={styles.unitLabel}>{t("checkout.unit", { number: getOrderUnit(order) })}</Text>
          {getOrderResidentName(order) ? <Text style={styles.customerName}>{getOrderResidentName(order)}</Text> : null}
        </View>
        <View style={styles.cardRight}>
          <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
            <Text style={styles.statusText}>{t(`orders.${order.status}`)}</Text>
          </View>
          <Text style={styles.time}>{time}</Text>
        </View>
      </View>
      <Text style={styles.items} numberOfLines={1}>
        {(order.items ?? []).map(item => `${item.quantity}× ${item.productNameSnapshot}`).join(", ")}
      </Text>
      <Text style={styles.total}>{formatCurrency(order.totalAmount)}</Text>
    </Pressable>
  );
}
