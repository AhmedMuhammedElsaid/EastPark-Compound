import type { DashAging } from "./types";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";
import Svg, { ClipPath, Defs, Rect } from "react-native-svg";

import { formatCurrency } from "@/lib/format-currency";
import { FONT, SPACING } from "@/theme/tokens";

import { num, stackSegments } from "./geometry";
import { useChartColors } from "./use-chart-colors";
import { useChartWidth } from "./use-chart-width";

type Props = {
  aging: DashAging;
  height?: number;
};

const BUCKETS = [
  { key: "current", color: "a1", label: "finance.dash.aging_current" },
  { key: "d31_60", color: "a2", label: "finance.dash.aging_31_60" },
  { key: "d61_90", color: "a3", label: "finance.dash.aging_61_90" },
  { key: "over90", color: "a4", label: "finance.dash.aging_over_90" },
] as const;

/** Aging stacked bar plus one 48 dp row per bucket (section 6 item 6 labels). */
export function StackedBar({ aging, height = 14 }: Props) {
  const { t } = useTranslation();
  const c = useChartColors();
  const { width, onLayout } = useChartWidth();
  const styles = React.useMemo(() => buildStyles(c), [c]);
  const items = BUCKETS.map(b => ({ ...b, value: Math.max(0, num(aging[b.key])) }));
  const total = items.reduce((s, i) => s + i.value, 0);
  const segments = stackSegments(items.map(i => ({ key: i.key, value: i.value })), width);
  const summary = total > 0 ? items.map(i => `${t(i.label)}: ${formatCurrency(i.value)}`).join(", ") : t("finance.dash.no_overdue");

  return (
    <View>
      <View onLayout={onLayout} accessible accessibilityRole="image" accessibilityLabel={`${t("finance.dash.aging_title")}. ${summary}`} style={{ height }} testID="stacked-bar">
        {width > 0
          ? (
              <Svg width={width} height={height}>
                <Defs>
                  <ClipPath id="aging-clip"><Rect x={0} y={0} width={width} height={height} rx={height / 2} /></ClipPath>
                </Defs>
                <Rect x={0} y={0} width={width} height={height} rx={height / 2} fill={c.elev} />
                {total > 0
                  ? segments.map((s, i) => (s.width > 0 ? <Rect key={s.key} x={s.x} y={0} width={s.width} height={height} fill={c[BUCKETS[i].color]} clipPath="url(#aging-clip)" /> : null))
                  : null}
              </Svg>
            )
          : null}
      </View>
      {total === 0 ? <Text style={styles.empty}>{t("finance.dash.no_overdue")}</Text> : null}
      {items.map(i => (
        <View key={i.key} style={styles.row} accessible accessibilityLabel={`${t(i.label)}: ${formatCurrency(i.value)}`}>
          <View style={styles.name}>
            <View style={[styles.swatch, { backgroundColor: c[i.color] }]} />
            <Text style={styles.text}>{t(i.label)}</Text>
          </View>
          <Text style={styles.text}>{formatCurrency(i.value)}</Text>
        </View>
      ))}
    </View>
  );
}

function buildStyles(c: ReturnType<typeof useChartColors>) {
  return StyleSheet.create({
    empty: { fontFamily: FONT.sans, fontSize: 13, color: c.mut, paddingVertical: SPACING.sm },
    row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 48, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.line },
    name: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
    swatch: { width: 10, height: 10, borderRadius: 3 },
    text: { fontFamily: FONT.sans, fontSize: 13, color: c.tx },
  });
}
