import type { FlashListRef } from "@shopify/flash-list";
import type { LayoutChangeEvent } from "react-native";
import type { FinanceAuditItem } from "@/services/api/finance";
import { FlashList } from "@shopify/flash-list";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useChartColors } from "@/components/finance/charts/use-chart-colors";
import { DashCard, SectionTitle } from "@/components/finance/dashboard/dash-ui";
import { ChecksCard, PeriodProgress, TimelineRow, UnappliedCard } from "@/components/finance/dashboard/period-sections";
import { useRefocusEffect } from "@/components/finance/use-refocus-effect";
import { ErrorState } from "@/components/ui/error-state";
import { ScreenHeader } from "@/components/ui/screen-header";
import { Skeleton } from "@/components/ui/skeleton";
import { deriveChecks, periodLabel } from "@/lib/finance-dashboard";
import { formatNumber } from "@/lib/format-number";
import { useFinanceAudit, useFinanceDashboard } from "@/services/api/finance";
import { BRAND, FONT, RADIUS, SPACING } from "@/theme/tokens";

const TIMELINE_LIMIT = 20;

type ScrollArgs = {
  section: string | undefined;
  listRef: React.RefObject<FlashListRef<FinanceAuditItem> | null>;
  /** The dashboard succeeded and the audit rows have settled (not loading, not fetching, no error). */
  ready: boolean;
};

/** Fixed deadline, from the FIRST scroll, for a growing list to pull the view back to the timeline. */
const SETTLE_MS = 1500;

/**
 * Scrolls Period close to the timeline when opened from the bell (`?section=timeline`). The latest content height
 * and timeline offset are always recorded; `tryScroll` runs when the queries settle, when the content size changes
 * and when the timeline is laid out, and scrolls once everything is known (the native list clamps a scroll to the
 * content it has laid out). Afterwards a short settling window corrects the position if the content keeps growing,
 * until the user drags or the window ends.
 */
function useScrollToTimeline({ section, listRef, ready }: ScrollArgs) {
  const pending = React.useRef(section === "timeline");
  const readyRef = React.useRef(ready);
  readyRef.current = ready;
  const timelineY = React.useRef<number | null>(null);
  const contentHeight = React.useRef(0);
  const settling = React.useRef(false);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const focused = React.useRef(true);

  const stopSettling = React.useCallback(() => {
    settling.current = false;
    if (timer.current)
      clearTimeout(timer.current);
    timer.current = null;
  }, []);

  const scrollNow = React.useCallback(() => {
    const list = listRef.current;
    const y = timelineY.current;
    if (!focused.current || !list || y === null || contentHeight.current <= 0)
      return false;
    list.scrollToOffset({ offset: y, animated: true });
    // Corrections never extend the window: the deadline is fixed at the first scroll.
    if (!settling.current) {
      settling.current = true;
      timer.current = setTimeout(stopSettling, SETTLE_MS);
    }
    return true;
  }, [listRef, stopSettling]);

  const tryScroll = React.useCallback(() => {
    if (pending.current && readyRef.current && scrollNow())
      pending.current = false;
  }, [scrollNow]);

  React.useEffect(() => {
    if (section === "timeline")
      pending.current = true;
  }, [section]);
  React.useEffect(() => {
    if (ready)
      tryScroll();
  }, [ready, tryScroll]);
  React.useEffect(() => stopSettling, [stopSettling]);
  // Blur (a route pushed on top) blocks attempts and clears the timer; a still-pending scroll resumes on refocus.
  useFocusEffect(React.useCallback(() => {
    focused.current = true;
    tryScroll();
    return () => {
      focused.current = false;
      stopSettling();
    };
  }, [tryScroll, stopSettling]));

  return {
    onContentSizeChange: (_width: number, height: number) => {
      const grew = height > contentHeight.current;
      contentHeight.current = height;
      if (pending.current)
        tryScroll();
      else if (settling.current && grew && readyRef.current)
        scrollNow();
    },
    onTimelineLayout: (event: LayoutChangeEvent) => {
      timelineY.current = event.nativeEvent.layout.y;
      tryScroll();
    },
    onUserScroll: stopSettling,
  };
}

