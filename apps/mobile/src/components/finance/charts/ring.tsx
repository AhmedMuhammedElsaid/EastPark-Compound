import * as React from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import Svg, { Circle, Text as SvgText } from "react-native-svg";

import { FONT } from "@/theme/tokens";

import { percentLabel, ringFraction } from "./geometry";
import { useChartColors } from "./use-chart-colors";

type Props = {
  /** `cohort.rate`: 1-dp percentage string, null when the month has no charges. */
  rate: string | null;
  size?: number;
  strokeWidth?: number;
  /** Caption under the percentage (defaults to the rate label). */
  caption?: string;
};

/** Collection ring (mockup `ring`). The arc clamps to 0-100 %; the label prints the true rate. */
export function Ring({ rate, size = 132, strokeWidth = 14, caption }: Props) {
  const { t, i18n } = useTranslation();
  const c = useChartColors();
  const r = size / 2 - strokeWidth;
  const circumference = 2 * Math.PI * r;
  const fraction = ringFraction(rate);
  const label = percentLabel(rate, i18n.language);
  const text = caption ?? t("finance.dash.rate");
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={rate === null ? t("finance.dash.ring_empty") : t("finance.dash.ring_a11y", { rate: label })}
      style={{ width: size, height: size }}
    >
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={c.elev} strokeWidth={strokeWidth} />
        {fraction > 0
          ? (
              <Circle
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={c.c1}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeDasharray={`${circumference * fraction} ${circumference}`}
                transform={`rotate(-90 ${size / 2} ${size / 2})`}
              />
            )
          : null}
        <SvgText x={size / 2} y={size * 0.52} textAnchor="middle" fontFamily={FONT.sans} fontWeight="300" fontSize={size / 4.4} fill={c.tx}>{label}</SvgText>
        <SvgText x={size / 2} y={size * 0.52 + size / 6} textAnchor="middle" fontFamily={FONT.sans} fontSize={11} fill={c.mut}>{text}</SvgText>
      </Svg>
    </View>
  );
}
