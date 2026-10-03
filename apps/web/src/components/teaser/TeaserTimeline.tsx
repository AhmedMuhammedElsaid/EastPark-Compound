import { Check, Lock } from 'lucide-react';

export type TimelineStatus = 'live' | 'preparing' | 'next' | 'step';

export type TimelineItem = {
  key: string;
  label: string;
  /** Small line above the label: the phase status ("Live", "Preparing", …) or a step's kicker. */
  kicker?: string;
  /** Optional sentence under the label (join-flow steps). */
  caption?: string;
  status: TimelineStatus;
};

/**
 * The teaser timeline shared by the resident home (rollout phases) and the public landing (join
 * steps). Vertical on phones; horizontal from 640px, or from 1024px with `wideFrom="lg"` (four
 * captioned steps are too cramped at tablet width). `live` phases get a check, `preparing` pulses
 * and charges toward the next phase, `next` is locked, and `step` shows its number. Labels only —
 * never dates or progress numbers. Must sit inside a `.home-hero` surface (it supplies the colours).
 */
export function TeaserTimeline({
  items,
  label,
  wideFrom = 'sm',
}: {
  items: TimelineItem[];
  label: string;
  wideFrom?: 'sm' | 'lg';
}) {
  const wide = wideFrom === 'lg';
  return (
    <ol
      aria-label={label}
      className={`home-timeline mt-4 grid ${
        wide ? 'home-timeline--lg lg:grid-cols-4 lg:gap-4' : 'sm:grid-cols-3 sm:gap-4'
      }`}
    >
      {items.map(({ key, label: itemLabel, kicker, caption, status }, index) => (
        <li
          key={key}
          data-status={status}
          aria-current={status === 'preparing' ? 'step' : undefined}
          className={`home-timeline-step relative flex min-w-0 gap-4 pb-7 last:pb-0 ${
            wide ? 'lg:flex-col lg:gap-3 lg:pb-0' : 'sm:flex-col sm:gap-3 sm:pb-0'
          }`}
        >
          <span className="home-timeline-node relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full text-[length:var(--text-label)] font-bold">
            {status === 'live' ? (
              <Check aria-hidden="true" className="size-4" />
            ) : status === 'preparing' ? (
              <span aria-hidden="true" className="home-timeline-pulse block size-2.5 rounded-full" />
            ) : status === 'next' ? (
              <Lock aria-hidden="true" className="size-3.5" />
            ) : (
              <span aria-hidden="true">{index + 1}</span>
            )}
          </span>
          <span className={`min-w-0 pt-1 ${wide ? 'lg:pt-0' : 'sm:pt-0'}`}>
            {kicker && (
              <span className="home-timeline-status block text-[length:var(--text-caption)] font-semibold">{kicker}</span>
            )}
            <span className="home-hero-title mt-0.5 block text-[length:var(--text-body)] font-bold leading-5">
              {itemLabel}
            </span>
            {caption && (
              <span className="home-hero-lede mt-1.5 block text-[length:var(--text-label)] leading-6">{caption}</span>
            )}
          </span>
        </li>
      ))}
    </ol>
  );
}
