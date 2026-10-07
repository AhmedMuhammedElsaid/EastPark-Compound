import type { AxiosResponse } from "axios";
import type { Order } from "@/services/api/orders";
import { FlashList } from "@shopify/flash-list";
import { useInfiniteQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { CaretRight, Package, User } from "phosphor-react-native";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { I18nManager, Pressable, StyleSheet, Text, View } from "react-native";

import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GoldButton } from "@/components/auth/gold-button";
import { AppHeader } from "@/components/ui/app-header";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/format-currency";
import { useAppColors } from "@/lib/hooks/use-app-colors";
import { getOrderStatusAccent } from "@/lib/order-status-style";
import { formatOrderNumber } from "@/lib/whatsapp";
import { ordersApi } from "@/services/api/orders";
import { useAppDispatch, useAppSelector } from "@/store";
import { setPendingRedirect } from "@/store/slices/auth-slice";
import { BRAND, FONT, RADIUS, SPACING } from "@/theme/tokens";

function buildStyles(colors: ReturnType<typeof useAppColors>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    header: { paddingHorizontal: SPACING.base, paddingTop: SPACING.base, paddingBottom: SPACING.xs },
    headerTitle: { fontFamily: FONT.sans, fontWeight: "700", fontSize: 24, lineHeight: 36, color: colors.text },
    loadingPad: { padding: SPACING.base },
    listContent: { padding: SPACING.base, paddingBottom: SPACING["2xl"] },
    card: {
      backgroundColor: colors.card,
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: SPACING.base,
      marginBottom: SPACING.md,
      gap: SPACING.sm,
    },
    cardPressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
    cardTop: { flexDirection: "row" as const, justifyContent: "space-between" as const, alignItems: "center" as const, gap: SPACING.sm },
    shopName: { fontFamily: FONT.sans, fontWeight: "700", fontSize: 16, lineHeight: 24, color: colors.text, flex: 1 },
    pill: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: RADIUS.full,
    },
    pillDot: { width: 7, height: 7, borderRadius: 4 },
    pillText: { fontFamily: FONT.sans, fontWeight: "600", fontSize: 12, lineHeight: 18, color: colors.text },
    items: { fontFamily: FONT.sans, fontSize: 13, lineHeight: 20, color: colors.textMuted },
    cardBottom: {
      flexDirection: "row" as const,
      justifyContent: "space-between" as const,
      alignItems: "center" as const,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      paddingTop: SPACING.sm,
      gap: SPACING.sm,
    },
    total: { fontFamily: FONT.sans, fontWeight: "700", fontSize: 16, lineHeight: 24, color: "primaryText" in colors ? colors.primaryText : BRAND.gold },
    dateRow: { flexDirection: "row" as const, alignItems: "center" as const, gap: 4 },
    date: { fontFamily: FONT.sans, fontSize: 12, lineHeight: 18, color: colors.textMuted },
    empty: { alignItems: "center" as const, paddingTop: 72, gap: SPACING.md, paddingHorizontal: SPACING.xl },
    emptyIcon: {
      width: 96,
      height: 96,
      borderRadius: 48,
      backgroundColor: `${BRAND.gold}1f`,
      alignItems: "center" as const,
      justifyContent: "center" as const,
    },
    emptyTitle: { fontFamily: FONT.sans, fontWeight: "700", fontSize: 18, lineHeight: 28, color: colors.text, textAlign: "center" as const },
    emptyBody: { fontFamily: FONT.sans, fontSize: 14, color: colors.textMuted, textAlign: "center" as const, lineHeight: 22 },
    guestCard: {
      backgroundColor: colors.card,
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: SPACING.xl,
      margin: SPACING.base,
      alignItems: "center" as const,
      gap: SPACING.sm,
    },
    guestPrompt: { fontFamily: FONT.sans, fontWeight: "700", fontSize: 18, lineHeight: 28, color: colors.text, textAlign: "center" as const },
    guestSubtitle: { fontFamily: FONT.sans, fontSize: 14, color: colors.textMuted, textAlign: "center" as const, lineHeight: 22 },
  });
}

function useStyles() {
  const colors = useAppColors();
  return React.useMemo(() => ({ styles: buildStyles(colors), colors }), [colors]);
}

type Styles = ReturnType<typeof buildStyles>;
type Colors = ReturnType<typeof useAppColors>;

