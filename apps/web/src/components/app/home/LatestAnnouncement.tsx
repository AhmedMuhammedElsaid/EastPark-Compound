'use client';

import { FileText, Megaphone } from 'lucide-react';
import { useSyncExternalStore } from 'react';

import { GatedLink } from '@/lib/access/ComingSoon';
import type { Announcement } from '@/lib/api/announcements';
import { useTranslation } from '@/lib/i18n';

const noopSubscribe = () => () => undefined;
const getMinute = () => Math.floor(Date.now() / 60_000);
const getServerMinute = () => 0;

function formatDate(iso: string, locale: string, nowMinute: number): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  // Server render and first client render use a deterministic UTC date to avoid hydration drift.
  if (nowMinute === 0) {
    return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' }).format(date);
  }
  const diffMs = date.getTime() - nowMinute * 60_000;
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  const days = Math.round(diffMs / 86_400_000);
  if (Math.abs(days) >= 1) return rtf.format(days, 'day');
  const hours = Math.round(diffMs / 3_600_000);
  if (hours !== 0) return rtf.format(hours, 'hour');
  return rtf.format(Math.round(diffMs / 60_000), 'minute');
}

export function LatestAnnouncement({ announcement }: { announcement: Announcement | null }) {
  const { t, lang } = useTranslation();
  const nowMinute = useSyncExternalStore(noopSubscribe, getMinute, getServerMinute);
  const locale = lang === 'ar' ? 'ar-EG' : 'en';

  return (
    <section aria-labelledby="latest-announcement-title" className="flex min-w-0 flex-col">
      <div className="flex items-center justify-between gap-3">
        <h2 id="latest-announcement-title" className="text-[length:var(--text-h2)] font-bold text-foreground">
          {t('home.teaser.latest_title')}
        </h2>
        {announcement && (
          <GatedLink
            href="/announcements"
            className="inline-flex min-h-11 shrink-0 items-center text-[length:var(--text-label)] font-bold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500"
          >
            {t('home.teaser.all_announcements')}
          </GatedLink>
        )}
      </div>

      {announcement ? (
        <GatedLink
          href="/announcements"
          className="mt-4 flex flex-1 gap-4 rounded-md border border-border bg-card p-4 transition-colors hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500 motion-reduce:transition-none"
        >
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-muted text-primary">
            <Megaphone aria-hidden="true" className="size-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-border bg-muted px-2.5 py-1 text-[length:var(--text-caption)] font-bold text-muted-foreground">
                {t(`community.${announcement.category}`)}
              </span>
              <span className="text-[length:var(--text-caption)] text-muted-foreground">
                {formatDate(announcement.publishedAt, locale, nowMinute)}
              </span>
            </span>
            <span className="mt-2 block text-[length:var(--text-body-lg)] font-bold leading-snug text-foreground">
              {lang === 'ar' ? announcement.titleAr : announcement.title}
            </span>
            <span className="mt-1 line-clamp-2 block text-[length:var(--text-body)] leading-6 text-muted-foreground">
              {lang === 'ar' ? announcement.bodyAr : announcement.body}
            </span>
            {announcement.pdfUrl && (
              <span className="mt-3 inline-flex min-h-8 items-center gap-1.5 rounded-full border border-border px-3 text-[length:var(--text-caption)] font-bold text-foreground">
                <FileText aria-hidden="true" className="size-3.5" />
                {t('community.open_pdf')}
              </span>
            )}
          </span>
        </GatedLink>
      ) : (
        <div className="mt-4 flex flex-1 items-center gap-4 rounded-md border border-dashed border-border bg-card p-4">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-muted text-primary">
            <Megaphone aria-hidden="true" className="size-5" />
          </span>
          <p className="text-[length:var(--text-body)] text-muted-foreground">{t('home.teaser.latest_empty')}</p>
        </div>
      )}
    </section>
  );
}

export function LatestAnnouncementSkeleton() {
  const { t } = useTranslation();
  return (
    <section aria-labelledby="latest-announcement-title" aria-busy="true" className="flex min-w-0 flex-col">
      <h2 id="latest-announcement-title" className="text-[length:var(--text-h2)] font-bold text-foreground">
        {t('home.teaser.latest_title')}
      </h2>
      <div role="status" className="mt-4 flex flex-1 gap-4 rounded-md border border-border bg-card p-4">
        <span className="sr-only">{t('common.loading')}</span>
        <div className="size-11 shrink-0 animate-pulse rounded-full bg-muted motion-reduce:animate-none" />
        <div className="flex-1 space-y-3">
          <div className="h-4 w-1/3 animate-pulse rounded-sm bg-muted motion-reduce:animate-none" />
          <div className="h-5 w-3/4 animate-pulse rounded-sm bg-muted motion-reduce:animate-none" />
          <div className="h-4 w-full animate-pulse rounded-sm bg-muted motion-reduce:animate-none" />
        </div>
      </div>
    </section>
  );
}
