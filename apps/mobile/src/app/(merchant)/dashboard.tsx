import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { Bell, CaretRight, ForkKnife, Package, Storefront } from "phosphor-react-native";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { I18nManager, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { DetailErrorScreen } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useAppColors } from "@/lib/hooks/use-app-colors";
import { merchantApi } from "@/services/api/merchant";
import { FONT, RADIUS, SEMANTIC, SPACING } from "@/theme/tokens";

function useStyles() {
  const colors = useAppColors();
  return React.useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    header: {
      flexDirection: "row" as const,
      justifyContent: "space-between" as const,
      alignItems: "center" as const,
      paddingHorizontal: SPACING.base,
      paddingVertical: SPACING.md,
      backgroundColor: colors.card,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    greeting: { fontFamily: FONT.sans, fontSize: 13, color: colors.textMuted },
    shopName: { fontFamily: FONT.sans, fontWeight: "700", fontSize: 20, color: colors.text },
    openRow: { flexDirection: "row" as const, alignItems: "center" as const, gap: SPACING.sm },
    openLabel: { fontFamily: FONT.sans, fontWeight: "600", fontSize: 13 },
    scroll: { padding: SPACING.base, gap: SPACING.md },
    alertBanner: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      backgroundColor: `${SEMANTIC.warning}22`,
      borderRadius: RADIUS.md,
      padding: SPACING.md,
      borderWidth: 1,
      borderColor: SEMANTIC.warning,
      gap: SPACING.sm,
    },
    alertText: { flex: 1, fontFamily: FONT.sans, fontWeight: "600", fontSize: 14, color: colors.text },
    quickActions: { flexDirection: "row" as const, gap: SPACING.md },
    quickCard: {
      flex: 1,
      backgroundColor: colors.card,
      borderRadius: RADIUS.md,
      padding: SPACING.md,
      alignItems: "center" as const,
      gap: SPACING.sm,
    },
    quickLabel: { fontFamily: FONT.sans, fontSize: 12, color: colors.textMuted, textAlign: "center" as const, fontWeight: "500" },
    statsRow: { flexDirection: "row" as const, gap: SPACING.md },
    statCard: {
      flex: 1,
      backgroundColor: colors.card,
      borderRadius: RADIUS.md,
      padding: SPACING.md,
      alignItems: "center" as const,
      gap: SPACING.xs,
    },
    statValue: { fontFamily: FONT.sans, fontWeight: "700", fontSize: 22 },
    statLabel: { fontFamily: FONT.sans, fontSize: 12, color: colors.textMuted },
  }), [colors]);
}

export default function MerchantDashboard() {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const isAr = i18n.language === "ar";
  const styles = useStyles();
  const colors = useAppColors();

  const { data: shopData, isError, isLoading, refetch } = useQuery({
    queryKey: ["merchant-shop"],
    queryFn: () => merchantApi.getMyShop(),
  });

  const { data: ordersData } = useQuery({
    queryKey: ["merchant-orders", "PLACED"],
    queryFn: () => merchantApi.getIncomingOrders({ status: "PLACED", limit: 5 }),
    refetchInterval: 30000,
  });

  const shop = shopData?.data.data;
  const pendingCount = ordersData?.data.data.items.length ?? 0;
  const hasMore = !!ordersData?.data.data.nextCursor;
  const displayCount = hasMore ? `${pendingCount}+` : `${pendingCount}`;

  const { mutate: toggleOpen } = useMutation({
    mutationFn: (open: boolean) => merchantApi.toggleShopOpen(open),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["merchant-shop"] }),
  });

  if (isError && !shop)
    return <DetailErrorScreen onRetry={() => refetch()} />;
  if (isLoading || !shop)
    return <DashboardSkeleton insets={insets} />;

  const shopName = isAr ? shop.nameAr : shop.name;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>{t("merchant.dashboard")}</Text>
          <Text style={styles.shopName} numberOfLines={1}>{shopName}</Text>
        </View>
        <View style={styles.openRow}>
          <Text style={[styles.openLabel, { color: shop.isOpen ? SEMANTIC.success : colors.textMuted }]}>
            {shop.isOpen ? t("common.open") : t("common.closed")}
          </Text>
          <Switch
            value={shop.isOpen}
            onValueChange={v => toggleOpen(v)}
            trackColor={{ true: SEMANTIC.success, false: colors.elevated }}
            thumbColor={colors.text}
          />
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + SPACING.xl }]}
      >
        {pendingCount > 0 && (
          <Pressable style={styles.alertBanner} onPress={() => router.push("/(merchant)/orders")}>
            <Bell size={20} color={SEMANTIC.warning} />
            <Text style={styles.alertText}>
              {t("merchant.pending_count_waiting", { count: pendingCount })}
            </Text>
            <CaretRight mirrored={I18nManager.isRTL} size={18} color={colors.textMuted} />
          </Pressable>
        )}

        <View style={styles.quickActions}>
          <QuickActionCard
            icon={<Package size={28} color={colors.textMuted} />}
            label={t("merchant.orders")}
            onPress={() => router.push("/(merchant)/orders")}
            styles={styles}
          />
          <QuickActionCard
            icon={<ForkKnife size={28} color={colors.textMuted} />}
            label={t("merchant.menu")}
            onPress={() => router.push("/(merchant)/menu")}
            styles={styles}
          />
          <QuickActionCard
            icon={<Storefront size={28} color={colors.textMuted} />}
            label={t("merchant.shop_profile")}
            onPress={() => router.push("/(merchant)/shop-profile")}
            styles={styles}
          />
        </View>

        <View style={styles.statsRow}>
          <StatCard label={t("merchant.status_open")} value={shop.isOpen ? t("common.open") : t("common.closed")} accent={shop.isOpen ? SEMANTIC.success : colors.textMuted} styles={styles} />
          <StatCard label={t("merchant.pending")} value={displayCount} accent={pendingCount > 0 ? SEMANTIC.warning : colors.textMuted} styles={styles} />
        </View>
      </ScrollView>
    </View>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function QuickActionCard({ icon, label, onPress, styles }: { icon: React.ReactNode; label: string; onPress: () => void; styles: any }) {
  return (
    <Pressable style={styles.quickCard} onPress={onPress}>
      {icon}
      <Text style={styles.quickLabel}>{label}</Text>
    </Pressable>
  );
}

function StatCard({ label, value, accent, styles }: { label: string; value: string; accent: string; styles: any }) {
  return (
    <View style={styles.statCard}>
      <Text style={[styles.statValue, { color: accent }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function DashboardSkeleton({ insets }: { insets: { top: number } }) {
  const colors = useAppColors();
  const styles = useStyles();
  return (
    <View style={styles.container}>
      <View style={{ height: insets.top + 80, backgroundColor: colors.card }} />
      <View style={{ padding: SPACING.base, gap: SPACING.md }}>
        <Skeleton width="100%" height={80} borderRadius={RADIUS.md} />
        <View style={{ flexDirection: "row", gap: SPACING.md }}>
          <Skeleton width="30%" height={100} borderRadius={RADIUS.md} />
          <Skeleton width="30%" height={100} borderRadius={RADIUS.md} />
          <Skeleton width="30%" height={100} borderRadius={RADIUS.md} />
        </View>
      </View>
    </View>
  );
}
