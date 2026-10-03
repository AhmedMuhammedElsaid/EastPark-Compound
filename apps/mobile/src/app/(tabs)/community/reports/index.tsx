import type { AxiosResponse } from "axios";
import type { Report } from "@/services/api/community";
import { FlashList } from "@shopify/flash-list";
import { useInfiniteQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { ArrowLeft, ClipboardText, FilePdf } from "phosphor-react-native";
import * as React from "react";
import { useTranslation } from "react-i18next";

import { I18nManager, Pressable, StyleSheet, Text, View } from "react-native";
import { showMessage } from "react-native-flash-message";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useAppColors } from "@/lib/hooks/use-app-colors";
import { openDocument } from "@/lib/utils";
import { communityApi } from "@/services/api/community";
import { BRAND, FONT, RADIUS, SPACING } from "@/theme/tokens";

function useStyles() {
  const colors = useAppColors();
  return React.useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    nav: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      paddingHorizontal: SPACING.base,
      paddingVertical: SPACING.md,
      gap: SPACING.sm,
      backgroundColor: colors.card,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    backBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.elevated,
      justifyContent: "center" as const,
      alignItems: "center" as const,
    },
    title: { fontFamily: FONT.sans, fontWeight: "700", fontSize: 18, color: colors.text },
    loadingPad: { padding: SPACING.base },
    listContent: { padding: SPACING.base },
    empty: { alignItems: "center" as const, paddingTop: 80, gap: SPACING.md },
    emptyText: { fontFamily: FONT.sans, fontSize: 15, color: colors.textMuted },
    row: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      backgroundColor: colors.card,
      borderRadius: RADIUS.md,
      padding: SPACING.md,
      marginBottom: SPACING.md,
      gap: SPACING.md,
    },
    rowIcon: {
      width: 44,
      height: 44,
      borderRadius: RADIUS.sm,
      backgroundColor: colors.elevated,
      justifyContent: "center" as const,
      alignItems: "center" as const,
    },
    rowContent: { flex: 1, gap: 4 },
    rowTitle: { fontFamily: FONT.sans, fontWeight: "600", fontSize: 14, color: colors.text, lineHeight: 20 },
    rowDate: { fontFamily: FONT.sans, fontSize: 12, color: colors.textMuted },
    viewLabel: { fontFamily: FONT.sans, fontSize: 12, color: BRAND.gold, fontWeight: "600" },
  }), [colors]);
}

export default function ReportsScreen() {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const colors = useAppColors();
  const isAr = i18n.language === "ar";

  const { data, fetchNextPage, hasNextPage, isError, isFetchingNextPage, isLoading, isRefetching, refetch }
    = useInfiniteQuery<
      AxiosResponse<{ data: { items: Report[]; nextCursor: string | null } }>,
      Error,
      { pages: AxiosResponse<{ data: { items: Report[]; nextCursor: string | null } }>[] },
      string[],
      string | undefined
    >({
      queryKey: ["reports"],
      queryFn: ({ pageParam }) => communityApi.getReports({ cursor: pageParam, limit: 20 }),
      getNextPageParam: last => last.data.data.nextCursor ?? undefined,
      initialPageParam: undefined,
    });

  const reports = data?.pages.flatMap(p => p.data.data.items).filter(Boolean) ?? [];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.nav}>
        <Pressable style={styles.backBtn} onPress={() => router.back()} hitSlop={8} accessibilityRole="button" accessibilityLabel={t("common.back")}>
          <ArrowLeft mirrored={I18nManager.isRTL} size={18} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>{t("community.reports")}</Text>
      </View>

      {isError && !data
        ? <ErrorState onRetry={() => refetch()} />
        : isLoading
          ? (
              <View style={styles.loadingPad}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={`report-sk-${i}`} width="100%" height={80} borderRadius={RADIUS.md} style={{ marginBottom: 12 }} />
                ))}
              </View>
            )
          : (
              <FlashList
                data={reports}
                keyExtractor={item => item.id}
                renderItem={({ item }) => <ReportRow report={item} isAr={isAr} styles={styles} />}
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
                    <ClipboardText size={48} color={colors.textMuted} />
                    <Text style={styles.emptyText}>{t("community.no_reports")}</Text>
                  </View>
                )}
                ListFooterComponent={
                  isFetchingNextPage
                    ? <Skeleton width="100%" height={80} borderRadius={RADIUS.md} />
                    : null
                }
              />
            )}
    </View>
  );
}

function ReportRow({ report, isAr, styles }: { report: Report; isAr: boolean; styles: any }) {
  const { t } = useTranslation();
  const title = isAr ? report.titleAr : report.title;
  const date = new Date(report.publishedAt).toLocaleDateString(isAr ? "ar-EG" : "en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <Pressable style={styles.row} onPress={() => openDocument(report.pdfUrl, () => showMessage({ message: t("community.pdf_open_failed"), type: "danger" }))} accessibilityRole="button" accessibilityLabel={title}>
      <View style={styles.rowIcon}>
        <FilePdf size={24} color={BRAND.gold} />
      </View>
      <View style={styles.rowContent}>
        <Text style={styles.rowTitle} numberOfLines={2}>{title}</Text>
        <Text style={styles.rowDate}>{date}</Text>
      </View>
      <Text style={styles.viewLabel}>{t("community.view_pdf")}</Text>
    </Pressable>
  );
}
