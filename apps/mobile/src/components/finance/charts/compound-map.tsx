import type { DashBuilding } from "./types";
import * as Haptics from "expo-haptics";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { AccessibilityInfo, findNodeHandle, Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Line, Rect, Text as SvgText } from "react-native-svg";

import { formatMoney } from "@/lib/format-money";
import { formatNumber } from "@/lib/format-number";
import { FONT, SPACING } from "@/theme/tokens";

import { compactMoney, mapLayout, mixHex } from "./geometry";
import { useChartColors } from "./use-chart-colors";
import { useChartWidth } from "./use-chart-width";

export type CompoundMapHandle = {
  /** Moves screen-reader focus back to a building (after the sheet closes). */
  focusBuilding: (code: string) => void;
};

type Props = {
  buildings: readonly DashBuilding[];
  selected: string | null;
  onSelect: (code: string) => void;
};

/** Compound map (4 columns, 3 rows for 12 buildings) (mockup `mapSvg`, narrow): buildings shaded by outstanding per flat; tap opens the sheet. */
export function CompoundMap({ ref, buildings, selected, onSelect }: Props & { ref?: React.RefObject<CompoundMapHandle | null> }) {
  const { t, i18n } = useTranslation();
  const c = useChartColors();
  const { width, onLayout } = useChartWidth();
  const styles = React.useMemo(() => buildStyles(c), [c]);
  const nodes = React.useRef(new Map<string, View>());
  const layout = width > 0 ? mapLayout(buildings, width) : null;
  const byCode = new Map(buildings.map(b => [b.building, b]));

  React.useImperativeHandle(ref, () => ({
    focusBuilding(code) {
      const node = nodes.current.get(code);
      const handle = node ? findNodeHandle(node) : null;
      if (handle)
        AccessibilityInfo.setAccessibilityFocus(handle);
    },
  }), []);

  if (buildings.length === 0)
    return <Text style={styles.empty}>{t("finance.dash.no_buildings")}</Text>;

  const height = layout ? layout.height + 30 : 290;
  return (
    <View onLayout={onLayout} style={{ height }} accessibilityLabel={t("finance.dash.map_a11y")} testID="compound-map">
      {layout
        ? (
            <>
              <Svg width={width} height={height} pointerEvents="none" importantForAccessibility="no-hide-descendants">
                {layout.roadYs.map(y => <Rect key={y} x={0} y={y} width={width} height={6} rx={3} fill={c.elev} />)}
                <SvgText x={width / 2} y={layout.height + 22} textAnchor="middle" fontFamily={FONT.sans} fontSize={11} fill={c.mut}>{`${t("finance.dash.main_gate")} ▲`}</SvgText>
                {layout.items.map((b) => {
                  const data = byCode.get(b.code)!;
                  const on = selected === b.code;
                  const lineStep = (b.height - 34) / 5;
                  return (
                    <React.Fragment key={b.code}>
                      <Rect x={b.x} y={b.y} width={b.width} height={b.height} rx={10} fill={mixHex(c.err, c.elev, b.intensity)} stroke={on ? c.gold : c.line} strokeWidth={on ? 2.5 : 1} />
                      {[0, 1, 2, 3, 4].map(f => (
                        <Line key={f} x1={b.x + 10} x2={b.x + b.width - 10} y1={b.y + b.height - 14 - f * lineStep} y2={b.y + b.height - 14 - f * lineStep} stroke={c.bg} opacity={0.25} />
                      ))}
                      <SvgText x={b.x + 10} y={b.y + 22} fontFamily={FONT.sans} fontWeight="600" fontSize={14} fill={c.tx}>{b.code}</SvgText>
                      <SvgText x={b.x + 10} y={b.y + b.height - 24} fontFamily={FONT.sans} fontSize={11} fill={c.tx}>{compactMoney(data.outstanding, i18n.language)}</SvgText>
                      <SvgText x={b.x + 10} y={b.y + b.height - 9} fontFamily={FONT.sans} fontSize={11} fill={c.tx}>{`${formatNumber(data.owingFlats, i18n.language)}/${formatNumber(data.totalFlats, i18n.language)}`}</SvgText>
                    </React.Fragment>
                  );
                })}
              </Svg>
              {layout.items.map((b) => {
                const data = byCode.get(b.code)!;
                return (
                  <Pressable
                    key={b.code}
                    ref={(node) => {
                      if (node)
                        nodes.current.set(b.code, node);
                      else nodes.current.delete(b.code);
                    }}
                    style={{ position: "absolute", left: b.x, top: b.y, width: b.width, height: Math.max(48, b.height) }}
                    onPress={() => {
                      Haptics.selectionAsync();
                      onSelect(b.code);
                    }}
                    accessibilityRole="button"
                    accessibilityState={{ selected: selected === b.code }}
                    accessibilityLabel={t("finance.dash.building_a11y", {
                      code: b.code,
                      amount: formatMoney(data.outstanding),
                      owing: formatNumber(data.owingFlats, i18n.language),
                      total: formatNumber(data.totalFlats, i18n.language),
                    })}
                  />
                );
              })}
            </>
          )
        : null}
    </View>
  );
}
CompoundMap.displayName = "CompoundMap";

function buildStyles(c: ReturnType<typeof useChartColors>) {
  return StyleSheet.create({
    empty: { fontFamily: FONT.sans, fontSize: 13, color: c.mut, paddingVertical: SPACING.base, textAlign: "center" },
  });
}
