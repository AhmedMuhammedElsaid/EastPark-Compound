import type { AxiosResponse } from "axios";
import type { MerchantOrder } from "@/services/api/merchant";
import { FlashList } from "@shopify/flash-list";
import { useInfiniteQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { Tray } from "phosphor-react-native";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ErrorState } from "@/components/ui/error-state";
import { ScreenHeader } from "@/components/ui/screen-header";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/format-currency";
import { useAppColors } from "@/lib/hooks/use-app-colors";
import i18n from "@/lib/i18n";
import { formatOrderNumber } from "@/lib/whatsapp";
import { getOrderResidentName, getOrderUnit, merchantApi } from "@/services/api/merchant";
import { BRAND, FONT, RADIUS, SEMANTIC, SPACING } from "@/theme/tokens";

const STATUS_FILTERS = ["ALL", "PLACED", "CONFIRMED", "PREPARING", "READY", "ON_THE_WAY"] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

const STATUS_COLOR: Record<string, string> = {
  PLACED: SEMANTIC.info,
  CONFIRMED: SEMANTIC.info,
  PREPARING: SEMANTIC.warning,
  READY: SEMANTIC.success,
  ON_THE_WAY: BRAND.gold,
  DELIVERED: "", // falls back to the muted text color at render
  CANCELLED: SEMANTIC.error,
};

function useStyles() {
  const colors = useAppColors();
  return React.useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
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
      minHeight: 44,
      justifyContent: "center" as const,
      paddingHorizontal: SPACING.base,
      borderRadius: RADIUS.full,
      borderWidth: 1,
      borderColor: colors.border,
    },
    filterChipActive: { backgroundColor: BRAND.gold, borderColor: BRAND.gold },
    filterChipText: { fontFamily: FONT.sans, fontSize: 13, lineHeight: 20, color: colors.textMuted, fontWeight: "500" },
    filterChipTextActive: { color: BRAND.ink, fontWeight: "700" },
    loadingPad: { padding: SPACING.base },
    listContent: { padding: SPACING.base },
    empty: { alignItems: "center" as const, paddingTop: 80, gap: SPACING.md, paddingHorizontal: SPACING.xl },
    emptyIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: `${BRAND.gold}1f`, alignItems: "center" as const, justifyContent: "center" as const },
    emptyText: { fontFamily: FONT.sans, fontSize: 15, lineHeight: 24, color: colors.textMuted, textAlign: "center" as const },
    pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
    card: {
      backgroundColor: colors.card,
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: SPACING.base,
      marginBottom: SPACING.md,
      gap: SPACING.xs,
    },
    cardTop: { flexDirection: "row" as const, justifyContent: "space-between" as const, alignItems: "flex-start" as const, gap: SPACING.sm },
    cardLeft: { flex: 1, gap: 2 },
    cardRight: { alignItems: "flex-end" as const, gap: 4 },
    unitLabel: { fontFamily: FONT.sans, fontWeight: "700", fontSize: 14, lineHeight: 22, color: "primaryText" in colors ? colors.primaryText : BRAND.gold },
    customerName: { fontFamily: FONT.sans, fontSize: 13, lineHeight: 20, color: colors.textMuted },
    statusBadge: { paddingHorizontal: SPACING.sm, paddingVertical: 2, borderRadius: RADIUS.full },
    statusText: { fontFamily: FONT.sans, fontWeight: "600", fontSize: 11, lineHeight: 18, color: colors.text },
    time: { fontFamily: FONT.sans, fontSize: 12, lineHeight: 18, color: colors.textMuted },
    items: { fontFamily: FONT.sans, fontSize: 13, lineHeight: 20, color: colors.textMuted },
    total: { fontFamily: FONT.sans, fontWeight: "700", fontSize: 15, lineHeight: 24, color: colors.text },
  }), [colors]);
}

export default function MerchantOrdersScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const colors = useAppColors();
  const [filter, setFilter] = React.useState<StatusFilter>("ALL");

  const { data, fetchNextPage, hasNextPage, isError, isFetchingNextPage, isLoading, refetch }
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
    <View style={styles.container}>
      <ScreenHeader title={t("merchant.orders")} />

      <StatusFilterBar filter={filter} onSelect={setFilter} styles={styles} />

      {isError && !data
        ? <ErrorState onRetry={() => refetch()} />
        : isLoading
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
                contentContainerStyle={{ ...styles.listContent, paddingBottom: insets.bottom + SPACING.xl }}
                onRefresh={refetch}
                refreshing={false}
                ListEmptyComponent={(
                  <View style={styles.empty}>
                    <View style={styles.emptyIcon}><Tray size={36} color={"primaryText" in colors ? colors.primaryText : BRAND.gold} /></View>
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
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
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
  const statusColor = STATUS_COLOR[order.status] || colors.textMuted;
  const locale = i18n.language === "ar" ? "ar-EG" : "en-GB";
  const time = new Date(order.createdAt).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      onPress={() => router.push(`/(merchant)/orders/${order.id}`)}
      accessibilityRole="button"
    >
      <View style={styles.cardTop}>
        <View style={styles.cardLeft}>
          <Text style={styles.unitLabel}>{t("checkout.unit", { number: getOrderUnit(order) })}</Text>
          {getOrderResidentName(order) ? <Text style={styles.customerName}>{getOrderResidentName(order)}</Text> : null}
        </View>
        <View style={styles.cardRight}>
          <View style={[styles.statusBadge, { backgroundColor: `${statusColor}33` }]}>
            <Text style={styles.statusText}>{t(`orders.${order.status}`)}</Text>
          </View>
          <Text style={styles.time}>{`${formatOrderNumber(order.id)} · ${time}`}</Text>
        </View>
      </View>
      <Text style={styles.items} numberOfLines={1}>
        {(order.items ?? []).map(item => `${item.quantity}× ${item.productNameSnapshot}`).join(", ")}
      </Text>
      <Text style={styles.total}>{formatCurrency(order.totalAmount)}</Text>
    </Pressable>
  );
}
