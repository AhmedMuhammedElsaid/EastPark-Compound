'use client';

import { ArrowLeft, ArrowUpRight, FileText } from 'lucide-react';
import Link from 'next/link';

import { Container } from '@/components/Container';
import type { Report } from '@/lib/api/reports';
import { useTranslation } from '@/lib/i18n';

export function ReportDetailView({ report }: { report: Report | null }) {
  const { lang, t } = useTranslation();
  const isRtl = lang === 'ar';

  if (!report) {
    return (
      <Container className="py-12 sm:py-20">
        <div role="alert" className="mx-auto max-w-4xl border-y border-border py-12">
          <h1 className="text-[length:var(--text-h1)] font-bold text-foreground">{t('common.error')}</h1>
          <p className="mt-3 text-[length:var(--text-body-lg)] text-muted-foreground">
            {t('community.report_unavailable')}
          </p>
          <BackLink isRtl={isRtl} label={t('common.back')} />
        </div>
      </Container>
    );
  }

  const title = isRtl ? report.titleAr : report.title;
  const date = new Intl.DateTimeFormat(isRtl ? 'ar-EG' : 'en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(report.publishedAt));

  return (
    <Container className="py-8 sm:py-12">
      <article className="mx-auto w-full max-w-[56rem]">
        <BackLink isRtl={isRtl} label={t('common.back')} />
        <header className="mt-8 border-b border-border pb-8 sm:mt-10 sm:pb-10">
          <div className="flex items-center gap-3 text-primary">
            <FileText aria-hidden="true" className="size-5" />
            <span className="text-[length:var(--text-overline)] font-bold uppercase">
              {t('community.official_report')}
            </span>
          </div>
          <h1 className="mt-5 max-w-[48rem] text-[length:var(--text-h1)] font-bold leading-tight text-foreground">
            {title}
          </h1>
          <time dateTime={report.publishedAt} className="mt-4 block text-[length:var(--text-label)] text-muted-foreground">
            {date}
          </time>
        </header>

        <div className="py-8 sm:py-10">
          <p className="max-w-[42rem] text-[length:var(--text-body-lg)] leading-8 text-muted-foreground">
            {t('community.report_document_note')}
          </p>
          <a
            href={report.pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-7 inline-flex min-h-12 items-center gap-2 rounded-md bg-primary px-5 text-[length:var(--text-button)] font-bold text-primary-foreground transition-colors hover:bg-gold-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500 motion-reduce:transition-none"
          >
            {t('community.open_pdf')}
            <ArrowUpRight aria-hidden="true" className="size-4.5 rtl:-scale-x-100" />
          </a>
        </div>
      </article>
    </Container>
  );
}

function BackLink({ isRtl, label }: { isRtl: boolean; label: string }) {
  return (
    <Link
      href="/reports"
      className="inline-flex min-h-11 items-center gap-2 text-[length:var(--text-label)] font-bold text-muted-foreground transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500 motion-reduce:transition-none"
    >
      <ArrowLeft aria-hidden="true" className={`size-4.5 ${isRtl ? 'rotate-180' : ''}`} />
      {label}
    </Link>
  );
}