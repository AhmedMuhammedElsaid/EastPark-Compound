import type { DashBuilding, DashMethod, DashMoney } from "./types";

import { compactParts } from "@/lib/decimal-money";
import { formatNumber } from "@/lib/format-number";

import { layoutCompound } from "./compound-layout";

/** Decimal string -> number, for geometry only (never for display of exact money). */
export function num(value: DashMoney | null | undefined): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/** "12.5K" / "1.3M" / "840", locale digits; sign kept. Exact: computed from piasters, not floats. */
export function compactMoney(value: DashMoney | number | null | undefined, language: string): string {
  const parts = compactParts(value);
  const sign = parts.negative ? "-" : "";
  if (parts.unit === "")
    return `${sign}${formatNumber(Number(parts.whole), language)}`;
  const digits = Number(`${parts.whole}.${parts.tenth}`).toLocaleString(language === "ar" ? "ar-EG" : "en-US", { maximumFractionDigits: 1 });
  return `${sign}${digits}${language === "ar" ? (parts.unit === "M" ? " م" : " ألف") : parts.unit}`;
}

/** Percentage for display: "87.4%" with locale digits; null -> em dash. */
export function percentLabel(rate: string | null | undefined, language: string): string {
  if (rate === null || rate === undefined)
    return "—";
  const n = Number(rate);
  if (!Number.isFinite(n))
    return "—";
  return `${n.toLocaleString(language === "ar" ? "ar-EG" : "en-US", { maximumFractionDigits: 1 })}%`;
}

export type Point = { x: number; y: number };

/** Sparkline points inside a `w x h` box (mockup `spark`): 3 px side padding, 4 px bottom, 6 px top. */
export function sparkPoints(values: readonly number[], w: number, h: number): Point[] {
  if (values.length === 0)
    return [];
  const mn = Math.min(...values);
  const mx = Math.max(...values);
  const span = mx - mn || 1;
  const step = values.length > 1 ? (w - 6) / (values.length - 1) : 0;
  return values.map((v, i) => ({
    x: values.length > 1 ? i * step + 3 : w / 2,
    y: h - 4 - ((v - mn) / span) * (h - 10),
  }));
}

export function sparkPath(points: readonly Point[]): string {
  return points.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join("");
}

/** Ring arc: the rate is clamped to 0-100 for the arc only; the label prints the true rate. */
export function ringFraction(rate: string | null | undefined): number {
  if (rate === null || rate === undefined)
    return 0;
  const n = Number(rate);
  if (!Number.isFinite(n))
    return 0;
  return Math.min(100, Math.max(0, n)) / 100;
}

export type Tick = { value: number; y: number };

/** A "nice" 1/2/5 step so a scale has about 3 intervals covering [min, max] and always contains 0. */
export function niceScale(min: number, max: number): { lo: number; hi: number; ticks: number[] } {
  const rawLo = Math.min(0, min);
  const rawHi = Math.max(0, max);
  if (rawLo === 0 && rawHi === 0)
    return { lo: 0, hi: 1, ticks: [0, 1] };
  const rough = (rawHi - rawLo) / 3;
  const pow = 10 ** Math.floor(Math.log10(rough));
  const f = rough / pow;
  const step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * pow;
  const lo = Math.floor(rawLo / step) * step;
  const hi = Math.ceil(rawHi / step) * step;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + step / 1000; v += step)
    ticks.push(Math.round(v * 100) / 100);
  return { lo, hi, ticks };
}

export type BarColumn = {
  index: number;
  x: number;
  billed: { y: number; height: number };
  collected: { y: number; height: number };
};

export type BarsLayout = {
  ticks: Tick[];
  zeroY: number;
  barWidth: number;
  columnWidth: number;
  columns: BarColumn[];
  inner: { left: number; right: number; top: number; bottom: number; width: number; height: number };
};

const BAR_MARGIN = { l: 38, r: 6, t: 8, b: 24 };

/** Bars grow up from the zero baseline for positive values and down for negative ones. */
export function barsLayout(billed: readonly number[], collected: readonly number[], size: { w: number; h: number }): BarsLayout {
  const { w, h } = size;
  const m = BAR_MARGIN;
  const iw = Math.max(0, w - m.l - m.r);
  const ih = Math.max(0, h - m.t - m.b);
  const n = Math.max(billed.length, collected.length, 1);
  const { lo, hi, ticks } = niceScale(Math.min(0, ...billed, ...collected), Math.max(0, ...billed, ...collected));
  const span = hi - lo || 1;
  const yOf = (v: number) => m.t + ih - ((v - lo) / span) * ih;
  const zeroY = yOf(0);
  const gw = iw / n;
  const barWidth = Math.max(6, Math.min(18, gw * 0.32));
  const bar = (v: number) => {
    const y = yOf(v);
    return v >= 0 ? { y, height: Math.max(0, zeroY - y) } : { y: zeroY, height: Math.max(0, y - zeroY) };
  };
  const columns: BarColumn[] = Array.from({ length: n }, (_, i) => ({
    index: i,
    x: m.l + gw * i + gw / 2,
    billed: bar(billed[i] ?? 0),
    collected: bar(collected[i] ?? 0),
  }));
  return {
    ticks: ticks.map(value => ({ value, y: yOf(value) })),
    zeroY,
    barWidth,
    columnWidth: gw,
    columns,
    inner: { left: m.l, right: w - m.r, top: m.t, bottom: h - m.b, width: iw, height: ih },
  };
}

