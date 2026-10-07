import type { AxiosResponse } from "axios";
import type { Report } from "@/services/api/community";
import { FlashList } from "@shopify/flash-list";
import { useInfiniteQuery } from "@tanstack/react-query";
import { ClipboardText, FilePdf } from "phosphor-react-native";
import * as React from "react";
import { useTranslation } from "react-i18next";

import { Pressable, StyleSheet, Text, View } from "react-native";
import { showMessage } from "react-native-flash-message";
import { ErrorState } from "@/components/ui/error-state";
import { ScreenHeader } from "@/components/ui/screen-header";
import { Skeleton } from "@/components/ui/skeleton";
import { useAppColors } from "@/lib/hooks/use-app-colors";
import { openDocument } from "@/lib/utils";
import { communityApi } from "@/services/api/community";
import { BRAND, FONT, RADIUS, SPACING } from "@/theme/tokens";

function useStyles() {
  const colors = useAppColors();
  const gold = "primaryText" in colors ? colors.primaryText : BRAND.gold;
  return React.useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    loadingPad: { padding: SPACING.base },
    listContent: { padding: SPACING.base, paddingBottom: SPACING.xl },
    empty: { alignItems: "center" as const, paddingTop: 80, gap: SPACING.md, paddingHorizontal: SPACING.xl },
    emptyText: { fontFamily: FONT.sans, fontSize: 15, lineHeight: 24, color: colors.textMuted, textAlign: "center" as const },
    row: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      minHeight: 72,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: RADIUS.lg,
      padding: SPACING.base,
      marginBottom: SPACING.md,
      gap: SPACING.md,
    },
    rowPressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
    rowIcon: {
      width: 44,
      height: 44,
      borderRadius: RADIUS.md,
      backgroundColor: `${BRAND.gold}1f`,
      justifyContent: "center" as const,
      alignItems: "center" as const,
    },
    rowContent: { flex: 1, gap: 2 },
    rowTitle: { fontFamily: FONT.sans, fontWeight: "600", fontSize: 14, color: colors.text, lineHeight: 22 },
    rowDate: { fontFamily: FONT.sans, fontSize: 12, lineHeight: 18, color: colors.textMuted },
    viewLabel: { fontFamily: FONT.sans, fontSize: 12, lineHeight: 18, color: gold, fontWeight: "600" },
  }), [colors, gold]);
}

export default function ReportsScreen() {
  const { t, i18n } = useTranslation();
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
    <View style={styles.container}>
      <ScreenHeader title={t("community.reports")} />

      {isError && !data
        ? <ErrorState onRetry={() => refetch()} />
        : isLoading
          ? (
              <View style={styles.loadingPad}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={`report-sk-${i}`} width="100%" height={80} borderRadius={RADIUS.lg} style={{ marginBottom: SPACING.md }} />
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
                    ? <Skeleton width="100%" height={80} borderRadius={RADIUS.lg} />
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
    <Pressable
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      onPress={() => openDocument(report.pdfUrl, () => showMessage({ message: t("community.pdf_open_failed"), type: "danger" }))}
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      <View style={styles.rowIcon}>
        <FilePdf size={24} color={styles.viewLabel.color} />
      </View>
      <View style={styles.rowContent}>
        <Text style={styles.rowTitle} numberOfLines={2}>{title}</Text>
        <Text style={styles.rowDate}>{date}</Text>
      </View>
      <Text style={styles.viewLabel}>{t("community.view_pdf")}</Text>
    </Pressable>
  );
}
