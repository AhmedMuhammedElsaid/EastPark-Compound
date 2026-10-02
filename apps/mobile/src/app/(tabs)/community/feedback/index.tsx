import type { AxiosResponse } from "axios";
import type { Feedback, FeedbackStatus } from "@/services/api/community";
import { FlashList } from "@shopify/flash-list";
import { useInfiniteQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { ArrowLeft, ChatCircle, Plus } from "phosphor-react-native";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Skeleton } from "@/components/ui/skeleton";
import { useAppColors } from "@/lib/hooks/use-app-colors";
import { communityApi } from "@/services/api/community";
import { useAppSelector } from "@/store";
import { BRAND, FONT, RADIUS, SEMANTIC, SPACING } from "@/theme/tokens";

const STATUS_COLOR: Record<FeedbackStatus, string> = {
  SUBMITTED: "", // will be filled at runtime with colors.elevated
  ACKNOWLEDGED: SEMANTIC.info,
  IN_PROGRESS: SEMANTIC.warning,
  RESOLVED: SEMANTIC.success,
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
    navTitle: { flex: 1, fontFamily: FONT.sans, fontWeight: "700", fontSize: 18, color: colors.text },
    newBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: BRAND.gold,
      justifyContent: "center" as const,
      alignItems: "center" as const,
    },
    loadingPad: { padding: SPACING.base },
    listContent: { padding: SPACING.base },
    row: {
      backgroundColor: colors.card,
      borderRadius: RADIUS.md,
      padding: SPACING.md,
      marginBottom: SPACING.md,
      gap: SPACING.xs,
    },
    rowTop: { flexDirection: "row" as const, gap: SPACING.sm, marginBottom: SPACING.xs },
    catBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.full },
    catBadgeText: { fontFamily: FONT.sans, fontWeight: "600", fontSize: 11, color: colors.text },
    statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.full },
    statusBadgeText: { fontFamily: FONT.sans, fontWeight: "600", fontSize: 11, color: colors.text },
    rowTitle: { fontFamily: FONT.sans, fontWeight: "600", fontSize: 14, color: colors.text },
    rowMeta: { flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "space-between" as const, marginTop: 2 },
    rowDate: { fontFamily: FONT.sans, fontSize: 12, color: colors.textMuted },
    replyBadge: { flexDirection: "row" as const, alignItems: "center" as const, gap: 3 },
    replyBadgeText: { fontFamily: FONT.sans, fontSize: 12, color: colors.textMuted },
    empty: { alignItems: "center" as const, paddingTop: 80, gap: SPACING.md, paddingHorizontal: SPACING.xl },
    emptyTitle: { fontFamily: FONT.sans, fontWeight: "700", fontSize: 16, color: colors.text, textAlign: "center" as const },
    emptyBody: { fontFamily: FONT.sans, fontSize: 14, color: colors.textMuted, textAlign: "center" as const, lineHeight: 22 },
  }), [colors]);
}

export default function FeedbackListScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const colors = useAppColors();
  const isAuthenticated = useAppSelector(s => s.auth.isAuthenticated);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, isRefetching, refetch }
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
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.nav}>
        <Pressable style={styles.backBtn} onPress={() => router.back()} hitSlop={8} accessibilityRole="button" accessibilityLabel={t("common.back")}>
          <ArrowLeft size={18} color={colors.text} />
        </Pressable>
        <Text style={styles.navTitle}>{t("feedback.title")}</Text>
        <Pressable style={styles.newBtn} onPress={() => router.push("/(tabs)/community/feedback/new")} accessibilityRole="button" accessibilityLabel={t("feedback.new")}>
          <Plus size={22} color={colors.bg} />
        </Pressable>
      </View>

      {isLoading
        ? (
            <View style={styles.loadingPad}>
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={`fb-sk-${i}`} width="100%" height={88} borderRadius={RADIUS.md} style={{ marginBottom: 12 }} />
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
                  ? <Skeleton width="100%" height={88} borderRadius={RADIUS.md} />
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
  const statusColor = feedback.status === "SUBMITTED" ? colors.elevated : (STATUS_COLOR[feedback.status] ?? colors.elevated);
  const date = new Date(feedback.createdAt).toLocaleDateString(isAr ? "ar-EG" : "en-GB", { month: "short", day: "numeric" });

  return (
    <Pressable
      style={styles.row}
      onPress={() => router.push(`/(tabs)/community/feedback/${feedback.id}`)}
      accessibilityRole="button"
      accessibilityLabel={feedback.body}
    >
      <View style={styles.rowTop}>
        <View style={[styles.catBadge, { backgroundColor: colors.elevated }]}>
          <Text style={styles.catBadgeText}>{t(`feedback.${feedback.category}`)}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
          <Text style={styles.statusBadgeText}>{t(`feedback.${feedback.status}`)}</Text>
        </View>
      </View>
      <Text style={styles.rowTitle} numberOfLines={2}>{feedback.body}</Text>
      <View style={styles.rowMeta}>
        <Text style={styles.rowDate}>{date}</Text>
        {(feedback.replies?.length ?? 0) > 0 && (
          <View style={styles.replyBadge}>
            <ChatCircle size={14} color={colors.textMuted} />
            <Text style={styles.replyBadgeText}>{feedback.replies?.length ?? 0}</Text>
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
    </View>
  );
}
