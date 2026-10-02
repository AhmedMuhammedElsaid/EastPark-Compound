import type { AxiosResponse } from "axios";
import type { Announcement, AnnouncementCategory } from "@/services/api/community";
import { FlashList } from "@shopify/flash-list";
import { useInfiniteQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { ChatCircle, CheckSquare, FilePdf, MegaphoneSimple } from "phosphor-react-native";
import * as React from "react";
import { useTranslation } from "react-i18next";

import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Skeleton } from "@/components/ui/skeleton";
import { useAppColors } from "@/lib/hooks/use-app-colors";
import { useAuthGuard } from "@/lib/hooks/use-auth-guard";

import { communityApi } from "@/services/api/community";
import { BRAND, FONT, RADIUS, SEMANTIC, SPACING } from "@/theme/tokens";

type Filter = AnnouncementCategory | "ALL";

const FILTERS: { key: Filter; i18nKey: string }[] = [
  { key: "ALL", i18nKey: "directory.all_categories" },
  { key: "GENERAL", i18nKey: "community.GENERAL" },
  { key: "NEWS", i18nKey: "community.NEWS" },
  { key: "EVENT", i18nKey: "community.EVENT" },
  { key: "MAINTENANCE", i18nKey: "community.MAINTENANCE" },
  { key: "PROMOTION", i18nKey: "community.PROMOTION" },
];

const CATEGORY_COLOR: Record<string, string> = {
  NEWS: SEMANTIC.info,
  EVENT: BRAND.gold,
  MAINTENANCE: SEMANTIC.warning,
  PROMOTION: SEMANTIC.success,
};

function useStyles() {
  const colors = useAppColors();
  return React.useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    header: { paddingHorizontal: SPACING.base, paddingTop: SPACING.md, paddingBottom: SPACING.sm },
    headerTitle: { fontFamily: FONT.sans, fontWeight: "700", fontSize: 24, color: colors.text, marginBottom: SPACING.md },
    quickLinks: { flexDirection: "row" as const, gap: SPACING.sm },
    quickLink: {
      flex: 1,
      backgroundColor: colors.card,
      borderRadius: RADIUS.md,
      padding: SPACING.md,
      alignItems: "center" as const,
      gap: SPACING.xs,
    },
    quickLinkLabel: { fontFamily: FONT.sans, fontSize: 12, color: colors.textMuted, textAlign: "center" as const, fontWeight: "500" },
    chips: { paddingHorizontal: SPACING.base, paddingVertical: SPACING.sm, gap: SPACING.sm },
    chip: { height: 34, paddingHorizontal: SPACING.md, borderRadius: RADIUS.full, justifyContent: "center" as const },
    chipActive: { backgroundColor: BRAND.gold },
    chipInactive: { borderWidth: 1, borderColor: colors.border },
    chipLabel: { fontFamily: FONT.sans, fontWeight: "500", fontSize: 13 },
    chipLabelActive: { color: colors.bg },
    chipLabelInactive: { color: colors.textMuted },
    loadingPad: { padding: SPACING.base },
    listContent: { padding: SPACING.base },
    empty: { alignItems: "center" as const, paddingTop: 80, gap: SPACING.md },
    emptyTitle: { fontFamily: FONT.sans, fontSize: 16, color: colors.textMuted, fontWeight: "600" },
    card: {
      backgroundColor: colors.card,
      borderRadius: RADIUS.md,
      padding: SPACING.md,
      marginBottom: SPACING.md,
      gap: SPACING.xs,
    },
    cardPinned: { borderWidth: 1, borderColor: BRAND.gold },
    cardTop: { flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "space-between" as const, marginBottom: SPACING.xs },
    catBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.full },
    catBadgeText: { fontFamily: FONT.sans, fontWeight: "600", fontSize: 11, color: colors.text },
    pinLabel: { fontFamily: FONT.sans, fontSize: 11, color: BRAND.gold, fontWeight: "600" },
    cardTitle: { fontFamily: FONT.sans, fontWeight: "700", fontSize: 15, color: colors.text, lineHeight: 22 },
    cardBody: { fontFamily: FONT.sans, fontSize: 13, color: colors.textMuted, lineHeight: 20 },
    pdfLink: { fontFamily: FONT.sans, fontSize: 12, color: BRAND.gold, fontWeight: "600", marginTop: SPACING.xs },
  }), [colors]);
}