export default function OrdersScreen() {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const { styles, colors } = useStyles();
  const isAr = i18n.language === "ar";
  const isAuthenticated = useAppSelector(s => s.auth.isAuthenticated);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isError, isLoading, isRefetching, refetch }
    = useInfiniteQuery<
      AxiosResponse<{ data: { items: Order[]; nextCursor: string | null } }>,
      Error,
      { pages: AxiosResponse<{ data: { items: Order[]; nextCursor: string | null } }>[] },
      string[],
      string | undefined
    >({
      queryKey: ["orders"],
      queryFn: ({ pageParam }) => ordersApi.getOrders({ cursor: pageParam, limit: 20 }),
      getNextPageParam: last => last.data.data.nextCursor ?? undefined,
      initialPageParam: undefined,
      // Guests have no orders: never call the authenticated endpoint.
      enabled: isAuthenticated,
    });

  const orders = data?.pages.flatMap(p => p.data.data.items).filter(Boolean) ?? [];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <AppHeader />
      <View style={styles.header}>
        <Text style={styles.headerTitle} accessibilityRole="header">{t("orders.title")}</Text>
      </View>

      {!isAuthenticated
        ? <GuestOrders styles={styles} colors={colors} />
        : isError && !data
          ? <ErrorState onRetry={refetch} />
          : isLoading
            ? (
                <View style={styles.loadingPad}>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={`order-sk-${i}`} width="100%" height={118} borderRadius={RADIUS.lg} style={{ marginBottom: 12 }} />
                  ))}
                </View>
              )
            : (
                <FlashList
                  data={orders}
                  keyExtractor={item => item.id}
                  renderItem={({ item }) => <OrderCard order={item} isAr={isAr} colors={colors} styles={styles} />}
                  onEndReached={() => {
                    if (hasNextPage && !isFetchingNextPage)
                      fetchNextPage();
                  }}
                  onEndReachedThreshold={0.5}
                  contentContainerStyle={styles.listContent}
                  onRefresh={refetch}
                  refreshing={isRefetching}
                  ListEmptyComponent={<EmptyOrders styles={styles} />}
                  ListFooterComponent={
                    isFetchingNextPage
                      ? <Skeleton width="100%" height={118} borderRadius={RADIUS.lg} />
                      : null
                  }
                />
              )}
    </View>
  );
}

function OrderCard({ order, isAr, colors, styles }: { order: Order; isAr: boolean; colors: Colors; styles: Styles }) {
  const { t } = useTranslation();
  const shopName = isAr ? order?.shop?.nameAr : order?.shop?.name;
  const accent = getOrderStatusAccent(order.status);
  const date = new Date(order.createdAt).toLocaleString(isAr ? "ar-EG" : "en-GB", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const itemsLine = (order.items ?? []).map(item => (isAr ? item.productNameArSnapshot : item.productNameSnapshot)).join(isAr ? "، " : ", ");

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={() => router.push(`/(tabs)/orders/${order.id}`)}
      accessibilityRole="button"
      accessibilityLabel={`${shopName ?? t("orders.unknown_shop")}, ${t(`orders.${order.status}`)}`}
    >
      <View style={styles.cardTop}>
        <Text style={styles.shopName} numberOfLines={1}>{shopName ?? t("orders.unknown_shop")}</Text>
        <View style={[styles.pill, { backgroundColor: `${accent}2e` }]}>
          <View style={[styles.pillDot, { backgroundColor: accent }]} />
          <Text style={styles.pillText}>{t(`orders.${order.status}`)}</Text>
        </View>
      </View>
      {itemsLine
        ? <Text style={styles.items} numberOfLines={1}>{itemsLine}</Text>
        : null}
      <View style={styles.cardBottom}>
        <Text style={styles.total}>{formatCurrency(order.totalAmount)}</Text>
        <View style={styles.dateRow}>
          <Text style={styles.date}>{`${formatOrderNumber(order.id)} · ${date}`}</Text>
          <CaretRight mirrored={I18nManager.isRTL} size={14} color={colors.textMuted} />
        </View>
      </View>
    </Pressable>
  );
}

function EmptyOrders({ styles }: { styles: Styles }) {
  const { t } = useTranslation();
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Package size={44} color={BRAND.gold} weight="duotone" />
      </View>
      <Text style={styles.emptyTitle}>{t("orders.empty")}</Text>
      <Text style={styles.emptyBody}>{t("orders.empty_subtitle")}</Text>
      <GoldButton label={t("orders.browse_shops")} onPress={() => router.push("/(tabs)/directory")} />
    </View>
  );
}

function GuestOrders({ styles, colors }: { styles: Styles; colors: Colors }) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  return (
    <View style={styles.guestCard}>
      <User size={32} color={colors.textMuted} />
      <Text style={styles.guestPrompt}>{t("orders.guest_prompt")}</Text>
      <Text style={styles.guestSubtitle}>{t("orders.guest_subtitle")}</Text>
      <GoldButton
        label={t("auth.login")}
        onPress={() => {
          // Come back to the orders tab after signing in.
          dispatch(setPendingRedirect("/(tabs)/orders"));
          router.push("/(auth)/login");
        }}
      />
    </View>
  );
}