export type DonutSegment = { method: DashMethod["method"]; value: number; share: number; offset: number; length: number };

/** Only `gross` is drawn (never negative). */
export function donutSegments(methods: readonly DashMethod[], circumference: number): { total: number; segments: DonutSegment[] } {
  const items = methods.map(m => ({ method: m.method, value: Math.max(0, num(m.gross)) }));
  const total = items.reduce((s, i) => s + i.value, 0);
  let offset = 0;
  const segments = items.map((i) => {
    const length = total > 0 ? (i.value / total) * circumference : 0;
    const seg = { method: i.method, value: i.value, share: total > 0 ? i.value / total : 0, offset, length };
    offset += length;
    return seg;
  });
  return { total, segments };
}

export type StackSegment = { key: string; value: number; x: number; width: number };

/** Stacked bar segments from non-negative values. */
export function stackSegments(items: ReadonlyArray<{ key: string; value: number }>, width: number): StackSegment[] {
  const clean = items.map(i => ({ ...i, value: Math.max(0, i.value) }));
  const total = clean.reduce((s, i) => s + i.value, 0);
  let x = 0;
  return clean.map((i) => {
    const w = total > 0 ? (i.value / total) * width : 0;
    const seg = { key: i.key, value: i.value, x, width: w };
    x += w;
    return seg;
  });
}

export type MapBuilding = {
  code: string;
  row: number;
  col: number;
  x: number;
  y: number;
  width: number;
  height: number;
  intensity: number;
};

const MAP_COLS = 4;
const MAP_GAP = 8;
/** Height of one grid row; two rows reproduce the mockup's 260 dp canvas. */
const MAP_ROW_H = 118;

/**
 * Compound map geometry (mockup `mapSvg`, narrow variant): `ceil(n / 4)` rows (12 buildings = 3 rows), the top
 * row bottom-aligned against the first road and later rows top-aligned. The canvas height and every row's y
 * come from the real row count, so rows never overlap. Building height scales with flat count; red intensity
 * is 8-55 % by outstanding-per-flat relative to the worst building.
 */
export function mapLayout(buildings: readonly DashBuilding[], w: number): { height: number; roadY: number; roadYs: number[]; items: MapBuilding[] } {
  const gap = MAP_GAP;
  const bw = (w - gap * (MAP_COLS - 1)) / MAP_COLS;
  const rowH = MAP_ROW_H;
  const slots = layoutCompound(buildings.map(b => b.building), MAP_COLS);
  const rows = Math.max(1, ...Array.from(slots.values(), s => s.row + 1));
  const pitch = rowH + gap * 2;
  const maxFlats = Math.max(1, ...buildings.map(b => b.totalFlats));
  const ratios = buildings.map(b => (b.totalFlats > 0 ? Math.max(0, num(b.outstanding)) / b.totalFlats : 0));
  const maxRatio = Math.max(...ratios, 0);
  const items = buildings.map((b, i) => {
    const slot = slots.get(b.building) ?? { row: 0, col: 0 };
    const hh = rowH * (0.7 + 0.3 * (b.totalFlats / maxFlats));
    return {
      code: b.building,
      row: slot.row,
      col: slot.col,
      x: slot.col * (bw + gap),
      y: slot.row === 0 ? rowH - hh : slot.row * pitch,
      width: bw,
      height: hh,
      intensity: maxRatio > 0 ? Math.round(8 + (ratios[i] / maxRatio) * 47) : 8,
    };
  });
  const roadYs = Array.from({ length: rows - 1 }, (_, r) => rowH + gap * 1.5 - 3 + r * pitch);
  return { height: rows * rowH + (rows - 1) * gap * 2 + gap, roadY: roadYs[0] ?? 0, roadYs, items };
}

/** Mixes `fg` over `bg` (both `#rrggbb`) at `pct` percent, like CSS color-mix. */
export function mixHex(fg: string, bg: string, pct: number): string {
  const parse = (hex: string) => [1, 3, 5].map(i => Number.parseInt(hex.slice(i, i + 2), 16));
  const a = parse(fg);
  const b = parse(bg);
  const t = pct / 100;
  return `#${a.map((c, i) => Math.round(c * t + b[i] * (1 - t)).toString(16).padStart(2, "0")).join("")}`;
}
