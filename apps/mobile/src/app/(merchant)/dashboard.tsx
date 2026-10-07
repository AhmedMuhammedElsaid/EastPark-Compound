import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { Bell, CaretRight, ForkKnife, Package, Storefront } from "phosphor-react-native";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { I18nManager, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { DetailErrorScreen } from "@/components/ui/error-state";
import { ScreenHeader } from "@/components/ui/screen-header";
import { Skeleton } from "@/components/ui/skeleton";
import { useAppColors } from "@/lib/hooks/use-app-colors";
import { merchantApi } from "@/services/api/merchant";
import { BRAND, FONT, RADIUS, SEMANTIC, SPACING } from "@/theme/tokens";

function useStyles() {
  const colors = useAppColors();
  return React.useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    openRow: { flexDirection: "row" as const, alignItems: "center" as const, gap: SPACING.sm },
    openLabel: { fontFamily: FONT.sans, fontWeight: "600", fontSize: 13, lineHeight: 20 },
    scroll: { padding: SPACING.base, gap: SPACING.md },
    alertBanner: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      backgroundColor: `${SEMANTIC.warning}22`,
      borderRadius: RADIUS.lg,
      minHeight: 52,
      padding: SPACING.md,
      borderWidth: 1,
      borderColor: SEMANTIC.warning,
      gap: SPACING.sm,
    },
    alertText: { flex: 1, fontFamily: FONT.sans, fontWeight: "600", fontSize: 14, lineHeight: 22, color: colors.text },
    quickActions: { flexDirection: "row" as const, gap: SPACING.md },
    quickCard: {
      flex: 1,
      minHeight: 104,
      backgroundColor: colors.card,
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: SPACING.md,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      gap: SPACING.sm,
    },
    quickIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: `${BRAND.gold}1f`, alignItems: "center" as const, justifyContent: "center" as const },
    quickLabel: { fontFamily: FONT.sans, fontSize: 12, lineHeight: 18, color: colors.text, textAlign: "center" as const, fontWeight: "600" },
    pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
    statsRow: { flexDirection: "row" as const, gap: SPACING.md },
    statCard: {
      flex: 1,
      backgroundColor: colors.card,
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: SPACING.base,
      alignItems: "center" as const,
      gap: SPACING.xs,
    },
    statValue: { fontFamily: FONT.sans, fontWeight: "700", fontSize: 22, lineHeight: 34 },
    statLabel: { fontFamily: FONT.sans, fontSize: 12, lineHeight: 18, color: colors.textMuted },
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
    <View style={styles.container}>
      <ScreenHeader
        title={shopName}
        right={(
          <View style={styles.openRow}>
            <Text style={[styles.openLabel, { color: shop.isOpen ? colors.text : colors.textMuted }]}>
              {shop.isOpen ? t("common.open") : t("common.closed")}
            </Text>
            <Switch
              value={shop.isOpen}
              onValueChange={v => toggleOpen(v)}
              trackColor={{ true: SEMANTIC.success, false: colors.elevated }}
              thumbColor={colors.text}
              accessibilityLabel={t("merchant.status_open")}
            />
          </View>
        )}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + SPACING.xl }]}
      >
        {pendingCount > 0 && (
          <Pressable style={({ pressed }) => [styles.alertBanner, pressed && styles.pressed]} onPress={() => router.push("/(merchant)/orders")} accessibilityRole="button">
            <Bell size={20} color={SEMANTIC.warning} weight="fill" />
            <Text style={styles.alertText}>
              {t("merchant.pending_count_waiting", { count: pendingCount })}
            </Text>
            <CaretRight mirrored={I18nManager.isRTL} size={18} color={colors.textMuted} />
          </Pressable>
        )}

        <View style={styles.quickActions}>
          <QuickActionCard
            icon={<Package size={24} color={"primaryText" in colors ? colors.primaryText : BRAND.gold} />}
            label={t("merchant.orders")}
            onPress={() => router.push("/(merchant)/orders")}
            styles={styles}
          />
          <QuickActionCard
            icon={<ForkKnife size={24} color={"primaryText" in colors ? colors.primaryText : BRAND.gold} />}
            label={t("merchant.menu")}
            onPress={() => router.push("/(merchant)/menu")}
            styles={styles}
          />
          <QuickActionCard
            icon={<Storefront size={24} color={"primaryText" in colors ? colors.primaryText : BRAND.gold} />}
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
    <Pressable style={({ pressed }) => [styles.quickCard, pressed && styles.pressed]} onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>
      <View style={styles.quickIcon}>{icon}</View>
      <Text style={styles.quickLabel} numberOfLines={2}>{label}</Text>
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
      <View style={{ height: insets.top + 60, backgroundColor: colors.bg, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }} />
      <View style={{ padding: SPACING.base, gap: SPACING.md }}>
        <Skeleton width="100%" height={80} borderRadius={RADIUS.md} />
        <View style={{ flexDirection: "row", gap: SPACING.md }}>
          <Skeleton width="30%" height={104} borderRadius={RADIUS.lg} />
          <Skeleton width="30%" height={104} borderRadius={RADIUS.lg} />
          <Skeleton width="30%" height={104} borderRadius={RADIUS.lg} />
        </View>
      </View>
    </View>
  );
}
