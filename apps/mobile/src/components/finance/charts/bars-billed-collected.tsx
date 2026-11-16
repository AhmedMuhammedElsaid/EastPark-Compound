import type { DashMonthAmount } from "./types";
import * as Haptics from "expo-haptics";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Line, Rect, Text as SvgText } from "react-native-svg";

import { isZeroMoney, percentTenths, sumMoney } from "@/lib/decimal-money";
import { formatFinanceDate } from "@/lib/finance";
import { formatMoney } from "@/lib/format-money";
import { FONT, RADIUS, SPACING } from "@/theme/tokens";

import { barsLayout, compactMoney, num, percentLabel } from "./geometry";
import { useChartColors } from "./use-chart-colors";
import { useChartWidth } from "./use-chart-width";

type Props = {
  /** Operating charges per month, oldest first (`billed`). */
  billed: readonly DashMonthAmount[];
  /** Allocations per month, oldest first (`collected`). */
  collected: readonly DashMonthAmount[];
  /** The window the data covers (`dashboard.months`), so the bars never draw 6 months of data as 12. */
  months: 6 | 12;
  /** The window the user asked for; shown as selected while `pending` (defaults to `months`). */
  requested?: 6 | 12;
  /** The requested window is still loading: the old window stays on screen, dimmed and marked busy. */
  pending?: boolean;
  onMonthsChange: (months: 6 | 12) => void;
  height?: number;
};

function monthLabel(period: string, language: string, narrow: boolean): string {
  const full = formatFinanceDate(`${period}-01`, language, { month: "short" });
  if (language === "ar")
    return Array.from(full).slice(0, narrow ? 3 : 5).join("");
  return full.slice(0, 3);
}

