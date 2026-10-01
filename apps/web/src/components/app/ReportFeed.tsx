'use client';

import { ArrowUpRight, ClipboardList, FileText } from 'lucide-react';
import Link from 'next/link';
import { startTransition, useState } from 'react';

import { CommunityNav } from '@/components/app/CommunityNav';
import { Container } from '@/components/Container';
import type { Report, ReportPage } from '@/lib/api/reports';
import { parseReportPage } from '@/lib/api/reports';
import { useTranslation } from '@/lib/i18n';

export function ReportFeed({ initialPage }: { initialPage: ReportPage | null }) {
  const { lang, t } = useTranslation();
  const [items, setItems] = useState(initialPage?.items ?? []);
  const [nextCursor, setNextCursor] = useState(initialPage?.nextCursor);
  const [loadError, setLoadError] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  async function loadMore() {
    if (!nextCursor || isLoadingMore) return;
    setIsLoadingMore(true);
    setLoadError(false);

    try {
      const response = await fetch(`/api/reports?cursor=${encodeURIComponent(nextCursor)}`);
      if (!response.ok) throw new Error('Request failed');
      const page = parseReportPage(await response.json());
      startTransition(() => {
        setItems((current) => {
          const known = new Set(current.map((item) => item.id));
          return [...current, ...page.items.filter((item) => !known.has(item.id))];
        });
        setNextCursor(page.nextCursor);
      });
    } catch {
      setLoadError(true);
    } finally {
      setIsLoadingMore(false);
    }
  }

  return (
    <Container className="py-8 sm:py-12">
      <section aria-labelledby="reports-title" className="mx-auto max-w-5xl">
        <div className="max-w-[42rem]">
          <p className="text-[length:var(--text-overline)] font-bold uppercase text-primary">
            {t('community.title')}
          </p>
          <h1 id="reports-title" className="mt-2 text-[length:var(--text-h1)] font-bold text-foreground">
            {t('community.reports')}
          </h1>
          <p className="mt-3 text-[length:var(--text-body-lg)] text-muted-foreground">
            {t('community.reports_subtitle')}
          </p>
          <CommunityNav />
        </div>

        {initialPage === null ? (
          <div role="alert" className="mt-8 border-y border-border py-10">
            <h2 className="text-[length:var(--text-h2)] font-bold text-foreground">{t('common.error')}</h2>
            <p className="mt-2 text-[length:var(--text-body)] text-muted-foreground">
              {t('community.reports_unavailable')}
            </p>
          </div>
        ) : items.length === 0 ? (
          <div className="mt-8 border-y border-border py-14 text-center">
            <ClipboardList aria-hidden="true" className="mx-auto size-9 text-muted-foreground" />
            <p className="mt-4 text-[length:var(--text-body-lg)] font-semibold text-foreground">
              {t('community.no_reports')}
            </p>
            <p className="mt-2 text-[length:var(--text-body)] text-muted-foreground">
              {t('community.no_reports_subtitle')}
            </p>
          </div>
        ) : (
          <div className="mt-8 divide-y divide-border border-y border-border">
            {items.map((report) => <ReportItem key={report.id} report={report} lang={lang} />)}
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
                {t('community.reports_unavailable')}
              </p>
            )}
          </div>
        )}
      </section>
    </Container>
  );
}

function ReportItem({ report, lang }: { report: Report; lang: 'ar' | 'en' }) {
  const { t } = useTranslation();
  const title = lang === 'ar' ? report.titleAr : report.title;
  const date = formatDate(report.publishedAt, lang);

  return (
    <article className="grid gap-5 py-6 sm:grid-cols-[3rem_1fr_auto] sm:items-center sm:gap-6 sm:py-7">
      <span aria-hidden="true" className="flex size-12 items-center justify-center rounded-md bg-muted text-primary">
        <FileText className="size-5.5" />
      </span>
      <div className="min-w-0">
        <time dateTime={report.publishedAt} className="text-[length:var(--text-caption)] text-muted-foreground">
          {date}
        </time>
        <h2 className="mt-1 text-[length:var(--text-h2)] font-bold text-foreground">
          <Link
            href={`/reports/${encodeURIComponent(report.id)}`}
            className="transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500 motion-reduce:transition-none"
          >
            {title}
          </Link>
        </h2>
      </div>
      <a
        href={report.pdfUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`${t('community.view_pdf')}: ${title}`}
        className="inline-flex min-h-11 w-fit items-center gap-2 rounded-md border border-border bg-card px-4 text-[length:var(--text-label)] font-bold text-primary transition-colors hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500 motion-reduce:transition-none"
      >
        {t('community.view_pdf')}
        <ArrowUpRight aria-hidden="true" className="size-4 rtl:-scale-x-100" />
      </a>
    </article>
  );
}

function formatDate(value: string, lang: 'ar' | 'en'): string {
  return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG' : 'en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(value));
}