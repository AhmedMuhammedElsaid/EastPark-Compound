import type { AxiosResponse } from "axios";
import type { Feedback, FeedbackStatus } from "@/services/api/community";
import { FlashList } from "@shopify/flash-list";
import { useInfiniteQuery } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { ChatCircle, Plus } from "phosphor-react-native";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { ErrorState } from "@/components/ui/error-state";
import { ScreenHeader } from "@/components/ui/screen-header";
import { Skeleton } from "@/components/ui/skeleton";
import { useAppColors } from "@/lib/hooks/use-app-colors";
import { communityApi } from "@/services/api/community";
import { useAppSelector } from "@/store";
import { BRAND, FONT, RADIUS, SEMANTIC, SPACING } from "@/theme/tokens";

// Status chips: tinted fill + same-hue text, never solid white-on-color on dark cards.
const STATUS_COLOR: Record<FeedbackStatus, string> = {
  SUBMITTED: BRAND.gold,
  ACKNOWLEDGED: SEMANTIC.info,
  IN_PROGRESS: SEMANTIC.warning,
  RESOLVED: SEMANTIC.success,
};

function useStyles() {
  const colors = useAppColors();
  const gold = "primaryText" in colors ? colors.primaryText : BRAND.gold;
  return React.useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    newBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: BRAND.gold,
      justifyContent: "center" as const,
      alignItems: "center" as const,
    },
    loadingPad: { padding: SPACING.base },
    listContent: { padding: SPACING.base, paddingBottom: SPACING.xl },
    row: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: RADIUS.lg,
      padding: SPACING.base,
      marginBottom: SPACING.md,
      gap: SPACING.sm,
    },
    rowPressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
    rowTop: { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: SPACING.sm },
    catBadge: { paddingHorizontal: SPACING.sm, paddingVertical: 3, borderRadius: RADIUS.full, backgroundColor: colors.elevated },
    catBadgeText: { fontFamily: FONT.sans, fontWeight: "600", fontSize: 11, lineHeight: 18, color: colors.text },
    statusBadge: { paddingHorizontal: SPACING.sm, paddingVertical: 3, borderRadius: RADIUS.full },
    statusBadgeText: { fontFamily: FONT.sans, fontWeight: "600", fontSize: 11, lineHeight: 18 },
    rowTitle: { fontFamily: FONT.sans, fontWeight: "600", fontSize: 14, lineHeight: 22, color: colors.text },
    rowMeta: { flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "space-between" as const },
    rowDate: { fontFamily: FONT.sans, fontSize: 12, lineHeight: 18, color: colors.textMuted },
    replyBadge: { flexDirection: "row" as const, alignItems: "center" as const, gap: 4 },
    replyBadgeText: { fontFamily: FONT.sans, fontSize: 12, lineHeight: 18, color: colors.textMuted },
    empty: { alignItems: "center" as const, paddingTop: 80, gap: SPACING.md, paddingHorizontal: SPACING.xl },
    emptyTitle: { fontFamily: FONT.sans, fontWeight: "700", fontSize: 16, lineHeight: 24, color: colors.text, textAlign: "center" as const },
    emptyBody: { fontFamily: FONT.sans, fontSize: 14, color: colors.textMuted, textAlign: "center" as const, lineHeight: 22 },
    emptyCta: {
      minHeight: 48,
      paddingHorizontal: SPACING.xl,
      borderRadius: RADIUS.md,
      backgroundColor: BRAND.gold,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      flexDirection: "row" as const,
      gap: SPACING.sm,
      marginTop: SPACING.sm,
    },
    emptyCtaText: { fontFamily: FONT.sans, fontWeight: "700", fontSize: 15, lineHeight: 24, color: BRAND.ink },
  }), [colors, gold]);
}

