import type { Href } from "expo-router";
import type { CompoundMapHandle } from "@/components/finance/charts/compound-map";
import { FlashList } from "@shopify/flash-list";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { Plus } from "phosphor-react-native";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BuildingSheet } from "@/components/finance/charts/building-sheet";
import { useChartColors } from "@/components/finance/charts/use-chart-colors";
import { DashCharts, FinanceHomeHeader } from "@/components/finance/dashboard/dash-charts";
import { AttentionCard, DashHero, KpiCarousel, TopOwingRow } from "@/components/finance/dashboard/dash-sections";
import { DashboardSkeleton, SectionTitle } from "@/components/finance/dashboard/dash-ui";
import { useRefocusEffect } from "@/components/finance/use-refocus-effect";
import { ErrorState } from "@/components/ui/error-state";
import { flatsHref } from "@/lib/finance-dashboard";
import { useFinanceDashboard, useFinanceFlats } from "@/services/api/finance";
import { BRAND, FONT, RADIUS, SPACING } from "@/theme/tokens";

function go(href: string) {
  Haptics.selectionAsync();
  router.push(href as Href);
}

/** Record payment shortcut; also shown in the error state so the desk stays usable when the dashboard cannot load. */
function RecordPaymentFab() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const c = useChartColors();
  const styles = React.useMemo(() => buildStyles(c), [c]);
  return (
    <Pressable
      style={({ pressed }) => [styles.fab, { bottom: insets.bottom + SPACING.base }, pressed && styles.pressed]}
      onPress={() => go("/finance/payment/new")}
      accessibilityRole="button"
      accessibilityLabel={t("finance.record_payment")}
      testID="fab"
    >
      <Plus size={22} weight="bold" color={BRAND.ink} />
      <Text style={styles.fabText}>{t("finance.record_payment")}</Text>
    </Pressable>
  );
}

/** Finance home (`/finance/today`): the dashboard of sample 5 frames 1-2 plus the building sheet (frame 3). */
export default function FinanceToday() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const c = useChartColors();
  const styles = React.useMemo(() => buildStyles(c), [c]);
  const [months, setMonths] = React.useState<6 | 12>(6);
  const [selected, setSelected] = React.useState<string | null>(null);
  const mapRef = React.useRef<CompoundMapHandle>(null);

  const dash = useFinanceDashboard(months);
  const data = dash.data;
  useRefocusEffect(() => void dash.refetch());

  const building = selected ? (data?.byBuilding.find(b => b.building === selected) ?? null) : null;
  const sheetFlats = useFinanceFlats(
    { building: selected ?? undefined, hasBalance: true, sort: "balance", asOf: data?.asOf },
    { enabled: !!selected && !!data, limit: 10 },
  );

  // Back to the map: clear the selection and return screen-reader focus to the building.
  const closeSheet = React.useCallback(() => {
    setSelected((code) => {
      if (code)
        setTimeout(() => mapRef.current?.focusBuilding(code), 50);
      return null;
    });
  }, []);

  // A failed fetch (first load, refetch, pull to refresh, 6M/12M switch, offline) replaces the figures:
  // TanStack keeps the previous `data` after a failed refetch, and stale money must never read as current.
  if (dash.isError) {
    return (
      <View style={styles.container}>
        <FinanceHomeHeader />
        <ErrorState message={t("finance.dash.load_error")} onRetry={() => dash.refetch()} />
        <RecordPaymentFab />
      </View>
    );
  }

  const listHeader = data
    ? (
        <View>
          <DashHero data={data} />
          <KpiCarousel data={data} />
          <AttentionCard data={data} />
          <DashCharts
            data={data}
            months={months}
            pending={dash.isPlaceholderData}
            onMonthsChange={setMonths}
            selected={selected}
            onSelect={(code) => {
              Haptics.selectionAsync();
              setSelected(code);
            }}
            mapRef={mapRef}
          />
          <View style={styles.topTitle}>
            <SectionTitle title={t("finance.dash.top_title")} />
          </View>
        </View>
      )
    : <DashboardSkeleton />;

  return (
    <View style={styles.container}>
      <FinanceHomeHeader data={data} />
      <FlashList
        data={data?.topOwing ?? []}
        keyExtractor={row => row.flatId}
        renderItem={({ item }) => <TopOwingRow row={item} />}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={data ? <Text style={styles.empty}>{t("finance.dash.no_overdue")}</Text> : null}
        contentContainerStyle={{ paddingBottom: insets.bottom + 96 }}
        onRefresh={() => dash.refetch()}
        refreshing={dash.isRefetching && !dash.isPlaceholderData}
      />
      <RecordPaymentFab />
      <BuildingSheet
        building={building}
        flats={sheetFlats.data?.pages[0]?.data.data.items}
        flatsLoading={sheetFlats.isLoading}
        flatsError={sheetFlats.isError}
        onRetryFlats={() => sheetFlats.refetch()}
        onFlatPress={(flat) => {
          setSelected(null);
          go(`/finance/flats/${encodeURIComponent(flat.id)}`);
        }}
        onViewFlats={(code) => {
          setSelected(null);
          go(flatsHref({ building: code, hasBalance: true, sort: "balance", asOf: data?.asOf }));
        }}
        onClose={closeSheet}
      />
    </View>
  );
}

function buildStyles(c: ReturnType<typeof useChartColors>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    pressed: { opacity: 0.8 },
    topTitle: { paddingHorizontal: SPACING.base, marginTop: SPACING.base },
    empty: { fontFamily: FONT.sans, fontSize: 13, lineHeight: 20, color: c.mut, textAlign: "center", paddingVertical: SPACING.base },
    fab: { position: "absolute", end: SPACING.base, flexDirection: "row", alignItems: "center", gap: SPACING.sm, minHeight: 52, paddingHorizontal: SPACING.lg, borderRadius: RADIUS.full, backgroundColor: BRAND.gold, elevation: 6, shadowColor: BRAND.ink, shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
    fabText: { fontFamily: FONT.sans, fontWeight: "700", fontSize: 14, color: BRAND.ink },
  });
}