/** Period close (sample 5 frame 4): advisory checklist, unapplied payments and the month's timeline. */
export default function FinancePeriod() {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const c = useChartColors();
  const styles = React.useMemo(() => buildStyles(c), [c]);
  // The bell opens the timeline section (`?section=timeline`); the period pill opens the top.
  const { section } = useLocalSearchParams<{ section?: string }>();
  const listRef = React.useRef<FlashListRef<FinanceAuditItem>>(null);
  const dash = useFinanceDashboard(6);
  const data = dash.data;
  // Both ends inclusive: the first day of the period up to the as-of day (spec 3.4).
  const audit = useFinanceAudit({ from: data ? `${data.period.period}-01` : undefined, to: data?.asOf }, TIMELINE_LIMIT, !!data);
  const refetchAll = () => {
    void dash.refetch();
    void audit.refetch();
  };
  useRefocusEffect(refetchAll);

  const scroll = useScrollToTimeline({ section, listRef, ready: !!data && !dash.isError && !dash.isFetching && !audit.isLoading && !audit.isFetching });

  // A failed fetch replaces the figures: TanStack keeps old `data` after a failed refetch, which must not read as current.
  if (dash.isError) {
    return (
      <View style={styles.container}>
        <ScreenHeader title={t("finance.dash.period_title")} />
        <ErrorState message={t("finance.dash.load_error")} onRetry={refetchAll} />
      </View>
    );
  }

  const checks = data ? deriveChecks(data) : [];
  const okCount = checks.filter(k => k.ok).length;
  const month = data ? periodLabel(data.period.period, i18n.language) : "";
  const pill = data
    ? <View style={styles.pill}><Text style={styles.pillText}>{t("finance.dash.period_checked", { ok: formatNumber(okCount, i18n.language), total: formatNumber(checks.length, i18n.language) })}</Text></View>
    : undefined;

  const header = data
    ? (
        <View>
          <PeriodProgress month={month} okCount={okCount} total={checks.length} />
          <ChecksCard data={data} />
          <UnappliedCard data={data} />
          <View style={styles.timelineTitle} onLayout={scroll.onTimelineLayout} testID="period-timeline-title">
            <SectionTitle title={t("finance.dash.timeline_title", { month })} />
          </View>
        </View>
      )
    : (
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" testID="period-skeleton">
          <DashCard>
            <Skeleton width="40%" height={14} />
            <Skeleton height={8} style={{ marginTop: SPACING.sm }} />
          </DashCard>
          <DashCard>
            <Skeleton height={48} />
            <Skeleton height={48} style={{ marginTop: SPACING.sm }} />
            <Skeleton height={48} style={{ marginTop: SPACING.sm }} />
          </DashCard>
        </View>
      );

  let empty = null;
  if (data) {
    if (audit.isLoading)
      empty = <Skeleton height={48} style={{ marginHorizontal: SPACING.base }} />;
    else if (audit.isError)
      empty = <Pressable style={styles.retry} onPress={() => audit.refetch()} accessibilityRole="button"><Text style={styles.retryText}>{t("common.retry")}</Text></Pressable>;
    else empty = <Text style={styles.empty}>{t("finance.dash.timeline_empty")}</Text>;
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title={t("finance.dash.period_title")} right={pill} />
      <FlashList
        ref={listRef}
        onContentSizeChange={scroll.onContentSizeChange}
        onScrollBeginDrag={scroll.onUserScroll}
        data={audit.data?.items ?? []}
        keyExtractor={item => item.id}
        ListHeaderComponent={header}
        renderItem={({ item }) => <TimelineRow item={item} />}
        ListEmptyComponent={empty}
        ListFooterComponent={audit.data?.hasMore ? <Text style={styles.empty}>{t("finance.dash.timeline_capped", { count: TIMELINE_LIMIT })}</Text> : null}
        contentContainerStyle={{ paddingBottom: insets.bottom + SPACING.xl }}
        onRefresh={refetchAll}
        refreshing={dash.isRefetching && !dash.isPlaceholderData}
      />
    </View>
  );
}

function buildStyles(c: ReturnType<typeof useChartColors>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    pill: { paddingHorizontal: SPACING.md, minHeight: 32, justifyContent: "center", borderRadius: RADIUS.full, borderWidth: 1, borderColor: c.line },
    pillText: { fontFamily: FONT.sans, fontSize: 12, color: c.tx },
    timelineTitle: { paddingHorizontal: SPACING.base, marginTop: SPACING.base },
    empty: { fontFamily: FONT.sans, fontSize: 13, lineHeight: 20, color: c.mut, textAlign: "center", paddingVertical: SPACING.base },
    retry: { minHeight: 48, alignItems: "center", justifyContent: "center" },
    retryText: { fontFamily: FONT.sans, fontWeight: "600", fontSize: 13, color: BRAND.gold },
  });
}