export default function FeedbackListScreen() {
  const { t } = useTranslation();
  const styles = useStyles();
  const colors = useAppColors();
  const isAuthenticated = useAppSelector(s => s.auth.isAuthenticated);

  const { data, fetchNextPage, hasNextPage, isError, isFetchingNextPage, isLoading, isRefetching, refetch }
    = useInfiniteQuery<
      AxiosResponse<{ data: { items: Feedback[]; nextCursor: string | null } }>,
      Error,
      { pages: AxiosResponse<{ data: { items: Feedback[]; nextCursor: string | null } }>[] },
      string[],
      string | undefined
    >({
      queryKey: ["my-feedback"],
      queryFn: ({ pageParam }) => communityApi.getFeedback({ cursor: pageParam, limit: 20 }),
      getNextPageParam: last => last.data.data.nextCursor ?? undefined,
      initialPageParam: undefined,
      enabled: isAuthenticated,
    });

  const items = data?.pages.flatMap(p => p.data.data.items).filter(Boolean) ?? [];

  return (
    <View style={styles.container}>
      <ScreenHeader
        title={t("feedback.title")}
        right={(
          <Pressable
            style={({ pressed }) => [styles.newBtn, pressed && styles.rowPressed]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push("/(tabs)/community/feedback/new");
            }}
            accessibilityRole="button"
            accessibilityLabel={t("feedback.new")}
          >
            <Plus size={22} color={BRAND.ink} />
          </Pressable>
        )}
      />

      {isError && !data
        ? <ErrorState onRetry={() => refetch()} />
        : isLoading
          ? (
              <View style={styles.loadingPad}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={`fb-sk-${i}`} width="100%" height={88} borderRadius={RADIUS.lg} style={{ marginBottom: SPACING.md }} />
                ))}
              </View>
            )
          : (
              <FlashList
                data={items}
                keyExtractor={item => item.id}
                renderItem={({ item }) => <FeedbackRow feedback={item} styles={styles} colors={colors} />}
                onEndReached={() => {
                  if (hasNextPage && !isFetchingNextPage)
                    fetchNextPage();
                }}
                onEndReachedThreshold={0.5}
                contentContainerStyle={styles.listContent}
                onRefresh={refetch}
                refreshing={isRefetching}
                ListEmptyComponent={<FeedbackEmpty styles={styles} colors={colors} />}
                ListFooterComponent={
                  isFetchingNextPage
                    ? <Skeleton width="100%" height={88} borderRadius={RADIUS.lg} />
                    : null
                }
              />
            )}
    </View>
  );
}

function FeedbackRow({ feedback, styles, colors }: { feedback: Feedback; styles: any; colors: any }) {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === "ar";
  const locale = isAr ? "ar-EG" : "en-GB";
  const tint = STATUS_COLOR[feedback.status] ?? BRAND.gold;
  const statusText = feedback.status === "SUBMITTED"
    ? ("primaryText" in colors ? colors.primaryText : BRAND.gold)
    : colors.text;
  const date = new Date(feedback.createdAt).toLocaleDateString(locale, { month: "short", day: "numeric" });
  const replies = feedback.replies?.length ?? 0;

  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      onPress={() => router.push(`/(tabs)/community/feedback/${feedback.id}`)}
      accessibilityRole="button"
      accessibilityLabel={feedback.body}
    >
      <View style={styles.rowTop}>
        <View style={styles.catBadge}>
          <Text style={styles.catBadgeText}>{t(`feedback.${feedback.category}`)}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: `${tint}33` }]}>
          <Text style={[styles.statusBadgeText, { color: statusText }]}>{t(`feedback.${feedback.status}`)}</Text>
        </View>
      </View>
      <Text style={styles.rowTitle} numberOfLines={2}>{feedback.body}</Text>
      <View style={styles.rowMeta}>
        <Text style={styles.rowDate}>{date}</Text>
        {replies > 0 && (
          <View style={styles.replyBadge}>
            <ChatCircle size={14} color={colors.textMuted} />
            <Text style={styles.replyBadgeText}>{replies.toLocaleString(locale)}</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

function FeedbackEmpty({ styles, colors }: { styles: any; colors: any }) {
  const { t } = useTranslation();
  return (
    <View style={styles.empty}>
      <ChatCircle size={48} color={colors.textMuted} />
      <Text style={styles.emptyTitle}>{t("feedback.empty")}</Text>
      <Text style={styles.emptyBody}>{t("feedback.empty_subtitle")}</Text>
      <Pressable
        style={({ pressed }) => [styles.emptyCta, pressed && styles.rowPressed]}
        onPress={() => router.push("/(tabs)/community/feedback/new")}
        accessibilityRole="button"
      >
        <Plus size={20} color={BRAND.ink} />
        <Text style={styles.emptyCtaText}>{t("feedback.new")}</Text>
      </Pressable>
    </View>
  );
}
