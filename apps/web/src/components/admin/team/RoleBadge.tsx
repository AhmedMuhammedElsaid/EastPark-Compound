'use client';

import { Lock } from 'lucide-react';

import { roleLabel } from '@/lib/admin/activity-sentence';
import { useTranslation } from '@/lib/i18n';

/**
 * Role tones use a dot + tint only; label text stays in the foreground colour for contrast on dark
 * cards (same rule as the lead status badges).
 */
const TONE: Record<string, { dot: string; tint: string }> = {
  SUPER_ADMIN: { dot: 'bg-primary', tint: 'border-primary/55 bg-primary/14' },
  ADMIN: { dot: 'bg-info', tint: 'border-info/50 bg-info/14' },
  MERCHANT: { dot: 'bg-warning', tint: 'border-warning/45 bg-warning/12' },
  RESIDENT: { dot: 'bg-success', tint: 'border-success/50 bg-success/14' },
};
const FALLBACK = { dot: 'bg-muted-foreground', tint: 'border-border bg-muted' };

export function RoleBadge({ role }: { role: string }) {
  const { t } = useTranslation();
  const tone = TONE[role] ?? FALLBACK;
  return (
    <span
      className={`inline-flex min-h-7 items-center gap-2 whitespace-nowrap rounded-full border px-3 text-[length:var(--text-caption)] font-semibold text-foreground ${tone.tint}`}
    >
      {role === 'SUPER_ADMIN' ? (
        <Lock aria-hidden="true" className="size-3.5 text-primary" />
      ) : (
        <span aria-hidden="true" className={`size-2 rounded-full ${tone.dot}`} />
      )}
      {roleLabel(role, t)}
    </span>
  );
}