export default function CommunityScreen() {
  const insets = useSafeAreaInsets();
  const { requireAuthNavigation } = useAuthGuard();
  const styles = useStyles();
  const [filter, setFilter] = React.useState<Filter>("ALL");

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, isRefetching, refetch }
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
      <CommunityHeader
        onGovernance={() => router.push("/(tabs)/community/governance")}
        onReports={() => router.push("/(tabs)/community/reports")}
        onFeedback={() => requireAuthNavigation("/(tabs)/community/feedback")}
        styles={styles}
      />
      <FilterChips selected={filter} onSelect={setFilter} styles={styles} />
      <AnnouncementList
        announcements={announcements}
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
        <Pressable style={styles.quickLink} onPress={onGovernance}>
          <CheckSquare size={22} color={BRAND.gold} />
          <Text style={styles.quickLinkLabel}>{t("community.governance")}</Text>
        </Pressable>
        <Pressable style={styles.quickLink} onPress={onReports}>
          <FilePdf size={22} color={BRAND.gold} />
          <Text style={styles.quickLinkLabel}>{t("community.reports")}</Text>
        </Pressable>
        <Pressable style={styles.quickLink} onPress={onFeedback}>
          <ChatCircle size={22} color={BRAND.gold} />
          <Text style={styles.quickLinkLabel}>{t("community.feedback")}</Text>
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
      contentContainerStyle={styles.chips}
    >
      {FILTERS.map(({ key, i18nKey }) => {
        const active = selected === key;
        return (
          <Pressable
            key={key}
            onPress={() => onSelect(key)}
            style={[styles.chip, active ? styles.chipActive : styles.chipInactive]}
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
  isLoading: boolean;
  isFetchingNextPage: boolean;
  isRefetching: boolean;
  hasNextPage: boolean;
  fetchNextPage: () => void;
  refetch: () => void;
  styles: any;
};

function AnnouncementList({ announcements, isLoading, isFetchingNextPage, isRefetching, hasNextPage, fetchNextPage, refetch, styles }: ListProps) {
  const { t } = useTranslation();
  const colors = useAppColors();
  if (isLoading) {
    return (
      <View style={styles.loadingPad}>
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={`ann-sk-${i}`} width="100%" height={120} borderRadius={RADIUS.md} style={{ marginBottom: 12 }} />
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
            ? <Skeleton width="100%" height={120} borderRadius={RADIUS.md} />
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
  const catColor = CATEGORY_COLOR[announcement.category] ?? colors.elevated;

  return (
    <Pressable
      style={[styles.card, announcement.isPinned && styles.cardPinned]}
      onPress={() => router.push(`/(tabs)/community/${announcement.id}`)}
    >
      <View style={styles.cardTop}>
        <View style={[styles.catBadge, { backgroundColor: catColor }]}>
          <Text style={styles.catBadgeText}>{t(`community.${announcement.category}`)}</Text>
        </View>
        {announcement.isPinned && (
          <Text style={styles.pinLabel}>{t("community.pinned")}</Text>
        )}
      </View>
      <Text style={styles.cardTitle} numberOfLines={2}>{title}</Text>
      <Text style={styles.cardBody} numberOfLines={3}>{body}</Text>
      {announcement.pdfUrl && (
        <Pressable onPress={() => Linking.openURL(announcement.pdfUrl!)}>
          <Text style={styles.pdfLink}>{t("community.view_pdf")}</Text>
        </Pressable>
      )}
    </Pressable>
  );
}
