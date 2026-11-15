/*
 * Chart geometry for the finance dashboard, ported from
 * Documentation/mockups/finance-dashboard/sample-4.html. Money arrives as decimal strings; the
 * conversion to `number` happens here, for geometry only. Displayed money goes through
 * `formatDecimalAmount` (lib/finance/money.ts), never through these numbers.
 */

/** Geometry-only parse of a backend decimal string. Anything unparsable is 0. */
export function geo(value: string | null | undefined): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/** `1.5M` / `412k` axis labels (sample-4 `k`), sign preserved. */
export function compact(n: number): string {
  const a = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (a >= 1e6) return `${sign}${(a / 1e6).toFixed(2).replace(/\.?0+$/, '')}M`;
  return `${sign}${Math.round(a / 1000)}k`;
}

/** Rounds a positive span up to 1, 2, 2.5, 5 or 10 times a power of ten. */
export function niceCeil(value: number): number {
  if (value <= 0) return 1;
  const pow = 10 ** Math.floor(Math.log10(value));
  for (const step of [1, 2, 2.5, 5, 10]) if (value <= step * pow) return step * pow;
  return 10 * pow;
}

export type Scale = { min: number; max: number; ticks: number[]; y: (v: number) => number };

/** Vertical scale that always contains zero, so negative months grow down from the baseline. */
export function valueScale(values: number[], top: number, height: number): Scale {
  const hi = Math.max(0, ...values);
  const lo = Math.min(0, ...values);
  const max = hi > 0 ? niceCeil(hi) : 0;
  const min = lo < 0 ? -niceCeil(-lo) : 0;
  const span = max - min || 1;
  const ticks: number[] = [];
  const step = (max - min) / 3 || 1;
  for (let i = 0; i <= 3; i++) ticks.push(min + step * i);
  return { min, max, ticks, y: (v) => top + height - ((v - min) / span) * height };
}

export type Pt = [number, number];

/** Sparkline points, sample-4 `spark`: x inset 3px, y inset 4px, flat series sits low. */
export function sparkPoints(values: number[], w: number, h: number): Pt[] {
  const mn = Math.min(...values);
  const mx = Math.max(...values);
  const last = Math.max(values.length - 1, 1);
  return values.map((v, i) => [(i * (w - 6)) / last + 3, h - 4 - ((v - mn) / (mx - mn || 1)) * (h - 10)]);
}

export function linePath(points: Pt[]): string {
  return points.map((q, i) => `${i ? 'L' : 'M'}${q[0].toFixed(1)} ${q[1].toFixed(1)}`).join('');
}

/** Ring arc length: the rate is clamped to 0-100 % here; the printed rate stays the true one. */
export function ringArc(rate: number | null, circumference: number): number {
  if (rate === null || !Number.isFinite(rate)) return 0;
  return (Math.min(100, Math.max(0, rate)) / 100) * circumference;
}

export type DonutSlice = { key: string; length: number; offset: number; share: number };

/** Donut slices of `gross` only (never negative), laid end to end. */
export function donutSlices(values: { key: string; value: number }[], circumference: number): DonutSlice[] {
  const positive = values.map((v) => ({ key: v.key, value: Math.max(0, v.value) }));
  const total = positive.reduce((s, v) => s + v.value, 0);
  let off = 0;
  return positive.map((v) => {
    const length = total > 0 ? (v.value / total) * circumference : 0;
    const slice = { key: v.key, length, offset: off, share: total > 0 ? (v.value / total) * 100 : 0 };
    off += length;
    return slice;
  });
}

/** `YYYY-MM` to a month name, in UTC so no zone shifts the month. */
export function monthName(period: string, lang: 'ar' | 'en', style: 'short' | 'narrow' | 'long' = 'short'): string {
  const date = new Date(`${period}-01T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return period;
  return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG' : 'en-GB', { month: style, timeZone: 'UTC' }).format(date);
}

/** One-decimal percentage of part over whole, "0.0" when whole is 0. */
export function pct(part: number, whole: number): string {
  return whole > 0 ? ((part / whole) * 100).toFixed(1) : '0.0';
}

export type MapCell = { code: string; x: number; y: number; w: number; h: number; intensity: number };
export type MapInput = { code: string; totalFlats: number; outstanding: number };

/**
 * Compound map geometry, sample-4 `mapSvg`: 4 columns, rows from the layout file, the top row
 * bottom-aligned against the road, later rows top-aligned. Height scales with flat count, tint with
 * arrears per flat (normalised across buildings, 8-55 % like the mockup).
 */
export function mapCells(
  items: MapInput[],
  positions: Map<string, { row: number; col: number }>,
  width: number,
): { cells: MapCell[]; height: number; roads: number[] } {
  const cols = 4;
  const narrow = width < 500;
  const gap = narrow ? 8 : 14;
  const rows = Math.max(1, ...items.map((b) => (positions.get(b.code)?.row ?? 0) + 1));
  const H = narrow ? 260 : 330;
  const rowH = (H - gap * (rows + 1)) / rows;
  const bw = (width - gap * (cols - 1)) / cols;
  const maxFlats = Math.max(1, ...items.map((b) => b.totalFlats));
  const ratios = items.map((b) => (b.totalFlats > 0 ? b.outstanding / b.totalFlats : 0));
  const rMin = Math.min(0, ...ratios);
  const rMax = Math.max(1, ...ratios);
  const cells = items.map((b, i) => {
    const pos = positions.get(b.code) ?? { row: 0, col: 0 };
    const hh = rowH * (0.7 + 0.3 * (b.totalFlats / maxFlats));
    const rowTop = gap + pos.row * (rowH + gap);
    const y = pos.row === 0 ? rowTop + rowH - hh : rowTop;
    const ratio = ratios[i] ?? 0;
    const intensity = Math.round(8 + Math.max(0, Math.min(1, (ratio - rMin) / (rMax - rMin || 1))) * 47);
    return { code: b.code, x: pos.col * (bw + gap), y, w: bw, h: hh, intensity };
  });
  const roads = Array.from({ length: rows - 1 }, (_, r) => gap + (r + 1) * (rowH + gap) - gap / 2);
  return { cells, height: H, roads };
}
