import { formatDecimalAmount } from '@/lib/finance/money';

import { compact, donutSlices, geo, pct } from './geometry';
import { NUM, SrTable, type ChartLang } from './shared';
import { tipProps, useChartTooltip } from './tooltip';


export type DonutMethod = {
  method: string;
  gross: string;
  reversed: string;
  net: string;
};

const METHOD_COLOR: Record<string, string> = {
  CASH: 'var(--chart-1)',
  BANK_TRANSFER: 'var(--chart-3)',
  INSTAPAY: 'var(--chart-2)',
  CHEQUE: 'var(--chart-4)',
};
const FALLBACK_COLOR = 'var(--chart-5)';

export type DonutProps = {
  methods: DonutMethod[];
  lang: ChartLang;
  labels: {
    title: string;
    currency: string;
    reversed: string;
    net: string;
    item: string;
    gross: string;
    empty: string;
    /** Display name per method code. */
    method: Record<string, string>;
  };
  size?: number;
};

/**
 * sample-4 `donut` of gross receipts per method. Gross is never negative, so the ring never is.
 * Below it: the month's reversals ("Reversed: -X") and the net total (spec section 4). When every
 * gross is 0 the empty state replaces the ring. The legend list is the screen-reader equivalent.
 */
export function Donut({ methods, lang, labels, size = 170 }: DonutProps) {
  useChartTooltip();
  const r = size / 2 - 14;
  const C = 2 * Math.PI * r;
  const slices = donutSlices(
    methods.map((m) => ({ key: m.method, value: geo(m.gross) })),
    C,
  );
  const totalGross = methods.reduce((s, m) => s + Math.max(0, geo(m.gross)), 0);
  const name = (m: string) => labels.method[m] ?? m;
  // Display sums stay decimal strings: add in whole piasters.
  const cents = (v: string) => Math.round(geo(v) * 100);
  const fmtCents = (c: number) => formatDecimalAmount(`${c < 0 ? '-' : ''}${Math.floor(Math.abs(c) / 100)}.${String(Math.abs(c) % 100).padStart(2, '0')}`, lang);
  const reversedText = fmtCents(methods.reduce((s, m) => s + cents(m.reversed), 0));
  const netText = fmtCents(methods.reduce((s, m) => s + cents(m.net), 0));
  const summary = methods.map((m) => `${name(m.method)}: ${formatDecimalAmount(m.gross, lang)}`).join(', ');
  const empty = totalGross === 0;
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
      <div dir="ltr" className="shrink-0">
        <svg width={size} height={size} role="img" aria-label={`${labels.title}. ${summary}`} focusable="false">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-muted)" strokeWidth={16} />
          {empty
            ? null
            : slices.map((s) => (
                <circle
                  key={s.key}
                  cx={size / 2}
                  cy={size / 2}
                  r={r}
                  fill="none"
                  stroke={METHOD_COLOR[s.key] ?? FALLBACK_COLOR}
                  strokeWidth={16}
                  strokeDasharray={`${Math.max(0, s.length - 2)} ${C}`}
                  strokeDashoffset={-s.offset}
                  transform={`rotate(-90 ${size / 2} ${size / 2})`}
                  {...tipProps(`${name(s.key)}\n${formatDecimalAmount(methods.find((m) => m.method === s.key)?.gross ?? '0', lang)} ${labels.currency} (${s.share.toFixed(1)}%)`)}
                />
              ))}
          {empty ? (
            <text x="50%" y="50%" textAnchor="middle" style={{ fontSize: 12, fill: 'var(--color-muted-foreground)' }}>
              {labels.empty}
            </text>
          ) : (
            <>
              <text
                x="50%"
                y="48%"
                textAnchor="middle"
                style={{ ...NUM, fill: 'var(--color-foreground)', fontSize: 20, fontWeight: 300 }}
              >
                {compact(totalGross)}
              </text>
              <text x="50%" y="48%" dy={18} textAnchor="middle" style={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }}>
                {labels.currency}
              </text>
            </>
          )}
        </svg>
      </div>
      <div className="min-w-0 flex-1 self-stretch">
        <ul className="divide-y divide-border">
          {methods.map((m) => (
            <li key={m.method} className="flex items-center justify-between gap-3 py-2 text-[length:var(--text-body)]">
              <span className="flex items-center gap-2">
                <i
                  aria-hidden="true"
                  className="inline-block size-2.5 rounded-sm"
                  style={{ background: METHOD_COLOR[m.method] ?? FALLBACK_COLOR }}
                />
                {name(m.method)}
              </span>
              <span className="tabular-nums" dir="ltr">
                {formatDecimalAmount(m.gross, lang)}{' '}
                <small className="text-muted-foreground">{pct(Math.max(0, geo(m.gross)), totalGross)}%</small>
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-2 flex flex-wrap justify-between gap-x-4 text-[length:var(--text-caption)] text-muted-foreground">
          <span>
            {labels.reversed}: <span className="tabular-nums" dir="ltr">{reversedText}</span>
          </span>
          <span>
            {labels.net}: <span className="tabular-nums" dir="ltr">{netText}</span>{' '}
            {labels.currency}
          </span>
        </p>
      </div>
      <SrTable
        caption={labels.title}
        head={[labels.item, labels.gross, labels.reversed, labels.net]}
        rows={methods.map((m) => ({
          key: m.method,
          cells: [name(m.method), formatDecimalAmount(m.gross, lang, 2), formatDecimalAmount(m.reversed, lang, 2), formatDecimalAmount(m.net, lang, 2)],
        }))}
      />
    </div>
  );
}
