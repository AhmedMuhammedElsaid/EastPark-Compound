import * as React from "react";
import Svg, { Circle, Path } from "react-native-svg";

import { num, sparkPath, sparkPoints } from "./geometry";
import { useChartColors } from "./use-chart-colors";

type Props = {
  /** Decimal strings or numbers, oldest first. */
  values: ReadonlyArray<string | number>;
  /** A palette key (`c1`..`c5`, `err`, ...) or a literal colour. */
  color?: string;
  width?: number;
  height?: number;
};

/** KPI sparkline (mockup `spark`): area + line + end dot. Decorative; the tile carries the accessible text. */
export function Sparkline({ values, color, width = 110, height = 34 }: Props) {
  const palette = useChartColors();
  const stroke = (color && (palette as Record<string, string>)[color]) || color || palette.c1;
  const points = sparkPoints(values.map(v => (typeof v === "number" ? v : num(v))), width, height);
  if (points.length === 0)
    return null;
  const d = sparkPath(points);
  const last = points.at(-1)!;
  return (
    <Svg width={width} height={height} accessible={false} importantForAccessibility="no-hide-descendants" testID="sparkline">
      <Path d={`${d}L${last.x} ${height}L${points[0].x} ${height}Z`} fill={stroke} opacity={0.12} />
      <Path d={d} fill="none" stroke={stroke} strokeWidth={1.6} strokeLinejoin="round" />
      <Circle cx={last.x} cy={last.y} r={2.6} fill={stroke} />
    </Svg>
  );
}
