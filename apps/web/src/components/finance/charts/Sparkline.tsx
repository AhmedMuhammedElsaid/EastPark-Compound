import { formatDecimalAmount } from '@/lib/finance/money';

import { geo, linePath, sparkPoints } from './geometry';
import { SrTable, type ChartLang } from './shared';

export type SparklinePoint = { label: string; value: string };

export type SparklineProps = {
  points: SparklinePoint[];
  lang: ChartLang;
  /** Accessible name, e.g. "Outstanding trend". */
  label: string;
  /** Header of the hidden table's two columns: [period, value]. */
  columns: [string, string];
  /** Any theme token, e.g. `var(--chart-1)`. */
  color?: string;
  width?: number;
  height?: number;
};

/** sample-4 `spark`: area + line + end dot. Flat and single-point series draw without NaN. */
export function Sparkline({
  points,
  lang,
  label,
  columns,
  color = 'var(--chart-1)',
  width = 104,
  height = 34,
}: SparklineProps) {
  const values = points.map((p) => geo(p.value));
  const pts = sparkPoints(values, width, height);
  const last = pts[pts.length - 1];
  const d = linePath(pts);
  return (
    <span className="inline-block" dir="ltr">
      <svg width={width} height={height} role="img" aria-label={label} focusable="false">
        {last ? (
          <>
            <path d={`${d}L${last[0]} ${height}L3 ${height}Z`} fill={color} opacity={0.12} />
            <path d={d} fill="none" stroke={color} strokeWidth={1.6} strokeLinejoin="round" />
            <circle cx={last[0]} cy={last[1]} r={2.6} fill={color} />
          </>
        ) : null}
      </svg>
      <SrTable
        caption={label}
        head={[...columns]}
        rows={points.map((p) => ({ key: p.label, cells: [p.label, formatDecimalAmount(p.value, lang, 2)] }))}
      />
    </span>
  );
}
