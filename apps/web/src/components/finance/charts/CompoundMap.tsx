'use client';

import * as React from 'react';

import { formatDecimalAmount } from '@/lib/finance/money';

import { compoundLayout } from './compound-layout';
import { compact, geo, mapCells } from './geometry';
import { useChartTooltip } from './tooltip';
import { AXIS_TEXT, NUM, SrTable, STRONG_TEXT, useChartWidth, type ChartLang } from './shared';

export type MapBuilding = { building: string; totalFlats: number; owingFlats: number; outstanding: string };

export type CompoundMapProps = {
  buildings: MapBuilding[];
  lang: ChartLang;
  /** Selected building code, or null for "all buildings". */
  selected: string | null;
  onSelect: (building: string) => void;
  labels: {
    title: string;
    aria: string;
    gate: string;
    flats: string;
    currency: string;
    building: string;
    outstanding: string;
    owing: string;
    empty: string;
  };
  width?: number;
};

/**
 * sample-4 `mapSvg`. Positions come from compound-layout.ts only. Each building is a real
 * button (Enter / Space select) tinted by arrears per flat; selection draws the gold outline and
 * `aria-pressed`. The DOM node of a building is stable across selections, so focus stays on it.
 */
export function CompoundMap({ buildings, lang, selected, onSelect, labels, width }: CompoundMapProps) {
  useChartTooltip();
  const { ref, width: w } = useChartWidth(width, 720);
  const positions = React.useMemo(() => compoundLayout(buildings.map((b) => b.building)), [buildings]);
  const narrow = w < 500;
  const { cells, height, roads } = mapCells(
    buildings.map((b) => ({ code: b.building, totalFlats: b.totalFlats, outstanding: geo(b.outstanding) })),
    positions,
    w,
  );
  const byCode = new Map(buildings.map((b) => [b.building, b]));
  return (
    <div ref={ref} dir="ltr" className="w-full">
      <svg width={w} height={height + 30} role="group" aria-label={labels.aria}>
        {roads.map((y) => (
          <rect key={y} x={0} y={y - 3} width={w} height={6} rx={3} fill="var(--color-muted)" />
        ))}
        <text x={w / 2} y={height + 22} textAnchor="middle" style={{ ...AXIS_TEXT, fontSize: 11 }}>
          {labels.gate} ▲
        </text>
        {cells.map((cell) => {
          const b = byCode.get(cell.code);
          if (!b) return null;
          const on = selected === cell.code;
          const amount = formatDecimalAmount(b.outstanding, lang);
          const tip = `${cell.code}\n${amount} ${labels.currency}\n${b.owingFlats} / ${b.totalFlats} ${labels.flats}`;
          const select = () => onSelect(cell.code);
          return (
            <g
              key={cell.code}
              tabIndex={0}
              role="button"
              data-tip={tip}
              aria-pressed={on}
              aria-label={`${cell.code}. ${amount} ${labels.currency}. ${b.owingFlats} / ${b.totalFlats} ${labels.flats}`}
              style={{ cursor: 'pointer', outline: 'none' }}
              onClick={select}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  select();
                }
              }}
            >
              <rect
                x={cell.x}
                y={cell.y}
                width={cell.w}
                height={cell.h}
                rx={10}
                style={{ fill: `color-mix(in srgb, var(--chart-a4) ${cell.intensity}%, var(--color-muted))` }}
                stroke={on ? 'var(--color-primary)' : 'var(--color-border)'}
                strokeWidth={on ? 2.5 : 1}
              />
              {[0, 1, 2, 3, 4].map((f) => {
                const ly = cell.y + cell.h - 14 - (f * (cell.h - 34)) / 5;
                return (
                  <line
                    key={f}
                    x1={cell.x + 10}
                    x2={cell.x + cell.w - 10}
                    y1={ly}
                    y2={ly}
                    stroke="var(--color-background)"
                    opacity={0.25}
                  />
                );
              })}
              <text x={cell.x + 10} y={cell.y + 22} style={{ ...STRONG_TEXT, fontSize: narrow ? 14 : 18, fontWeight: 600 }}>
                {cell.code}
              </text>
              {narrow ? (
                <>
                  <text x={cell.x + 10} y={cell.y + cell.h - 24} style={{ ...AXIS_TEXT, ...NUM }}>
                    {compact(geo(b.outstanding))}
                  </text>
                  <text x={cell.x + 10} y={cell.y + cell.h - 9} style={{ ...AXIS_TEXT, ...NUM }}>
                    {b.owingFlats}/{b.totalFlats}
                  </text>
                </>
              ) : (
                <text x={cell.x + 12} y={cell.y + cell.h - 10} style={{ ...AXIS_TEXT, ...NUM }}>
                  {compact(geo(b.outstanding))} · {b.owingFlats}/{b.totalFlats}
                </text>
              )}
            </g>
          );
        })}
        {buildings.length === 0 ? (
          <text x={w / 2} y={height / 2} textAnchor="middle" style={AXIS_TEXT}>
            {labels.empty}
          </text>
        ) : null}
      </svg>
      <SrTable
        caption={labels.title}
        head={[labels.building, labels.outstanding, labels.owing]}
        rows={buildings.map((b) => ({
          key: b.building,
          cells: [b.building, formatDecimalAmount(b.outstanding, lang, 2), `${b.owingFlats} / ${b.totalFlats}`],
        }))}
      />
    </div>
  );
}
