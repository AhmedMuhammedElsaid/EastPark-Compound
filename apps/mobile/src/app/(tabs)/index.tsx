import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { router } from "expo-router";
import { ChatCircle, CheckSquare, FileText, Megaphone, Package, Storefront } from "phosphor-react-native";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppHeader } from "@/components/ui/app-header";
import { Skeleton } from "@/components/ui/skeleton";
import { useAppColors } from "@/lib/hooks/use-app-colors";
import { useAuthGuard } from "@/lib/hooks/use-auth-guard";
import { communityApi } from "@/services/api/community";
import { shopsApi } from "@/services/api/shops";
import { useAppSelector } from "@/store";
import { BRAND, FONT, RADIUS, SPACING } from "@/theme/tokens";

function greeting(h: number): string {
  if (h < 12)
    return "home.greeting_morning";
  if (h < 18)
    return "home.greeting_afternoon";
  return "home.greeting_evening";
}

const GRID_GAP = SPACING.sm;

/** Three equal columns from the window width — percentage widths left the spare space on one side. */
function useTileSize() {
  const { width } = useWindowDimensions();
  return Math.floor((width - SPACING.base * 2 - GRID_GAP * 2) / 3);
}

function useStyles() {
  const colors = useAppColors();
  const tile = useTileSize();
  // gold-500 fails AA on the light background; LIGHT.primaryText is gold-700.
  const gold = "primaryText" in colors ? colors.primaryText : BRAND.gold;
  return React.useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    scroll: { padding: SPACING.base, gap: SPACING.lg },
    greeting: { gap: SPACING.xs },
    greetText: { fontFamily: FONT.sans, fontWeight: "700", fontSize: 24, lineHeight: 36, color: colors.text },
    unitText: { fontFamily: FONT.sans, fontSize: 13, color: colors.textMuted },
    sectionHeader: { flexDirection: "row" as const, justifyContent: "space-between" as const, alignItems: "center" as const },
    section: { gap: SPACING.md },
    sectionTitle: { fontFamily: FONT.sans, fontWeight: "700", fontSize: 17, color: colors.text },
    seeAllBtn: { minHeight: 44, justifyContent: "center" as const, paddingHorizontal: SPACING.xs },
    seeAll: { fontFamily: FONT.sans, fontSize: 13, color: gold, fontWeight: "600" },
    quickGrid: { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: GRID_GAP },
    quickCard: {
      width: tile,
      height: Math.round(tile * 0.82),
      backgroundColor: colors.card,
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: SPACING.sm,
      alignItems: "center" as const,
      gap: SPACING.sm,
      justifyContent: "center" as const,
    },
    quickIcon: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: `${BRAND.gold}1f`,
      alignItems: "center" as const,
      justifyContent: "center" as const,
    },
    quickLabel: { fontFamily: FONT.sans, fontSize: 12, lineHeight: 18, color: colors.text, textAlign: "center" as const, fontWeight: "500" },
    pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
    annList: { gap: SPACING.sm },
    annCard: {
      backgroundColor: colors.card,
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: SPACING.base,
      gap: SPACING.xs,
    },
    annMeta: { flexDirection: "row" as const, alignItems: "center" as const, gap: SPACING.sm },
    annCategory: { fontFamily: FONT.sans, fontSize: 12, color: gold, fontWeight: "600" },
    annDate: { fontFamily: FONT.sans, fontSize: 12, color: colors.textMuted },
    annTitle: { fontFamily: FONT.sans, fontWeight: "600", fontSize: 15, color: colors.text, lineHeight: 24 },
    shopsGrid: { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: GRID_GAP },
    shopCard: {
      width: tile,
      backgroundColor: colors.card,
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: "hidden" as const,
    },
    shopImg: { width: "100%", height: tile },
    shopName: { fontFamily: FONT.sans, fontWeight: "600", fontSize: 12, lineHeight: 18, color: colors.text, paddingHorizontal: SPACING.sm, paddingVertical: SPACING.sm },
  }), [colors, tile, gold]);
}

