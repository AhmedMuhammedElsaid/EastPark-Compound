'use client';

import { formatDecimalAmount } from '@/lib/finance/money';

import { compact, geo } from './geometry';
import { tipProps, useChartTooltip } from './tooltip';
import { AXIS_TEXT, STRONG_TEXT, SrTable, useChartWidth, type ChartLang } from './shared';

export type HBarItem = { key: string; label: string; amount: string };

export type HBarsProps = {
  items: HBarItem[];
  lang: ChartLang;
  labels: { title: string; label: string; value: string; empty: string };
  /** A theme token such as `var(--chart-a3)`. */
  color?: string;
  width?: number;
  rowHeight?: number;
  labelWidth?: number;
};

/**
 * sample-4 `hbar`: label, a track, the value bar, then the compact value. Bars scale by magnitude;
 * a negative amount is drawn in the error colour so the sign is never lost.
 */
export function HBars({
  items,
  lang,
  labels,
  color = 'var(--chart-a3)',
  width,
  rowHeight = 26,
  labelWidth = 30,
}: HBarsProps) {
  useChartTooltip();
  const { ref, width: w } = useChartWidth(width, 320);
  const vw = Math.max(1, w - labelWidth - 60);
  const mx = Math.max(1, ...items.map((i) => Math.abs(geo(i.amount))));
  return (
    <div ref={ref} dir="ltr" className="w-full">
      <svg width={w} height={Math.max(items.length, 1) * rowHeight} role="img" aria-label={labels.title} focusable="false">
        {items.map((it, i) => {
          const v = geo(it.amount);
          const y = i * rowHeight;
          return (
            <g key={it.key}>
              <text x={labelWidth - 8} y={y + rowHeight / 2 + 4} textAnchor="end" style={{ ...STRONG_TEXT, fontSize: 11 }}>
                {it.label}
              </text>
              <rect x={labelWidth} y={y + 6} width={vw} height={rowHeight - 12} rx={4} fill="var(--color-muted)" />
              <rect
                x={labelWidth}
                y={y + 6}
                width={(Math.abs(v) / mx) * vw}
                height={rowHeight - 12}
                rx={4}
                fill={v < 0 ? 'var(--chart-a4)' : color}
                {...tipProps(`${it.label}: ${formatDecimalAmount(it.amount, lang)}`)}
              />
              <text x={labelWidth + vw + 8} y={y + rowHeight / 2 + 4} style={AXIS_TEXT}>
                {compact(v)}
              </text>
            </g>
          );
        })}
      </svg>
      {items.length === 0 ? <p className="text-[length:var(--text-caption)] text-muted-foreground">{labels.empty}</p> : null}
      <SrTable
        caption={labels.title}
        head={[labels.label, labels.value]}
        rows={items.map((i) => ({ key: i.key, cells: [i.label, formatDecimalAmount(i.amount, lang, 2)] }))}
      />
    </div>
  );
}
