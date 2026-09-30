'use client';

import {
  ArrowLeft,
  BadgePercent,
  CalendarDays,
  FileText,
  Megaphone,
  MessageCircle,
  Newspaper,
  Wrench,
} from 'lucide-react';
import Link from 'next/link';

import { Container } from '@/components/Container';
import type {
  AnnouncementCategory,
  AnnouncementComment,
  AnnouncementDetail,
} from '@/lib/api/announcements';
import { useTranslation } from '@/lib/i18n';

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

export function AnnouncementDetailView({ announcement }: { announcement: AnnouncementDetail | null }) {
  const { lang, t } = useTranslation();

  if (!announcement) {
    return (
      <Container className="py-12 sm:py-20">
        <div role="alert" className="mx-auto max-w-4xl border-y border-border py-12">
          <h1 className="text-[length:var(--text-h1)] font-bold text-foreground">{t('common.error')}</h1>
          <p className="mt-3 text-[length:var(--text-body-lg)] text-muted-foreground">
            {t('community.announcement_unavailable')}
          </p>
          <BackLink isRtl={lang === 'ar'} label={t('common.back')} />
        </div>
      </Container>
    );
  }

  const Icon = categoryIcons[announcement.category];
  const title = lang === 'ar' ? announcement.titleAr : announcement.title;
  const body = lang === 'ar' ? announcement.bodyAr : announcement.body;
  const locale = lang === 'ar' ? 'ar-EG' : 'en-GB';
  const publishedAt = formatDate(announcement.publishedAt, locale);

  return (
    <Container className="py-8 sm:py-12">
      <article className="mx-auto w-full max-w-[56rem]">
        <BackLink isRtl={lang === 'ar'} label={t('common.back')} />

        <header className="mt-8 border-b border-border pb-8 sm:mt-10 sm:pb-10">
          <div className="flex flex-wrap items-center gap-3">
            <span className={`inline-flex min-h-8 items-center gap-2 rounded-full px-3 text-[length:var(--text-caption)] font-bold ${categoryStyles[announcement.category]}`}>
              <Icon aria-hidden="true" className="size-3.5" />
              {t(`community.${announcement.category}`)}
            </span>
            <time dateTime={announcement.publishedAt} className="text-[length:var(--text-caption)] text-muted-foreground">
              {publishedAt}
            </time>
          </div>
          <h1 className="mt-5 max-w-[48rem] text-[length:var(--text-h1)] font-bold leading-tight text-foreground">
            {title}
          </h1>
        </header>

        <div className="py-8 sm:py-10">
          <p className="whitespace-pre-line text-[length:var(--text-body-lg)] leading-8 text-foreground">
            {body}
          </p>
          {announcement.pdfUrl && (
            <a
              href={announcement.pdfUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-7 inline-flex min-h-11 items-center gap-2 rounded-md border border-border bg-card px-4 text-[length:var(--text-label)] font-bold text-primary transition-colors hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500 motion-reduce:transition-none"
            >
              <FileText aria-hidden="true" className="size-4.5" />
              {t('community.view_pdf')}
            </a>
          )}
        </div>

        <section aria-labelledby="comments-title" className="border-t border-border pt-8 sm:pt-10">
          <div className="flex items-center gap-3">
            <MessageCircle aria-hidden="true" className="size-5 text-primary" />
            <h2 id="comments-title" className="text-[length:var(--text-h2)] font-bold text-foreground">
              {t('community.comments')}
            </h2>
            <span className="text-[length:var(--text-label)] text-muted-foreground">
              {new Intl.NumberFormat(locale).format(announcement.comments.length)}
            </span>
          </div>

          {announcement.comments.length === 0 ? (
            <p className="mt-6 border-y border-border py-8 text-[length:var(--text-body)] text-muted-foreground">
              {t('community.no_comments')}
            </p>
          ) : (
            <div className="mt-6 divide-y divide-border border-y border-border">
              {announcement.comments.map((comment) => (
                <CommentItem key={comment.id} comment={comment} locale={locale} />
              ))}
            </div>
          )}
        </section>
      </article>
    </Container>
  );
}

function BackLink({ isRtl, label }: { isRtl: boolean; label: string }) {
  return (
    <Link
      href="/announcements"
      className="inline-flex min-h-11 items-center gap-2 text-[length:var(--text-label)] font-bold text-muted-foreground transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500 motion-reduce:transition-none"
    >
      <ArrowLeft aria-hidden="true" className={`size-4.5 ${isRtl ? 'rotate-180' : ''}`} />
      {label}
    </Link>
  );
}

function CommentItem({ comment, locale }: { comment: AnnouncementComment; locale: string }) {
  const initial = Array.from(comment.user.name.trim())[0]?.toUpperCase() ?? '?';

  return (
    <article className="grid grid-cols-[2.5rem_1fr] gap-3 py-5 sm:gap-4 sm:py-6">
      <div aria-hidden="true" className="flex size-10 items-center justify-center rounded-full bg-muted text-[length:var(--text-label)] font-bold text-primary">
        {initial}
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h3 className="text-[length:var(--text-label)] font-bold text-foreground">{comment.user.name}</h3>
          <time dateTime={comment.createdAt} className="text-[length:var(--text-caption)] text-muted-foreground">
            {formatDate(comment.createdAt, locale)}
          </time>
        </div>
        <p className="mt-2 whitespace-pre-line break-words text-[length:var(--text-body)] leading-7 text-muted-foreground">
          {comment.body}
        </p>
      </div>
    </article>
  );
}

function formatDate(value: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(value));
}