'use client';

import {
  BadgePercent,
  CalendarDays,
  FileText,
  Megaphone,
  Newspaper,
  Wrench,
} from 'lucide-react';
import Link from 'next/link';
import { startTransition, useState } from 'react';

import { Container } from '@/components/Container';
import type {
  Announcement,
  AnnouncementCategory,
  AnnouncementPage,
} from '@/lib/api/announcements';
import { announcementCategories } from '@/lib/api/announcements';
import { useTranslation } from '@/lib/i18n';

type AnnouncementFeedProps = {
  category?: AnnouncementCategory;
  initialPage: AnnouncementPage | null;
};

const categoryIcons = {
  GENERAL: Megaphone,
  PROMOTION: BadgePercent,
  EVENT: CalendarDays,
  MAINTENANCE: Wrench,
  NEWS: Newspaper,
} satisfies Record<AnnouncementCategory, typeof Megaphone>;

const categoryStyles = {
  GENERAL: 'bg-muted text-muted-foreground',
  PROMOTION: 'bg-primary/12 text-primary',
  EVENT: 'bg-success/15 text-success',
  MAINTENANCE: 'bg-warning/15 text-warning',
  NEWS: 'bg-info/15 text-info',
} satisfies Record<AnnouncementCategory, string>;

export function AnnouncementFeed({ category, initialPage }: AnnouncementFeedProps) {
  const { lang, t } = useTranslation();
  const [items, setItems] = useState(initialPage?.items ?? []);
  const [nextCursor, setNextCursor] = useState(initialPage?.nextCursor);
  const [loadError, setLoadError] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  async function loadMore() {
    if (!nextCursor || isLoadingMore) return;
    setIsLoadingMore(true);
    setLoadError(false);

    const params = new URLSearchParams({ cursor: nextCursor });
    if (category) params.set('category', category);

    try {
      const response = await fetch(`/api/announcements?${params.toString()}`);
      if (!response.ok) throw new Error('Request failed');
      const payload = (await response.json()) as { data: AnnouncementPage };
      startTransition(() => {
        setItems((current) => {
          const known = new Set(current.map((item) => item.id));
          return [...current, ...payload.data.items.filter((item) => !known.has(item.id))];
        });
        setNextCursor(payload.data.nextCursor);
      });
    } catch {
      setLoadError(true);
    } finally {
      setIsLoadingMore(false);
    }
  }

  return (
    <Container className="py-8 sm:py-12">
      <section aria-labelledby="announcements-title" className="mx-auto max-w-5xl">
        <div className="w-full max-w-[42rem]">
          <p className="text-[length:var(--text-overline)] font-bold uppercase text-primary">
            {t('community.title')}
          </p>
          <h1 id="announcements-title" className="mt-2 text-[length:var(--text-h1)] font-bold text-foreground">
            {t('community.announcements')}
          </h1>
          <p className="mt-3 text-[length:var(--text-body-lg)] text-muted-foreground">
            {t('community.announcements_subtitle')}
          </p>
        </div>

        <nav aria-label={t('common.filter')} className="announcement-filters mt-8 flex gap-2 overflow-x-auto pb-2">
          <CategoryLink active={!category} href="/announcements" label={t('community.all_announcements')} />
          {announcementCategories.map((value) => (
            <CategoryLink
              key={value}
              active={category === value}
              href={`/announcements?category=${value}`}
              label={t(`community.${value}`)}
            />
          ))}
        </nav>

        {initialPage === null ? (
          <div role="alert" className="mt-8 border-y border-border py-10">
            <h2 className="text-[length:var(--text-h2)] font-bold text-foreground">{t('common.error')}</h2>
            <p className="mt-2 text-[length:var(--text-body)] text-muted-foreground">
              {t('community.announcements_unavailable')}
            </p>
          </div>
        ) : items.length === 0 ? (
          <div className="mt-8 border-y border-border py-12 text-center">
            <Megaphone aria-hidden="true" className="mx-auto size-8 text-muted-foreground" />
            <p className="mt-4 text-[length:var(--text-body-lg)] font-semibold text-foreground">
              {t('community.no_announcements')}
            </p>
          </div>
        ) : (
          <div className="mt-8 divide-y divide-border border-y border-border">
            {items.map((announcement) => (
              <AnnouncementItem key={announcement.id} announcement={announcement} lang={lang} />
            ))}
          </div>
        )}

        {nextCursor && (
          <div className="mt-8 flex flex-col items-center gap-3">
            <button
              type="button"
              onClick={() => void loadMore()}
              disabled={isLoadingMore}
              className="inline-flex min-h-12 items-center justify-center rounded-md border border-border bg-card px-6 text-[length:var(--text-button)] font-bold text-foreground transition-colors hover:border-primary hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500 disabled:opacity-60 motion-reduce:transition-none"
            >
              {isLoadingMore ? t('common.loading') : t('common.load_more')}
            </button>
            {loadError && (
              <p role="alert" className="text-[length:var(--text-label)] text-error">
                {t('community.announcements_unavailable')}
              </p>
            )}
          </div>
        )}
      </section>
    </Container>
  );
}

function CategoryLink({ active, href, label }: { active: boolean; href: string; label: string }) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={`inline-flex min-h-11 shrink-0 items-center rounded-full border px-4 text-[length:var(--text-label)] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500 motion-reduce:transition-none ${
        active
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-border bg-card text-muted-foreground hover:border-primary hover:text-foreground'
      }`}
    >
      {label}
    </Link>
  );
}

function AnnouncementItem({ announcement, lang }: { announcement: Announcement; lang: 'ar' | 'en' }) {
  const { t } = useTranslation();
  const Icon = categoryIcons[announcement.category];
  const title = lang === 'ar' ? announcement.titleAr : announcement.title;
  const body = lang === 'ar' ? announcement.bodyAr : announcement.body;
  const date = new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG' : 'en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(announcement.publishedAt));

  return (
    <article className="grid gap-4 py-7 sm:grid-cols-[9rem_1fr] sm:gap-8 sm:py-9">
      <div>
        <span className={`inline-flex min-h-8 items-center gap-2 rounded-full px-3 text-[length:var(--text-caption)] font-bold ${categoryStyles[announcement.category]}`}>
          <Icon aria-hidden="true" className="size-3.5" />
          {t(`community.${announcement.category}`)}
        </span>
        <time dateTime={announcement.publishedAt} className="mt-3 block text-[length:var(--text-caption)] text-muted-foreground">
          {date}
        </time>
      </div>
      <div className="min-w-0">
        <h2 className="text-[length:var(--text-h2)] font-bold text-foreground">
          <Link
            href={`/announcements/${encodeURIComponent(announcement.id)}`}
            className="transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500 motion-reduce:transition-none"
          >
            {title}
          </Link>
        </h2>
        <p className="mt-3 whitespace-pre-line text-[length:var(--text-body)] leading-7 text-muted-foreground">
          {body}
        </p>
        {announcement.pdfUrl && (
          <a
            href={announcement.pdfUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-5 inline-flex min-h-11 items-center gap-2 text-[length:var(--text-label)] font-bold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500"
          >
            <FileText aria-hidden="true" className="size-4.5" />
            {t('community.view_pdf')}
          </a>
        )}
      </div>
    </article>
  );
}