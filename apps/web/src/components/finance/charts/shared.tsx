'use client';

import * as React from 'react';

export type ChartLang = 'ar' | 'en';

/** SVG text style from the sample-4 `svg text` rule, on theme tokens only. */
export const AXIS_TEXT: React.CSSProperties = { fill: 'var(--color-muted-foreground)', fontSize: 11 };
export const STRONG_TEXT: React.CSSProperties = { fill: 'var(--color-foreground)' };
export const NUM: React.CSSProperties = { fontVariantNumeric: 'tabular-nums' };

/**
 * Width of the element behind `ref`, falling back to `fallback` on the server and before the first
 * measure. A fixed `width` prop wins and skips observation.
 */
export function useChartWidth(fixed: number | undefined, fallback: number) {
  const ref = React.useRef<HTMLDivElement | null>(null);
  const [measured, setMeasured] = React.useState(fallback);
  React.useEffect(() => {
    const el = ref.current;
    if (fixed !== undefined || !el || typeof ResizeObserver === 'undefined') return;
    const update = () => {
      const w = Math.floor(el.clientWidth);
      if (w > 0) setMeasured(w);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [fixed]);
  return { ref, width: fixed ?? measured };
}

export type SrRow = { key: string; cells: string[] };

/** The visually hidden table equivalent every chart carries for screen readers. */
export function SrTable({ caption, head, rows }: { caption: string; head: string[]; rows: SrRow[] }) {
  return (
    <table className="sr-only">
      <caption>{caption}</caption>
      <thead>
        <tr>
          {head.map((h) => (
            <th key={h} scope="col">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.key}>
            {row.cells.map((cell, i) => (
              <td key={i}>{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
