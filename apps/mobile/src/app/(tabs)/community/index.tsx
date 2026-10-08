import type { AxiosResponse } from "axios";
import type { Announcement, AnnouncementCategory } from "@/services/api/community";
import { FlashList } from "@shopify/flash-list";
import { useInfiniteQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { ChatCircle, CheckSquare, FilePdf, MegaphoneSimple, PushPin } from "phosphor-react-native";
import * as React from "react";
import { useTranslation } from "react-i18next";

import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { showMessage } from "react-native-flash-message";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppHeader } from "@/components/ui/app-header";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useAppColors } from "@/lib/hooks/use-app-colors";
import { useAuthGuard } from "@/lib/hooks/use-auth-guard";
import { openDocument } from "@/lib/utils";

import { communityApi } from "@/services/api/community";
import { BRAND, FONT, RADIUS, SPACING } from "@/theme/tokens";

type Filter = AnnouncementCategory | "ALL";

const FILTERS: { key: Filter; i18nKey: string }[] = [
  { key: "ALL", i18nKey: "directory.all_categories" },
  { key: "GENERAL", i18nKey: "community.GENERAL" },
  { key: "NEWS", i18nKey: "community.NEWS" },
  { key: "EVENT", i18nKey: "community.EVENT" },
  { key: "MAINTENANCE", i18nKey: "community.MAINTENANCE" },
  { key: "PROMOTION", i18nKey: "community.PROMOTION" },
];

function useStyles() {
  const colors = useAppColors();
  const gold = "primaryText" in colors ? colors.primaryText : BRAND.gold;
  return React.useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    header: { paddingHorizontal: SPACING.base, paddingTop: SPACING.base, paddingBottom: SPACING.xs },
    headerTitle: { fontFamily: FONT.sans, fontWeight: "700", fontSize: 24, lineHeight: 36, color: colors.text, marginBottom: SPACING.md },
    quickLinks: { flexDirection: "row" as const, gap: SPACING.sm },
    quickLink: {
      flex: 1,
      minHeight: 92,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: RADIUS.lg,
      paddingVertical: SPACING.md,
      paddingHorizontal: SPACING.sm,
      alignItems: "center" as const,
      // Top-aligned so the three icons share one baseline even when a label wraps.
      justifyContent: "flex-start" as const,
      gap: SPACING.xs,
    },
    quickLinkIcon: { width: 28, height: 28, alignItems: "center" as const, justifyContent: "center" as const },
    // Two lines reserved on every tile: all three tiles end up the same height.
    quickLinkLabel: { fontFamily: FONT.sans, fontSize: 12, lineHeight: 18, minHeight: 36, color: colors.text, textAlign: "center" as const, fontWeight: "600" },
    pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
    chipsScroll: { flexGrow: 0 },
    chips: { paddingHorizontal: SPACING.base, paddingVertical: SPACING.md, gap: SPACING.sm },
    chip: { minHeight: 44, paddingHorizontal: SPACING.base, borderRadius: RADIUS.full, justifyContent: "center" as const },
    chipActive: { backgroundColor: BRAND.gold },
    chipInactive: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
    chipLabel: { fontFamily: FONT.sans, fontWeight: "600", fontSize: 13, lineHeight: 20 },
    chipLabelActive: { color: BRAND.ink },
    chipLabelInactive: { color: colors.textMuted },
    loadingPad: { padding: SPACING.base },
    listContent: { paddingHorizontal: SPACING.base, paddingTop: SPACING.xs, paddingBottom: SPACING.xl },
    empty: { alignItems: "center" as const, paddingTop: 80, gap: SPACING.md, paddingHorizontal: SPACING.xl },
    emptyTitle: { fontFamily: FONT.sans, fontSize: 16, lineHeight: 24, color: colors.textMuted, fontWeight: "600", textAlign: "center" as const },
    card: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: RADIUS.lg,
      padding: SPACING.base,
      marginBottom: SPACING.md,
      gap: SPACING.sm,
    },
    cardPinned: { borderColor: BRAND.gold },
    cardTop: { flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "space-between" as const, gap: SPACING.sm },
    cardTopStart: { flexDirection: "row" as const, alignItems: "center" as const, gap: SPACING.sm, flexShrink: 1 },
    catBadge: { paddingHorizontal: SPACING.sm, paddingVertical: 3, borderRadius: RADIUS.full, backgroundColor: `${BRAND.gold}1f` },
    catBadgeText: { fontFamily: FONT.sans, fontWeight: "600", fontSize: 11, lineHeight: 18, color: gold },
    dateText: { fontFamily: FONT.sans, fontSize: 12, lineHeight: 18, color: colors.textMuted },
    pinWrap: { flexDirection: "row" as const, alignItems: "center" as const, gap: 4 },
    pinLabel: { fontFamily: FONT.sans, fontSize: 11, lineHeight: 18, color: gold, fontWeight: "600" },
    cardTitle: { fontFamily: FONT.sans, fontWeight: "700", fontSize: 16, color: colors.text, lineHeight: 26 },
    cardBody: { fontFamily: FONT.sans, fontSize: 13, color: colors.textMuted, lineHeight: 22 },
    pdfLink: { flexDirection: "row" as const, alignItems: "center" as const, gap: SPACING.xs, minHeight: 44, alignSelf: "flex-start" as const },
    pdfLinkText: { fontFamily: FONT.sans, fontSize: 13, lineHeight: 20, color: gold, fontWeight: "600" },
  }), [colors, gold]);
}

