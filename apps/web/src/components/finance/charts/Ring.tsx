import { NUM, SrTable, type ChartLang } from './shared';
import { geo, ringArc } from './geometry';

export type RingProps = {
  /** One-decimal percentage string (`"87.4"`) or null when nothing was billed. */
  rate: string | null;
  lang: ChartLang;
  /** Caption under the number, e.g. "Collection rate". */
  caption: string;
  size?: number;
  strokeWidth?: number;
};

/**
 * sample-4 `ring`. The arc clamps to 0-100 %, the number printed is the true rate, and a null rate
 * prints an em dash with an empty track.
 */
export function Ring({ rate, lang, caption, size = 220, strokeWidth = 18 }: RingProps) {
  const r = size / 2 - strokeWidth;
  const C = 2 * Math.PI * r;
  const value = rate === null ? null : geo(rate);
  const arc = ringArc(value, C);
  const printed =
    rate === null
      ? '—'
      : `${new Intl.NumberFormat(lang === 'ar' ? 'ar-EG' : 'en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(rate as unknown as number)}%`;
  return (
    <div className="inline-block" dir="ltr">
      <svg width={size} height={size} role="img" aria-label={`${caption}: ${printed}`} focusable="false">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-muted)" strokeWidth={strokeWidth} />
        <circle
          className="fc-ring-arc"
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--chart-1)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${arc} ${C}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        <text
          x="50%"
          y="48%"
          textAnchor="middle"
          style={{ ...NUM, fontSize: size / 4.4, fill: 'var(--color-foreground)', fontWeight: 300 }}
        >
          {printed}
        </text>
        <text
          x="50%"
          y="48%"
          dy={size / 6}
          textAnchor="middle"
          style={{ fontSize: 12, fill: 'var(--color-muted-foreground)' }}
        >
          {caption}
        </text>
      </svg>
      <SrTable caption={caption} head={[caption]} rows={[{ key: 'rate', cells: [printed] }]} />
    </div>
  );
}
