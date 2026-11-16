import type { FlashListRef } from "@shopify/flash-list";
import type { LayoutChangeEvent } from "react-native";
import type { FinanceAuditItem } from "@/services/api/finance";
import { FlashList } from "@shopify/flash-list";
import { useLocalSearchParams } from "expo-router";
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
  timelineY: number | null;
  setTimelineY: (y: number | null) => void;
  dashError: boolean;
  /** The dashboard succeeded and the audit rows have settled (not loading, not fetching). */
  ready: boolean;
};

/**
 * Scrolls Period close to the timeline when opened from the bell (`?section=timeline`). The native list clamps a
 * scroll to the content it has laid out, so the scroll is attempted only when the dashboard succeeded, the audit
 * settled, the list is mounted, the timeline title was measured, and the list reported a content size AFTER the
 * audit settled. The pending flag survives error/remount and is cleared only once `scrollToOffset` was issued.
 */
function useScrollToTimeline({ section, listRef, timelineY, setTimelineY, dashError, ready }: ScrollArgs) {
  const scrolledTo = React.useRef(false);
  const readyRef = React.useRef(ready);
  readyRef.current = ready;
  const viewport = React.useRef(0);
  const [contentAfterSettled, setContentAfterSettled] = React.useState<number | null>(null);

  // The error state unmounts the list: a layout and content size measured before it are stale.
  React.useEffect(() => {
    if (dashError) {
      setTimelineY(null);
      setContentAfterSettled(null);
    }
  }, [dashError]);

  React.useEffect(() => {
    if (section !== "timeline" || scrolledTo.current || !ready || timelineY === null || contentAfterSettled === null)
      return;
    const list = listRef.current;
    if (!list)
      return;
    list.scrollToOffset({ offset: timelineY, animated: true });
    scrolledTo.current = true;
  }, [section, ready, timelineY, contentAfterSettled]);

  return {
    onContentSizeChange: (_width: number, height: number) => {
      if (readyRef.current)
        setContentAfterSettled(height);
    },
    onListLayout: (event: LayoutChangeEvent) => {
      viewport.current = event.nativeEvent.layout.height;
    },
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
  const [timelineY, setTimelineY] = React.useState<number | null>(null);
  const dash = useFinanceDashboard(6);
  const data = dash.data;
  // Both ends inclusive: the first day of the period up to the as-of day (spec 3.4).
  const audit = useFinanceAudit({ from: data ? `${data.period.period}-01` : undefined, to: data?.asOf }, TIMELINE_LIMIT, !!data);
  const refetchAll = () => {
    void dash.refetch();
    void audit.refetch();
  };
  useRefocusEffect(refetchAll);

  const scroll = useScrollToTimeline({ section, listRef, timelineY, setTimelineY, dashError: dash.isError, ready: !!data && !dash.isError && !dash.isFetching && !audit.isLoading && !audit.isFetching });

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
          <View style={styles.timelineTitle} onLayout={e => setTimelineY(e.nativeEvent.layout.y)} testID="period-timeline-title">
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
        onLayout={scroll.onListLayout}
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
