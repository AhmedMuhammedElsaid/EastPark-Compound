import type { LeadStatus } from '@/lib/api/resident-leads';

export function localeFor(lang: string): string {
  return lang === 'ar' ? 'ar-EG' : 'en-GB';
}

export function formatCount(value: number, lang: string): string {
  return new Intl.NumberFormat(localeFor(lang)).format(value);
}

export function formatExact(iso: string, lang: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(localeFor(lang), { dateStyle: 'long', timeStyle: 'short' }).format(date);
}

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 24 * 3600],
  ['month', 30 * 24 * 3600],
  ['week', 7 * 24 * 3600],
  ['day', 24 * 3600],
  ['hour', 3600],
  ['minute', 60],
];

/** "3 days ago" / "منذ ٣ أيام"; under a minute reads as "now". */
export function formatRelative(iso: string, lang: string, now = Date.now()): string {
  const time = new Date(iso).getTime();
  if (Number.isNaN(time)) return '';
  const seconds = Math.round((time - now) / 1000);
  const rtf = new Intl.RelativeTimeFormat(localeFor(lang), { numeric: 'auto' });
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit);
  }
  return rtf.format(0, 'second');
}

/**
 * Status tones. Colours are carried by a dot / tint / border only; label text stays in the
 * foreground colour, because the muted status hues are below 4.5:1 as small text on dark cards.
 */
export const STATUS_TONE: Record<LeadStatus, { dot: string; tint: string; bar: string }> = {
  PENDING: { dot: 'bg-warning', tint: 'border-warning/45 bg-warning/12', bar: 'bg-warning' },
  INVITED: { dot: 'bg-info', tint: 'border-info/50 bg-info/14', bar: 'bg-info' },
  CONVERTED: { dot: 'bg-success', tint: 'border-success/50 bg-success/14', bar: 'bg-success' },
  REJECTED: { dot: 'bg-error', tint: 'border-error/45 bg-error/12', bar: 'bg-error' },
};
