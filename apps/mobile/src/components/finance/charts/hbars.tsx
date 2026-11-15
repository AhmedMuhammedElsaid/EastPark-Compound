import * as React from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";

import Svg, { Rect, Text as SvgText } from "react-native-svg";
import { FONT } from "@/theme/tokens";

import { compactMoney } from "./geometry";
import { useChartColors } from "./use-chart-colors";
import { useChartWidth } from "./use-chart-width";

export type HBarItem = {
  key: string;
  label: string;
  /** Plain number for geometry; negatives draw no bar. */
  value: number;
  /** Palette key (`a3`, `c1`, ...) or literal colour. */
  color?: string;
  /** Spoken label for this row; defaults to "label: value". */
  a11y?: string;
};

type Props = {
  items: readonly HBarItem[];
  rowHeight?: number;
  labelWidth?: number;
  color?: string;
  /** Accessible name of the whole chart. */
  label: string;
};

/** Horizontal bars (mockup `hbar`): label, track, bar, compact value. */
export function HBars({ items, rowHeight = 26, labelWidth = 28, color = "a3", label }: Props) {
  const { i18n } = useTranslation();
  const c = useChartColors() as Record<string, string>;
  const { width, onLayout } = useChartWidth();
  const trackWidth = Math.max(0, width - labelWidth - 60);
  const max = Math.max(1, ...items.map(i => i.value));
  const summary = items.map(i => i.a11y ?? `${i.label}: ${compactMoney(i.value, i18n.language)}`).join(", ");
  return (
    <View onLayout={onLayout} accessible accessibilityRole="image" accessibilityLabel={`${label}. ${summary}`} testID="hbars">
      {width > 0
        ? (
            <Svg width={width} height={items.length * rowHeight}>
              {items.map((item, i) => {
                const y = i * rowHeight;
                const bw = (Math.max(0, item.value) / max) * trackWidth;
                const fill = c[item.color ?? color] ?? item.color ?? color;
                return (
                  <React.Fragment key={item.key}>
                    <SvgText x={labelWidth - 8} y={y + rowHeight / 2 + 4} textAnchor="end" fontFamily={FONT.sans} fontSize={11} fill={c.tx}>{item.label}</SvgText>
                    <Rect x={labelWidth} y={y + 6} width={trackWidth} height={rowHeight - 12} rx={4} fill={c.elev} />
                    {bw > 0 ? <Rect x={labelWidth} y={y + 6} width={bw} height={rowHeight - 12} rx={4} fill={fill} /> : null}
                    <SvgText x={labelWidth + trackWidth + 8} y={y + rowHeight / 2 + 4} fontFamily={FONT.sans} fontSize={11} fill={c.mut}>{compactMoney(item.value, i18n.language)}</SvgText>
                  </React.Fragment>
                );
              })}
            </Svg>
          )
        : <View style={{ height: items.length * rowHeight }} />}
    </View>
  );
}
