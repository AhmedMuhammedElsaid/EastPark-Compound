import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { ChatCircle, CheckSquare, FileText, Megaphone, Package, Storefront } from "phosphor-react-native";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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

function useStyles() {
  const colors = useAppColors();
  return React.useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    scroll: { padding: SPACING.base, gap: SPACING.lg },
    greeting: { gap: SPACING.xs },
    greetText: { fontFamily: FONT.sans, fontWeight: "700", fontSize: 26, color: colors.text },
    unitText: { fontFamily: FONT.sans, fontSize: 13, color: colors.textMuted },
    sectionHeader: { flexDirection: "row" as const, justifyContent: "space-between" as const, alignItems: "center" as const },
    sectionTitle: { fontFamily: FONT.sans, fontWeight: "700", fontSize: 18, color: colors.text },
    seeAll: { fontFamily: FONT.sans, fontSize: 13, color: BRAND.gold, fontWeight: "600" },
    quickGrid: { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: SPACING.sm },
    quickCard: {
      width: "30.5%",
      backgroundColor: colors.card,
      borderRadius: RADIUS.md,
      padding: SPACING.md,
      alignItems: "center" as const,
      gap: SPACING.xs,
      aspectRatio: 1,
      justifyContent: "center" as const,
    },
    quickLabel: { fontFamily: FONT.sans, fontSize: 11, color: colors.textMuted, textAlign: "center" as const, fontWeight: "500" },
    annList: { gap: SPACING.sm },
    annCard: {
      backgroundColor: colors.card,
      borderRadius: RADIUS.md,
      padding: SPACING.md,
      gap: SPACING.xs,
    },
    annCategory: { fontFamily: FONT.sans, fontSize: 11, color: BRAND.gold, fontWeight: "600", textTransform: "uppercase" as const },
    annTitle: { fontFamily: FONT.sans, fontWeight: "600", fontSize: 14, color: colors.text, lineHeight: 20 },
    shopsGrid: { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: SPACING.sm },
    shopCard: {
      width: "30.5%",
      backgroundColor: colors.card,
      borderRadius: RADIUS.md,
      overflow: "hidden" as const,
    },
    shopImg: { width: "100%", aspectRatio: 1 },
    shopName: { fontFamily: FONT.sans, fontWeight: "600", fontSize: 12, color: colors.text, padding: SPACING.xs },
  }), [colors]);
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

  const { data: announcementsData, isLoading: annLoading } = useQuery({
    queryKey: ["home-announcements"],
    queryFn: () => communityApi.getAnnouncements({ limit: 3 }),
  });

  const { data: shopsData, isLoading: shopsLoading } = useQuery({
    queryKey: ["home-shops"],
    queryFn: () => shopsApi.getShops({ limit: 6 }),
  });

  const announcements = announcementsData?.data.data.items ?? [];
  const shops = shopsData?.data.data.items ?? [];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + SPACING.xl }]}
      >
        {/* Greeting */}
        <View style={styles.greeting}>
          <Text style={styles.greetText}>
            {t(greetKey)}
            {user ? `, ${user.name.split(" ")[0]}` : ""}
          </Text>
          {user?.unitNumber
            ? (
                <Text style={styles.unitText}>{t("checkout.unit", { number: user.unitNumber })}</Text>
              )
            : null}
        </View>

        {/* Quick actions */}
        <Text style={styles.sectionTitle}>{t("home.quick_actions")}</Text>
        <QuickActionsGrid requireAuthNavigation={requireAuthNavigation} colors={colors} />

        {/* What's new */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t("home.whats_new")}</Text>
          <Pressable
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

        {/* Shops */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t("home.shops")}</Text>
          <Pressable
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
  { renderIcon: color => <Storefront size={28} color={color} />, labelKey: "home.shops", route: "/(tabs)/directory" },
  { renderIcon: color => <Megaphone size={28} color={color} />, labelKey: "home.community", route: "/(tabs)/community" },
  { renderIcon: color => <CheckSquare size={28} color={color} />, labelKey: "governance.title", route: "/(tabs)/community/governance", authRequired: false },
  { renderIcon: color => <Package size={28} color={color} />, labelKey: "home.my_orders", route: "/(tabs)/orders", authRequired: true },
  { renderIcon: color => <ChatCircle size={28} color={color} />, labelKey: "home.feedback", route: "/(tabs)/community/feedback", authRequired: true },
  { renderIcon: color => <FileText size={28} color={color} />, labelKey: "community.reports", route: "/(tabs)/community/reports" },
];

function QuickActionsGrid({ requireAuthNavigation, colors }: { requireAuthNavigation: (href: string) => void; colors: any }) {
  const { t } = useTranslation();
  const styles = useStyles();
  return (
    <View style={styles.quickGrid}>
      {QUICK_ACTIONS.map(action => (
        <Pressable
          key={action.route}
          style={styles.quickCard}
          accessibilityRole="button"
          accessibilityLabel={t(action.labelKey as any)}
          onPress={() => {
            if (action.authRequired)
              requireAuthNavigation(action.route);
            else router.push(action.route);
          }}
        >
          {action.renderIcon(colors.textMuted)}
          <Text style={styles.quickLabel}>{t(action.labelKey as any)}</Text>
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
            style={styles.annCard}
            accessibilityRole="button"
            accessibilityLabel={isAr ? ann.titleAr : ann.title}
            onPress={() => router.push(`/(tabs)/community/${ann.id}`)}
          >
            <Text style={styles.annCategory}>{t(`community.${ann.category}` as any)}</Text>
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
            style={styles.shopCard}
            accessibilityRole="button"
            accessibilityLabel={name}
            onPress={() => router.push(`/(tabs)/directory/${shop.id}`)}
          >
            {cover
              ? <Image source={{ uri: cover.url }} style={styles.shopImg} resizeMode="cover" accessibilityRole="image" accessibilityLabel={name} />
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
