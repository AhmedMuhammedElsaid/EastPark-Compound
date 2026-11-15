import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import {
  BarsBilledCollected,
  CompoundMap,
  Donut,
  HBars,
  Ring,
  Sparkline,
  StackedBar,
} from '@/components/finance/charts';
import { compoundLayout } from '@/components/finance/charts/compound-layout';
import { donutSlices, ringArc } from '@/components/finance/charts/geometry';
import en from '@/translations/en.json';
import ar from '@/translations/ar.json';

const h = React.createElement;
const THEMES = ['dark', 'light'] as const;
const LANGS = ['en', 'ar'] as const;

/** Themes are CSS: dark is :root, light is the `.light` class on <html>. Render under both. */
function inTheme(theme: (typeof THEMES)[number], node: React.ReactElement): string {
  return renderToStaticMarkup(h('div', { className: theme === 'light' ? 'light' : '' }, node));
}

function expectTokensOnly(html: string) {
  expect(html).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  expect(html).not.toMatch(/rgba?\(/);
}

const months = ['2025-12', '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11'];
const billed = months.map((period, i) => ({ period, amount: `${468000 + i * 4000}.00` }));
const collected = months.map((period, i) => ({ period, amount: i === 11 ? '-12500.00' : `${420000 + i * 3000}.50` }));

const barLabels = { title: 'Billed vs collected', billed: 'Billed', collected: 'Collected', month: 'Month', rate: 'Rate', empty: 'No data yet' };
const mapLabels = {
  title: 'Map', aria: 'Compound plan', gate: 'Main gate', flats: 'flats', currency: 'EGP', building: 'Building',
  outstanding: 'Outstanding', owing: 'Owing', empty: 'No data yet',
};
const buildings = [
  { building: 'B2', totalFlats: 52, owingFlats: 19, outstanding: '189000.00' },
  { building: 'A1', totalFlats: 52, owingFlats: 18, outstanding: '168000.00' },
  { building: 'C1', totalFlats: 60, owingFlats: 26, outstanding: '254000.00' },
];

describe('geometry', () => {
  it('clamps the ring arc but keeps null as an empty track', () => {
    expect(ringArc(150, 100)).toBe(100);
    expect(ringArc(-5, 100)).toBe(0);
    expect(ringArc(null, 100)).toBe(0);
    expect(ringArc(87.4, 100)).toBeCloseTo(87.4);
  });

  it('never gives a negative gross a slice', () => {
    const slices = donutSlices([{ key: 'a', value: -50 }, { key: 'b', value: 100 }], 200);
    expect(slices[0]!.length).toBe(0);
    expect(slices[1]!.length).toBe(200);
    expect(donutSlices([{ key: 'a', value: 0 }], 200)[0]!.length).toBe(0);
  });

  it('lays buildings out in a grid by sorted code, four per row', () => {
    const layout = compoundLayout(['B2', 'A1', 'A2', 'C1', 'D1']);
    expect(layout.get('A1')).toEqual({ row: 0, col: 0 });
    expect(layout.get('C1')).toEqual({ row: 0, col: 3 });
    expect(layout.get('D1')).toEqual({ row: 1, col: 0 });
  });
});

describe.each(THEMES)('finance charts in the %s theme', (theme) => {
  it.each(LANGS)('Sparkline renders its points (%s)', (lang) => {
    const html = inTheme(theme, h(Sparkline, {
      lang, label: 'Outstanding trend', columns: ['Month', 'Value'],
      points: [{ label: '2026-09', value: '1000.00' }, { label: '2026-10', value: '-250.00' }, { label: '2026-11', value: '1284000.00' }],
    }));
    expect(html).toContain('aria-label="Outstanding trend"');
    expect(html).toContain('var(--chart-1)');
    expect(html).toContain('sr-only');
    expect(html).not.toContain('NaN');
    expectTokensOnly(html);
  });

  it('Sparkline survives empty and flat series', () => {
    const empty = inTheme(theme, h(Sparkline, { lang: 'en', label: 'x', columns: ['a', 'b'], points: [] }));
    expect(empty).not.toContain('NaN');
    const flat = inTheme(theme, h(Sparkline, { lang: 'en', label: 'x', columns: ['a', 'b'], points: [{ label: 'a', value: '5.00' }, { label: 'b', value: '5.00' }] }));
    expect(flat).not.toContain('NaN');
  });

  it.each(LANGS)('Ring prints the true rate and clamps the arc (%s)', (lang) => {
    const over = inTheme(theme, h(Ring, { rate: '112.5', lang, caption: 'Collection rate', size: 220 }));
    const C = 2 * Math.PI * (220 / 2 - 18);
    expect(over).toContain(`stroke-dasharray="${C} ${C}"`);
    expect(over).toMatch(lang === 'en' ? /112\.5%/ : /١١٢٫٥%/);
    expectTokensOnly(over);
  });

  it('Ring shows a dash and an empty arc for a null rate', () => {
    const html = inTheme(theme, h(Ring, { rate: null, lang: 'en', caption: 'Collection rate' }));
    expect(html).toContain('—');
    expect(html).toContain('stroke-dasharray="0 ');
  });

  it.each(LANGS)('BarsBilledCollected renders 12 months with a hidden table (%s)', (lang) => {
    const html = inTheme(theme, h(BarsBilledCollected, { billed, collected, lang, labels: barLabels, width: 720 }));
    expect(html.match(/class="fc-bar"/g)).toHaveLength(24);
    expect(html).toContain('aria-label="Billed vs collected"');
    expect((html.match(/<tr>/g) ?? []).length).toBe(13);
    expect(html).toContain('var(--chart-1)');
    expect(html).not.toContain('NaN');
    expectTokensOnly(html);
  });

  it('BarsBilledCollected draws a negative month below the zero line', () => {
    const html = inTheme(theme, h(BarsBilledCollected, { billed, collected, lang: 'en', labels: barLabels, width: 720 }));
    // The last collected bar is negative: a real, positive-height rect that starts at the baseline.
    const rects = [...html.matchAll(/<rect class="fc-bar" x="[\d.]+" y="([\d.]+)" width="[\d.]+" height="([\d.]+)"/g)];
    const lastCollected = rects[rects.length - 1]!;
    expect(Number(lastCollected[2])).toBeGreaterThan(0);
    expect(html).toContain('-12,500');
  });

  it('BarsBilledCollected shows the empty state for all-zero data', () => {
    const zero = months.map((period) => ({ period, amount: '0.00' }));
    const html = inTheme(theme, h(BarsBilledCollected, { billed: zero, collected: zero, lang: 'en', labels: barLabels, width: 720 }));
    expect(html).toContain('No data yet');
    expect(html).not.toContain('NaN');
  });

  const methods = [
    { method: 'CASH', gross: '148000.00', reversed: '-5000.00', net: '143000.00' },
    { method: 'BANK_TRANSFER', gross: '171000.00', reversed: '0.00', net: '171000.00' },
    { method: 'INSTAPAY', gross: '96000.00', reversed: '0.00', net: '96000.00' },
    { method: 'CHEQUE', gross: '26000.00', reversed: '-26000.00', net: '0.00' },
  ];
  const donutLabels = {
    title: 'Collections by method', currency: 'EGP', reversed: 'Reversed', net: 'Net', empty: 'No receipts', item: 'Method', gross: 'Received',
    method: { CASH: 'Cash', BANK_TRANSFER: 'Bank transfer', INSTAPAY: 'InstaPay', CHEQUE: 'Cheque' },
  };

  it.each(LANGS)('Donut renders gross slices, the reversed line and net (%s)', (lang) => {
    const html = inTheme(theme, h(Donut, { methods, lang, labels: donutLabels }));
    expect(html.match(/<circle[^>]*stroke-dasharray/g)).toHaveLength(4);
    expect(html).toContain('Reversed');
    expect(html).toContain('Net');
    expect(html).toContain('Bank transfer');
    expect(html).toContain('sr-only');
    expect(html.match(/data-tip=/g)).toHaveLength(4);
    expect(html).not.toContain('NaN');
    expectTokensOnly(html);
  });

  it('Donut totals reversals and net in the legend line', () => {
    const html = inTheme(theme, h(Donut, { methods, lang: 'en', labels: donutLabels }));
    expect(html).toContain('-31,000');
    expect(html).toContain('410,000');
  });

  it('Donut shows the empty state when every gross is 0', () => {
    const zero = methods.map((m) => ({ ...m, gross: '0.00' }));
    const html = inTheme(theme, h(Donut, { methods: zero, lang: 'en', labels: donutLabels }));
    expect(html).toContain('No receipts');
    expect(html).not.toMatch(/<circle[^>]*stroke-dasharray/);
  });

  it.each(LANGS)('StackedBar renders each bucket with its share (%s)', (lang) => {
    const items = [
      { key: 'current', label: 'Current–30', amount: '412000.00', color: 'var(--chart-a1)' },
      { key: 'd31_60', label: '31–60', amount: '301000.00', color: 'var(--chart-a2)' },
      { key: 'd61_90', label: '61–90', amount: '228000.00', color: 'var(--chart-a3)' },
      { key: 'over90', label: 'Over 90', amount: '343000.00', color: 'var(--chart-a4)' },
    ];
    const html = inTheme(theme, h(StackedBar, { items, lang, labels: { title: 'Debt aging', currency: 'EGP', empty: 'No overdue flats', item: 'Bucket', amount: 'Amount' } }));
    expect(html).toContain('flex:412000');
    expect(html).toContain('sr-only');
    expect(html).toContain('32.1%');
    expect(html).toContain('var(--chart-a4)');
    expectTokensOnly(html);
  });

  it('StackedBar handles zero and negative buckets', () => {
    const items = [
      { key: 'a', label: 'A', amount: '0.00', color: 'var(--chart-a1)' },
      { key: 'b', label: 'B', amount: '-10.00', color: 'var(--chart-a2)' },
    ];
    const html = inTheme(theme, h(StackedBar, { items, lang: 'en', labels: { title: 'T', currency: 'EGP', empty: 'No overdue flats', item: 'Bucket', amount: 'Amount' } }));
    expect(html).toContain('No overdue flats');
    expect(html).not.toContain('NaN');
  });

  it.each(LANGS)('HBars renders one bar per floor (%s)', (lang) => {
    const items = [
      { key: 'G', label: 'G', amount: '5000.00' },
      { key: '1', label: '1', amount: '12000.00' },
      { key: '2', label: '2', amount: '-250.00' },
    ];
    const html = inTheme(theme, h(HBars, { items, lang, width: 320, labels: { title: 'Outstanding by floor', label: 'Floor', value: 'Outstanding', empty: 'No data' } }));
    expect(html.match(/data-tip=/g)).toHaveLength(3);
    expect(html).toContain('var(--chart-a3)');
    expect(html).toContain('var(--chart-a4)');
    expect(html).toContain('sr-only');
    expectTokensOnly(html);
  });

  it.each(LANGS)('CompoundMap renders every building as a button and marks the selection (%s)', (lang) => {
    const html = inTheme(theme, h(CompoundMap, { buildings, lang, selected: 'C1', onSelect: () => {}, labels: mapLabels, width: 720 }));
    expect(html.match(/role="button"/g)).toHaveLength(3);
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(1);
    expect(html).toContain('tabindex="0"');
    expect(html).toContain('color-mix(in srgb, var(--chart-a4)');
    expect(html).not.toContain('NaN');
    expectTokensOnly(html);
  });

  it('CompoundMap renders its narrow variant and the empty state', () => {
    const narrow = inTheme(theme, h(CompoundMap, { buildings, lang: 'en', selected: null, onSelect: () => {}, labels: mapLabels, width: 360 }));
    expect(narrow).not.toContain('NaN');
    const empty = inTheme(theme, h(CompoundMap, { buildings: [], lang: 'en', selected: null, onSelect: () => {}, labels: mapLabels, width: 720 }));
    expect(empty).toContain('No data yet');
  });
});

describe('tokens and translations', () => {
  const css = readFileSync(fileURLToPath(new URL('../app/globals.css', import.meta.url)), 'utf8');

  it('defines the chart palette for dark (:root) and light (.light)', () => {
    for (const token of ['--chart-1', '--chart-2', '--chart-3', '--chart-4', '--chart-5', '--chart-a1', '--chart-a2', '--chart-a3', '--chart-a4']) {
      const matches = css.match(new RegExp(`${token}:`, 'g')) ?? [];
      expect(matches.length, token).toBe(2);
    }
  });

  it('has the same finance.charts keys in Arabic and English', () => {
    expect(Object.keys(ar.finance.charts).sort()).toEqual(Object.keys(en.finance.charts).sort());
  });
});