export default function CommunityScreen() {
  const insets = useSafeAreaInsets();
  const { requireAuthNavigation } = useAuthGuard();
  const styles = useStyles();
  const [filter, setFilter] = React.useState<Filter>("ALL");

  const { data, fetchNextPage, hasNextPage, isError, isFetchingNextPage, isLoading, isRefetching, refetch }
    = useInfiniteQuery<
      AxiosResponse<{ data: { items: Announcement[]; nextCursor: string | null } }>,
      Error,
      { pages: AxiosResponse<{ data: { items: Announcement[]; nextCursor: string | null } }>[] },
      string[],
      string | undefined
    >({
      queryKey: ["announcements", filter],
      queryFn: ({ pageParam }) =>
        communityApi.getAnnouncements({
          cursor: pageParam,
          limit: 15,
          category: filter === "ALL" ? undefined : filter,
        }),
      getNextPageParam: last => last.data.data.nextCursor ?? undefined,
      initialPageParam: undefined,
    });

  const announcements = data?.pages.flatMap(p => p.data.data.items).filter(Boolean) ?? [];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <AppHeader />
      <CommunityHeader
        onGovernance={() => router.push("/(tabs)/community/governance")}
        onReports={() => router.push("/(tabs)/community/reports")}
        onFeedback={() => requireAuthNavigation("/(tabs)/community/feedback")}
        styles={styles}
      />
      <FilterChips selected={filter} onSelect={setFilter} styles={styles} />
      <AnnouncementList
        announcements={announcements}
        isError={isError && !data}
        isLoading={isLoading}
        isFetchingNextPage={isFetchingNextPage}
        isRefetching={isRefetching}
        hasNextPage={hasNextPage}
        fetchNextPage={fetchNextPage}
        refetch={refetch}
        styles={styles}
      />
    </View>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function CommunityHeader({
  onGovernance,
  onReports,
  onFeedback,
  styles,
}: {
  onGovernance: () => void;
  onReports: () => void;
  onFeedback: () => void;
  styles: any;
}) {
  const { t } = useTranslation();
  return (
    <View style={styles.header}>
      <Text style={styles.headerTitle}>{t("community.title")}</Text>
      <View style={styles.quickLinks}>
        <Pressable style={({ pressed }) => [styles.quickLink, pressed && styles.pressed]} onPress={onGovernance} accessibilityRole="button">
          <View style={styles.quickLinkIcon}><CheckSquare size={24} color={BRAND.gold} /></View>
          <Text style={styles.quickLinkLabel} numberOfLines={2}>{t("community.governance")}</Text>
        </Pressable>
        <Pressable style={({ pressed }) => [styles.quickLink, pressed && styles.pressed]} onPress={onReports} accessibilityRole="button">
          <View style={styles.quickLinkIcon}><FilePdf size={24} color={BRAND.gold} /></View>
          <Text style={styles.quickLinkLabel} numberOfLines={2}>{t("community.reports")}</Text>
        </Pressable>
        <Pressable style={({ pressed }) => [styles.quickLink, pressed && styles.pressed]} onPress={onFeedback} accessibilityRole="button">
          <View style={styles.quickLinkIcon}><ChatCircle size={24} color={BRAND.gold} /></View>
          {/* Same name as the screen it opens ("شكاواي" / "My Feedback"); fits one line like the other tiles. */}
          <Text style={styles.quickLinkLabel} numberOfLines={2}>{t("feedback.title")}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function FilterChips({ selected, onSelect, styles }: { selected: Filter; onSelect: (f: Filter) => void; styles: any }) {
  const { t } = useTranslation();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.chipsScroll}
      contentContainerStyle={styles.chips}
    >
      {FILTERS.map(({ key, i18nKey }) => {
        const active = selected === key;
        return (
          <Pressable
            key={key}
            onPress={() => onSelect(key)}
            style={[styles.chip, active ? styles.chipActive : styles.chipInactive]}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.chipLabel, active ? styles.chipLabelActive : styles.chipLabelInactive]}>
              {t(i18nKey)}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

type ListProps = {
  announcements: Announcement[];
  /** Failed before any page arrived. */
  isError: boolean;
  isLoading: boolean;
  isFetchingNextPage: boolean;
  isRefetching: boolean;
  hasNextPage: boolean;
  fetchNextPage: () => void;
  refetch: () => void;
  styles: any;
};

function AnnouncementList({ announcements, isError, isLoading, isFetchingNextPage, isRefetching, hasNextPage, fetchNextPage, refetch, styles }: ListProps) {
  const { t } = useTranslation();
  const colors = useAppColors();
  if (isError)
    return <ErrorState onRetry={refetch} />;
  if (isLoading) {
    return (
      <View style={styles.loadingPad}>
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={`ann-sk-${i}`} width="100%" height={120} borderRadius={RADIUS.lg} style={{ marginBottom: 12 }} />
        ))}
      </View>
    );
  }
  return (
    <View style={{ flex: 1 }}>
      <FlashList
        data={announcements}
        keyExtractor={item => item.id}
        renderItem={({ item }) => <AnnouncementCard announcement={item} styles={styles} colors={colors} />}
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage)
            fetchNextPage();
        }}
        onEndReachedThreshold={0.5}
        contentContainerStyle={styles.listContent}
        onRefresh={refetch}
        refreshing={isRefetching}
        ListEmptyComponent={(
          <View style={styles.empty}>
            <MegaphoneSimple size={48} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>{t("community.no_announcements")}</Text>
          </View>
        )}
        ListFooterComponent={
          isFetchingNextPage
            ? <Skeleton width="100%" height={120} borderRadius={RADIUS.lg} />
            : null
        }
      />
    </View>
  );
}

