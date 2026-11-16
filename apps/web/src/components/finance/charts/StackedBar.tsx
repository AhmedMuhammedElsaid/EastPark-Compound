import { formatDecimalAmount } from '@/lib/finance/money';

import { geo, pct } from './geometry';
import { SrTable, type ChartLang } from './shared';
import { tipProps, useChartTooltip } from './tooltip';


export type StackedItem = { key: string; label: string; amount: string; color: string };

export type StackedBarProps = {
  items: StackedItem[];
  lang: ChartLang;
  labels: { title: string; currency: string; empty: string; item: string; amount: string };
};

/**
 * sample-4 aging block: one proportional bar plus the legend rows (swatch, label, amount, share).
 * The rows are the screen-reader equivalent (a list of the same figures), so the bar is described
 * as an image and carries no second table. Negative or zero amounts take no width.
 */
export function StackedBar({ items, lang, labels }: StackedBarProps) {
  useChartTooltip();
  const weights = items.map((i) => Math.max(0, geo(i.amount)));
  const total = weights.reduce((s, v) => s + v, 0);
  const summary = items.map((i) => `${i.label}: ${formatDecimalAmount(i.amount, lang)}`).join(', ');
  return (
    <div>
      <div
        role="img"
        aria-label={`${labels.title}. ${summary}`}
        className="flex h-[18px] w-full overflow-hidden rounded-full bg-muted"
        dir="ltr"
      >
        {total > 0
          ? items.map((item, i) => (
              <i
                key={item.key}
                {...tipProps(`${item.label}\n${formatDecimalAmount(item.amount, lang)}`)}
                style={{ flex: weights[i], background: item.color, display: 'block' }}
              />
            ))
          : null}
      </div>
      {total === 0 ? <p className="mt-2 text-[length:var(--text-caption)] text-muted-foreground">{labels.empty}</p> : null}
      <ul className="mt-3 divide-y divide-border">
        {items.map((item, i) => (
          <li key={item.key} className="flex items-center justify-between gap-3 py-2 text-[length:var(--text-body)]">
            <span className="flex items-center gap-2">
              <i
                aria-hidden="true"
                className="inline-block size-2.5 rounded-sm"
                style={{ background: item.color }}
              />
              {item.label}
            </span>
            <span className="tabular-nums" dir="ltr">
              {formatDecimalAmount(item.amount, lang)}{' '}
              <small className="text-muted-foreground">{labels.currency}</small>{' '}
              <small className="text-muted-foreground">{pct(weights[i] ?? 0, total)}%</small>
            </span>
          </li>
        ))}
      </ul>
      <SrTable
        caption={labels.title}
        head={[labels.item, labels.amount]}
        rows={items.map((i) => ({ key: i.key, cells: [i.label, formatDecimalAmount(i.amount, lang, 2)] }))}
      />
    </div>
  );
}
