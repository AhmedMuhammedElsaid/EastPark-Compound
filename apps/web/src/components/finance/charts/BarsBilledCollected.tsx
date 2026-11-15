'use client';

import { formatDecimalAmount } from '@/lib/finance/money';

import { compact, geo, monthName, pct, valueScale } from './geometry';
import { tipProps, useChartTooltip } from './tooltip';
import { AXIS_TEXT, SrTable, useChartWidth, type ChartLang } from './shared';

export type MonthAmount = { period: string; amount: string };

export type BarsBilledCollectedProps = {
  billed: MonthAmount[];
  collected: MonthAmount[];
  lang: ChartLang;
  labels: { title: string; billed: string; collected: string; month: string; rate: string; empty: string };
  /** Fixed pixel width; omit to follow the container. */
  width?: number;
  height?: number;
};

/**
 * sample-4 `barsBvC`: billed (muted, 50 %) next to collected per month, fixed 12-month window on
 * web. Values are signed: the baseline is the zero line and a negative month grows downward.
 */
export function BarsBilledCollected({ billed, collected, lang, labels, width, height = 280 }: BarsBilledCollectedProps) {
  useChartTooltip();
  const { ref, width: w } = useChartWidth(width, 720);
  const m = { l: 40, r: 8, t: 10, b: 26 };
  const iw = Math.max(1, w - m.l - m.r);
  const ih = height - m.t - m.b;
  const periods = billed.map((b) => b.period);
  const col = new Map(collected.map((c) => [c.period, c.amount]));
  const rows = periods.map((period, i) => ({
    period,
    billed: billed[i]?.amount ?? '0.00',
    collected: col.get(period) ?? '0.00',
  }));
  const all = rows.flatMap((r) => [geo(r.billed), geo(r.collected)]);
  const empty = rows.length === 0 || all.every((v) => v === 0);
  const scale = valueScale(all, m.t, ih);
  const y0 = scale.y(0);
  const gw = iw / Math.max(rows.length, 1);
  const bw = Math.max(5, Math.min(16, gw * 0.32));
  const narrow = w < 520;
  const bar = (value: number) => {
    const y = scale.y(value);
    return { y: Math.min(y, y0), h: Math.abs(y - y0) };
  };
  return (
    <div ref={ref} dir="ltr" className="w-full">
      <svg width={w} height={height} role="img" aria-label={labels.title} focusable="false">
        {scale.ticks.map((v) => {
          const y = scale.y(v);
          return (
            <g key={v}>
              <line
                x1={m.l}
                x2={w - m.r}
                y1={y}
                y2={y}
                stroke="var(--color-border)"
                strokeDasharray={v === 0 ? undefined : '3 4'}
              />
              <text x={m.l - 6} y={y + 4} textAnchor="end" style={AXIS_TEXT}>
                {compact(v)}
              </text>
            </g>
          );
        })}
        {rows.map((r, i) => {
          const b = geo(r.billed);
          const c = geo(r.collected);
          const x = m.l + gw * i + gw / 2;
          const bb = bar(b);
          const cb = bar(c);
          const month = monthName(r.period, lang, narrow ? 'narrow' : 'short');
          return (
            <g key={r.period} {...tipProps(`${monthName(r.period, lang, 'long')}\n${labels.billed}: ${formatDecimalAmount(r.billed, lang)}\n${labels.collected}: ${formatDecimalAmount(r.collected, lang)}\n${pct(c, b)}%`)}>
              <rect
                className="fc-bar"
                x={x - bw - 1}
                y={bb.y}
                width={bw}
                height={bb.h}
                rx={3}
                fill="var(--chart-5)"
                opacity={0.5}
              />
              <rect className="fc-bar" x={x + 1} y={cb.y} width={bw} height={cb.h} rx={3} fill="var(--chart-1)" />
              <text x={x} y={height - 8} textAnchor="middle" style={AXIS_TEXT}>
                {month}
              </text>
            </g>
          );
        })}
        {empty ? (
          <text x={w / 2} y={height / 2} textAnchor="middle" style={AXIS_TEXT}>
            {labels.empty}
          </text>
        ) : null}
      </svg>
      <SrTable
        caption={labels.title}
        head={[labels.month, labels.billed, labels.collected]}
        rows={rows.map((r) => ({
          key: r.period,
          cells: [monthName(r.period, lang, 'long'), formatDecimalAmount(r.billed, lang, 2), formatDecimalAmount(r.collected, lang, 2)],
        }))}
      />
    </div>
  );
}