function AnnouncementCard({ announcement, styles, colors }: { announcement: Announcement; styles: any; colors: any }) {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === "ar";
  const title = isAr ? announcement.titleAr : announcement.title;
  const body = isAr ? announcement.bodyAr : announcement.body;
  const gold = "primaryText" in colors ? colors.primaryText : BRAND.gold;
  const date = new Date(announcement.publishedAt ?? announcement.createdAt).toLocaleDateString(isAr ? "ar-EG" : "en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <Pressable
      style={({ pressed }) => [styles.card, announcement.isPinned && styles.cardPinned, pressed && styles.pressed]}
      onPress={() => router.push(`/(tabs)/community/${announcement.id}`)}
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      <View style={styles.cardTop}>
        <View style={styles.cardTopStart}>
          <View style={styles.catBadge}>
            <Text style={styles.catBadgeText}>{t(`community.${announcement.category}`)}</Text>
          </View>
          <Text style={styles.dateText} numberOfLines={1}>{date}</Text>
        </View>
        {announcement.isPinned && (
          <View style={styles.pinWrap}>
            <PushPin size={14} weight="fill" color={gold} />
            <Text style={styles.pinLabel}>{t("community.pinned")}</Text>
          </View>
        )}
      </View>
      <Text style={styles.cardTitle} numberOfLines={2}>{title}</Text>
      <Text style={styles.cardBody} numberOfLines={3}>{body}</Text>
      {announcement.pdfUrl && (
        <Pressable
          style={styles.pdfLink}
          onPress={() => openDocument(announcement.pdfUrl!, () => showMessage({ message: t("community.pdf_open_failed"), type: "danger" }))}
          accessibilityRole="button"
        >
          <FilePdf size={18} color={gold} />
          <Text style={styles.pdfLinkText}>{t("community.view_pdf")}</Text>
        </Pressable>
      )}
    </Pressable>
  );
}
