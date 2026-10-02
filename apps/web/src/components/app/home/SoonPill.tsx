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
