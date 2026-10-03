import { Lock } from 'lucide-react';

/** Small gold-outlined "Soon" marker used on every teaser surface. */
export function SoonPill({ label, className = '' }: { label: string; className?: string }) {
  return (
    <span
      className={`inline-flex min-h-7 items-center gap-1.5 rounded-full border border-primary/60 bg-card px-2.5 text-[length:var(--text-caption)] font-bold text-primary ${className}`}
    >
      <Lock aria-hidden="true" className="size-3.5" />
      {label}
    </span>
  );
}

/**
 * Decorative light sweep plus the hint line for a sealed teaser card. Place inside an element with
 * the `sealed-card` class. On devices with hover the hint fades in on hover/focus; on touch devices
 * it is always visible (there is no hover to reveal it).
 */
export function SealedHint({ hint }: { hint: string }) {
  return (
    <>
      <span aria-hidden="true" className="sealed-sweep pointer-events-none absolute inset-0" />
      <span className="sealed-hint mt-4 block border-t border-border pt-3 text-[length:var(--text-label)] leading-5 text-muted-foreground">
        {hint}
      </span>
    </>
  );
}