/** Billed vs collected bars with the 6M / 12M switch (mockup `barsN`). Signed values grow down from zero. */
export function BarsBilledCollected({ billed, collected, months, requested, pending = false, onMonthsChange, height = 210 }: Props) {
  const chosen = requested ?? months;
  const { t, i18n } = useTranslation();
  const c = useChartColors();
  const { width, onLayout } = useChartWidth();
  const [selected, setSelected] = React.useState<number | null>(null);
  const styles = React.useMemo(() => buildStyles(c), [c]);

  const billedValues = billed.map(b => num(b.amount));
  const collectedValues = collected.map(b => num(b.amount));
  const hasData = billed.some(b => !isZeroMoney(b.amount)) || collected.some(b => !isZeroMoney(b.amount));
  const layout = barsLayout(billedValues, collectedValues, { w: width, h: height });
  const periods = billed.map(b => b.period);

  React.useEffect(() => setSelected(null), [months]);

  const readout = (i: number) => {
    const b = billed[i]?.amount ?? "0.00";
    const col = collected[i]?.amount ?? "0.00";
    const rate = percentLabel(percentTenths(col, b), i18n.language);
    return t("finance.dash.month_readout", {
      month: monthLabel(periods[i] ?? "", i18n.language, false),
      billed: formatMoney(b),
      collected: formatMoney(col),
      rate,
    });
  };
  const summary = hasData
    ? t("finance.dash.bars_a11y", { count: billed.length, billed: formatMoney(sumMoney(billed.map(b => b.amount))), collected: formatMoney(sumMoney(collected.map(b => b.amount))) })
    : t("finance.dash.no_data");

  return (
    <View>
      <View style={styles.switch} accessibilityRole="tablist">
        {([6, 12] as const).map(m => (
          <Pressable
            key={m}
            style={[styles.segment, chosen === m && styles.segmentOn]}
            onPress={() => {
              Haptics.selectionAsync();
              onMonthsChange(m);
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: chosen === m, busy: pending && chosen === m }}
            accessibilityLabel={t(m === 6 ? "finance.dash.months_6_a11y" : "finance.dash.months_12_a11y")}
          >
            <Text style={[styles.segmentText, chosen === m && styles.segmentTextOn]}>{t(m === 6 ? "finance.dash.months_6" : "finance.dash.months_12")}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.swatch, { backgroundColor: c.c5, opacity: 0.6 }]} />
          <Text style={styles.legendText}>{t("finance.dash.billed")}</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.swatch, { backgroundColor: c.c1 }]} />
          <Text style={styles.legendText}>{t("finance.dash.collected")}</Text>
        </View>
      </View>
      <View onLayout={onLayout} style={{ height, opacity: pending ? 0.5 : 1 }} accessible={!hasData} accessibilityRole="image" accessibilityLabel={summary} testID="bars-chart">
        {width > 0
          ? (
              <Svg width={width} height={height}>
                {layout.ticks.map(tick => (
                  <React.Fragment key={tick.value}>
                    <Line x1={layout.inner.left} x2={layout.inner.right} y1={tick.y} y2={tick.y} stroke={c.line} strokeDasharray={tick.value ? "3 4" : undefined} />
                    <SvgText x={layout.inner.left - 6} y={tick.y + 4} textAnchor="end" fontFamily={FONT.sans} fontSize={10} fill={c.mut}>{compactMoney(tick.value, i18n.language)}</SvgText>
                  </React.Fragment>
                ))}
                {layout.columns.map((col, i) => (
                  <React.Fragment key={periods[i] ?? i}>
                    {selected === i ? <Rect x={col.x - layout.columnWidth / 2} y={layout.inner.top} width={layout.columnWidth} height={layout.inner.height} fill={c.elev} opacity={0.6} /> : null}
                    <Rect x={col.x - layout.barWidth - 1} y={col.billed.y} width={layout.barWidth} height={col.billed.height} rx={3} fill={c.c5} opacity={0.5} />
                    <Rect x={col.x + 1} y={col.collected.y} width={layout.barWidth} height={col.collected.height} rx={3} fill={c.c1} />
                    <SvgText x={col.x} y={height - 7} textAnchor="middle" fontFamily={FONT.sans} fontSize={months > 6 ? 10 : 11} fill={c.mut}>
                      {monthLabel(periods[i] ?? "", i18n.language, months > 6)}
                    </SvgText>
                  </React.Fragment>
                ))}
              </Svg>
            )
          : null}
        {width > 0 && hasData
          ? layout.columns.map((col, i) => (
              <Pressable
                key={periods[i] ?? i}
                style={{ position: "absolute", top: 0, height, left: col.x - layout.columnWidth / 2, width: layout.columnWidth }}
                onPress={() => {
                  Haptics.selectionAsync();
                  setSelected(prev => (prev === i ? null : i));
                }}
                accessibilityRole="button"
                accessibilityLabel={readout(i)}
                accessibilityState={{ selected: selected === i }}
              />
            ))
          : null}
      </View>
      {!hasData ? <Text style={styles.empty}>{t("finance.dash.no_data")}</Text> : null}
      {hasData
        ? (
            <Text style={selected !== null ? styles.readout : styles.readoutHint} accessibilityLiveRegion="polite" accessibilityLabel={selected !== null ? readout(selected) : `${summary}. ${t("finance.dash.tap_month")}`}>
              {selected !== null ? readout(selected) : t("finance.dash.tap_month")}
            </Text>
          )
        : null}
    </View>
  );
}

function buildStyles(c: ReturnType<typeof useChartColors>) {
  return StyleSheet.create({
    switch: { flexDirection: "row", alignSelf: "flex-start", backgroundColor: c.elev, borderRadius: RADIUS.md, padding: 3, gap: 2, marginBottom: SPACING.sm },
    segment: { minHeight: 48, minWidth: 56, paddingHorizontal: 14, borderRadius: 10, alignItems: "center", justifyContent: "center" },
    segmentOn: { backgroundColor: c.card },
    segmentText: { fontFamily: FONT.sans, fontSize: 13, color: c.mut },
    segmentTextOn: { color: c.tx, fontWeight: "500" },
    legend: { flexDirection: "row", gap: SPACING.base, marginBottom: SPACING.sm },
    legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
    swatch: { width: 10, height: 10, borderRadius: 3 },
    legendText: { fontFamily: FONT.sans, fontSize: 12, color: c.mut },
    empty: { fontFamily: FONT.sans, fontSize: 13, color: c.mut, textAlign: "center", paddingVertical: SPACING.sm },
    readout: { fontFamily: FONT.sans, fontSize: 12, lineHeight: 20, color: c.tx, marginTop: SPACING.sm, textAlign: "left" },
    readoutHint: { fontFamily: FONT.sans, fontSize: 12, lineHeight: 20, color: c.mut, marginTop: SPACING.sm, textAlign: "left" },
  });
}
