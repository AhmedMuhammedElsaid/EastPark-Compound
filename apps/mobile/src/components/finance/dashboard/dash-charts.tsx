import type { Href } from "expo-router";
import type { CompoundMapHandle } from "@/components/finance/charts/compound-map";
import type { FinanceDashboard } from "@/services/api/finance";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { Bell, CalendarBlank, MagnifyingGlass, UserCircle } from "phosphor-react-native";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { BarsBilledCollected } from "@/components/finance/charts/bars-billed-collected";
import { CompoundMap } from "@/components/finance/charts/compound-map";
import { Donut } from "@/components/finance/charts/donut";
import { mixHex } from "@/components/finance/charts/geometry";
import { StackedBar } from "@/components/finance/charts/stacked-bar";
import { useChartColors } from "@/components/finance/charts/use-chart-colors";
import { ScreenHeader } from "@/components/ui/screen-header";
import { periodLabel } from "@/lib/finance-dashboard";
import { FONT, RADIUS, SPACING } from "@/theme/tokens";
import { DashCard, SectionTitle } from "./dash-ui";

function go(href: string) {
  Haptics.selectionAsync();
  router.push(href as Href);
}

/** App header (mockup `appHead`): title, period pill, bell; plus find-a-flat and profile (section 6 item 13: no tab bar). */
export function FinanceHomeHeader({ data }: { data?: FinanceDashboard }) {
  const { t, i18n } = useTranslation();
  const c = useChartColors();
  const styles = React.useMemo(() => buildStyles(c), [c]);
  const period = data ? periodLabel(data.period.period, i18n.language) : "";
  return (
    <ScreenHeader
      title={t("finance.title")}
      back={router.canGoBack()}
      right={(
        <>
          {data
            ? (
                <Pressable
                  style={({ pressed }) => [styles.pill, pressed && styles.pressed]}
                  onPress={() => go("/finance/period")}
                  accessibilityRole="button"
                  accessibilityLabel={t("finance.dash.period_pill_a11y", { period, status: t(`finance.dash.status_${data.period.status}`) })}
                  testID="period-pill"
                >
                  <CalendarBlank size={16} color={c.gold} />
                  <Text style={styles.pillText} numberOfLines={1}>{period}</Text>
                </Pressable>
              )
            : null}
          <Pressable style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]} onPress={() => go("/finance/period")} accessibilityRole="button" accessibilityLabel={t("finance.dash.bell_a11y")} testID="bell">
            <Bell size={22} color={c.tx} />
          </Pressable>
          <Pressable style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]} onPress={() => go("/finance/flats")} accessibilityRole="button" accessibilityLabel={t("finance.find_flat")} testID="find-flat">
            <MagnifyingGlass size={22} color={c.tx} />
          </Pressable>
          <Pressable style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]} onPress={() => go("/(tabs)/profile")} accessibilityRole="button" accessibilityLabel={t("profile.tab_label")}>
            <UserCircle size={24} color={c.tx} />
          </Pressable>
        </>
      )}
    />
  );
}

type ChartsProps = {
  data: FinanceDashboard;
  months: 6 | 12;
  onMonthsChange: (months: 6 | 12) => void;
  selected: string | null;
  onSelect: (code: string) => void;
  mapRef: React.RefObject<CompoundMapHandle | null>;
};

/** Frame 2 cards in order: compound map, billed vs collected, aging, receipts by method. */
export function DashCharts({ data, months, onMonthsChange, selected, onSelect, mapRef }: ChartsProps) {
  const { t } = useTranslation();
  const c = useChartColors();
  const styles = React.useMemo(() => buildStyles(c), [c]);
  const ramp = [0.15, 0.4, 0.65].map(p => mixHex(c.a4, c.elev, p));
  return (
    <>
      <DashCard testID="dash-map">
        <SectionTitle
          title={t("finance.dash.map_title")}
          right={(
            <View style={styles.legend} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <Text style={styles.legendText}>{t("finance.dash.map_less")}</Text>
              {ramp.map(color => <View key={color} style={[styles.ramp, { backgroundColor: color }]} />)}
              <Text style={styles.legendText}>{t("finance.dash.map_more")}</Text>
            </View>
          )}
        />
        <CompoundMap ref={mapRef} buildings={data.byBuilding} selected={selected} onSelect={onSelect} />
        <Text style={styles.hint}>{t("finance.dash.map_hint")}</Text>
      </DashCard>
      <DashCard testID="dash-bars">
        <SectionTitle title={t("finance.dash.chart_title")} />
        <BarsBilledCollected billed={data.billed} collected={data.collected} months={months} onMonthsChange={onMonthsChange} />
      </DashCard>
      <DashCard testID="dash-aging">
        <SectionTitle title={t("finance.dash.aging_title")} />
        <StackedBar aging={data.aging} />
      </DashCard>
      <DashCard testID="dash-methods">
        <SectionTitle title={t("finance.dash.methods_title")} />
        <Donut methods={data.receiptsByMethod} />
      </DashCard>
    </>
  );
}

function buildStyles(c: ReturnType<typeof useChartColors>) {
  return StyleSheet.create({
    pressed: { opacity: 0.8 },
    iconBtn: { width: 44, height: 48, alignItems: "center", justifyContent: "center", borderRadius: RADIUS.md },
    pill: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 48, paddingHorizontal: SPACING.sm, borderRadius: RADIUS.full },
    pillText: { fontFamily: FONT.sans, fontWeight: "500", fontSize: 12, lineHeight: 18, color: c.tx, maxWidth: 96 },
    legend: { flexDirection: "row", alignItems: "center", gap: 4 },
    legendText: { fontFamily: FONT.sans, fontSize: 11, color: c.mut },
    ramp: { width: 14, height: 8, borderRadius: 2 },
    hint: { fontFamily: FONT.sans, fontSize: 12, lineHeight: 18, color: c.mut, textAlign: "center", marginTop: SPACING.sm },
  });
}