export default function HomeScreen() {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const user = useAppSelector(s => s.auth.user);
  const { requireAuthNavigation } = useAuthGuard();
  const colors = useAppColors();
  const styles = useStyles();
  const isAr = i18n.language === "ar";

  const greetKey = greeting(new Date().getHours());

  const { data: announcementsData, isLoading: annLoading, refetch: refetchAnnouncements } = useQuery({
    queryKey: ["home-announcements"],
    queryFn: () => communityApi.getAnnouncements({ limit: 3 }),
  });

  const { data: shopsData, isLoading: shopsLoading, refetch: refetchShops } = useQuery({
    queryKey: ["home-shops"],
    queryFn: () => shopsApi.getShops({ limit: 6 }),
  });

  const [refreshing, setRefreshing] = React.useState(false);
  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchAnnouncements(), refetchShops()]);
    setRefreshing(false);
  }, [refetchAnnouncements, refetchShops]);

  const announcements = announcementsData?.data.data.items ?? [];
  const shops = shopsData?.data.data.items ?? [];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <AppHeader />
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={BRAND.gold} />}
        contentContainerStyle={[styles.scroll, { paddingBottom: SPACING["2xl"] }]}
      >
        {/* Greeting */}
        <View style={styles.greeting}>
          <Text style={styles.greetText}>
            {user
              ? t("home.greeting_named", { greeting: t(greetKey), name: user.name.split(" ")[0] })
              : t(greetKey)}
          </Text>
          {user?.unitNumber
            ? (
                <Text style={styles.unitText}>{t("checkout.unit", { number: user.unitNumber })}</Text>
              )
            : null}
        </View>

        {/* Quick actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("home.quick_actions")}</Text>
          <QuickActionsGrid requireAuthNavigation={requireAuthNavigation} colors={colors} />
        </View>

        {/* What's new */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t("home.whats_new")}</Text>
            <Pressable
              style={styles.seeAllBtn}
              onPress={() => router.push("/(tabs)/community")}
              accessibilityRole="button"
              accessibilityLabel={t("common.see_all")}
            >
              <Text style={styles.seeAll}>{t("common.see_all")}</Text>
            </Pressable>
          </View>
          {annLoading
            ? <HomeSectionSkeleton />
            : <AnnouncementsPreview announcements={announcements} isAr={isAr} />}
        </View>

        {/* Shops */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t("home.shops")}</Text>
            <Pressable
              style={styles.seeAllBtn}
              onPress={() => router.push("/(tabs)/directory")}
              accessibilityRole="button"
              accessibilityLabel={t("common.see_all")}
            >
              <Text style={styles.seeAll}>{t("common.see_all")}</Text>
            </Pressable>
          </View>
          {shopsLoading
            ? <HomeSectionSkeleton />
            : <ShopsGrid shops={shops} isAr={isAr} />}
        </View>
      </ScrollView>
    </View>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const QUICK_ACTIONS: Array<{
  renderIcon: (color: string) => ReactNode;
  labelKey: string;
  route: string;
  authRequired?: boolean;
}> = [
  { renderIcon: color => <Storefront size={24} color={color} />, labelKey: "home.shops", route: "/(tabs)/directory" },
  { renderIcon: color => <Megaphone size={24} color={color} />, labelKey: "home.community", route: "/(tabs)/community" },
  { renderIcon: color => <CheckSquare size={24} color={color} />, labelKey: "governance.title", route: "/(tabs)/community/governance", authRequired: false },
  { renderIcon: color => <Package size={24} color={color} />, labelKey: "home.my_orders", route: "/(tabs)/orders", authRequired: true },
  { renderIcon: color => <ChatCircle size={24} color={color} />, labelKey: "home.feedback", route: "/(tabs)/community/feedback", authRequired: true },
  { renderIcon: color => <FileText size={24} color={color} />, labelKey: "community.reports", route: "/(tabs)/community/reports" },
];

function QuickActionsGrid({ requireAuthNavigation, colors }: { requireAuthNavigation: (href: string) => void; colors: any }) {
  const { t } = useTranslation();
  const styles = useStyles();
  return (
    <View style={styles.quickGrid}>
      {QUICK_ACTIONS.map(action => (
        <Pressable
          key={action.route}
          style={({ pressed }) => [styles.quickCard, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={t(action.labelKey as any)}
          onPress={() => {
            if (action.authRequired)
              requireAuthNavigation(action.route);
            else router.push(action.route);
          }}
        >
          <View style={styles.quickIcon}>
            {action.renderIcon("primaryText" in colors ? colors.primaryText : BRAND.gold)}
          </View>
          <Text style={styles.quickLabel} numberOfLines={2}>{t(action.labelKey as any)}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function AnnouncementsPreview({ announcements, isAr }: { announcements: any[]; isAr: boolean }) {
  const { t } = useTranslation();
  const styles = useStyles();
  if (!announcements.length)
    return null;
  return (
    <View style={styles.annList}>
      {announcements.map((ann) => {
        const title = isAr ? ann.titleAr : ann.title;
        return (
          <Pressable
            key={ann.id}
            style={({ pressed }) => [styles.annCard, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={isAr ? ann.titleAr : ann.title}
            onPress={() => router.push(`/(tabs)/community/${ann.id}`)}
          >
            <View style={styles.annMeta}>
              <Text style={styles.annCategory}>{t(`community.${ann.category}` as any)}</Text>
              {ann.createdAt
                ? (
                    <Text style={styles.annDate}>
                      {new Date(ann.createdAt).toLocaleDateString(isAr ? "ar-EG" : "en-GB", { day: "numeric", month: "short" })}
                    </Text>
                  )
                : null}
            </View>
            <Text style={styles.annTitle} numberOfLines={2}>{title}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function ShopsGrid({ shops, isAr }: { shops: any[]; isAr: boolean }) {
  const styles = useStyles();
  const colors = useAppColors();
  if (!shops.length)
    return null;
  return (
    <View style={styles.shopsGrid}>
      {shops.map((shop) => {
        const name = isAr ? shop.nameAr : shop.name;
        const cover = shop.photos?.find((p: any) => p.isPrimary) ?? shop.photos?.[0];
        return (
          <Pressable
            key={shop.id}
            style={({ pressed }) => [styles.shopCard, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={name}
            onPress={() => router.push(`/(tabs)/directory/${shop.id}`)}
          >
            {cover
              ? <Image source={{ uri: cover.url }} style={styles.shopImg} contentFit="cover" accessibilityLabel={name} />
              : <View style={[styles.shopImg, { backgroundColor: colors.elevated }]} />}
            <Text style={styles.shopName} numberOfLines={1}>{name}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function HomeSectionSkeleton() {
  return (
    <View style={{ flexDirection: "row", gap: SPACING.sm }}>
      <Skeleton width="48%" height={80} borderRadius={RADIUS.md} />
      <Skeleton width="48%" height={80} borderRadius={RADIUS.md} />
    </View>
  );
}
