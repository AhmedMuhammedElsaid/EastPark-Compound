'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock3,
  EyeOff,
  FileImage,
  MessageSquareText,
  Plus,
  Send,
  ShieldCheck,
  Trash2,
  Upload,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Container } from '@/components/Container';
import { PendingMark } from '@/components/PendingMark';
import { Field, CONTROL_CLASS, controlBorder } from '@/components/form/Field';
import {
  feedbackCategories,
  feedbackStatuses,
  parseFeedback,
  parseFeedbackDetail,
  parseFeedbackPage,
  parseUploadResult,
} from '@/lib/api/feedback';
import type { Feedback, FeedbackDetail, FeedbackPage, FeedbackStatus } from '@/lib/api/feedback';
import { useAuth } from '@/lib/auth/AuthProvider';
import { useTranslation } from '@/lib/i18n';

const formSchema = z.object({
  category: z.enum(feedbackCategories),
  body: z.string().trim().min(10).max(4000),
  isAnonymous: z.boolean(),
});

type FeedbackFormValues = z.infer<typeof formSchema>;
type ApiError = 'network' | 'request_failed' | 'unauthorized' | 'upload_failed' | 'validation';

const statusStyles = {
  SUBMITTED: 'bg-muted text-muted-foreground',
  ACKNOWLEDGED: 'bg-info/15 text-info',
  IN_PROGRESS: 'bg-warning/15 text-warning',
  RESOLVED: 'bg-success/15 text-success',
} satisfies Record<FeedbackStatus, string>;

export function FeedbackListView() {
  const { lang, t } = useTranslation();
  const [page, setPage] = React.useState<FeedbackPage>({ items: [], nextCursor: undefined });
  const [status, setStatus] = React.useState<FeedbackStatus | undefined>();
  const [isLoading, setIsLoading] = React.useState(true);
  const [isLoadingMore, setIsLoadingMore] = React.useState(false);
  const [error, setError] = React.useState(false);

  const load = React.useCallback(async (cursor?: string) => {
    const params = new URLSearchParams();
    if (cursor) params.set('cursor', cursor);
    if (status) params.set('status', status);
    const response = await fetch(`/api/feedback?${params.toString()}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error('request_failed');
    return parseFeedbackPage(await response.json());
  }, [status]);

  React.useEffect(() => {
    let active = true;
    void load()
      .then((next) => {
        if (active) {
          setPage(next);
          setError(false);
        }
      })
      .catch(() => active && setError(true))
      .finally(() => active && setIsLoading(false));
    return () => { active = false; };
  }, [load]);

  async function loadMore() {
    if (!page.nextCursor || isLoadingMore) return;
    setIsLoadingMore(true);
    setError(false);
    try {
      const next = await load(page.nextCursor);
      setPage((current) => ({
        items: [...current.items, ...next.items.filter((item) => !current.items.some(({ id }) => id === item.id))],
        nextCursor: next.nextCursor,
      }));
    } catch {
      setError(true);
    } finally {
      setIsLoadingMore(false);
    }
  }

  return (
    <FeedbackGuard>
      <Container className="py-8 sm:py-12">
        <section aria-labelledby="feedback-title" className="mx-auto max-w-5xl">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-2xl">
              <p className="text-[length:var(--text-overline)] font-bold uppercase text-primary">{t('community.title')}</p>
              <h1 id="feedback-title" className="mt-2 text-[length:var(--text-h1)] font-bold text-foreground">{t('feedback.title')}</h1>
              <p className="mt-3 text-[length:var(--text-body-lg)] text-muted-foreground">{t('feedback.list_subtitle')}</p>
            </div>
            <Link href="/feedback/new" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-primary px-5 text-[length:var(--text-button)] font-bold text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500">
              <Plus aria-hidden="true" className="size-4.5" />{t('feedback.new')}
            </Link>
          </div>

          <div className="announcement-filters mt-8 flex gap-2 overflow-x-auto pb-2" role="group" aria-label={t('feedback.status_filter')}>
            <FilterButton active={!status} onClick={() => setStatus(undefined)} label={t('feedback.all_statuses')} />
            {feedbackStatuses.map((value) => <FilterButton key={value} active={status === value} onClick={() => setStatus(value)} label={t(`feedback.${value}`)} />)}
          </div>

          {isLoading ? <FeedbackSkeleton /> : error && page.items.length === 0 ? (
            <StateMessage title={t('common.error')} body={t('feedback.unavailable')} />
          ) : page.items.length === 0 ? (
            <div className="mt-8 border-y border-border py-14 text-center">
              <MessageSquareText aria-hidden="true" className="mx-auto size-9 text-muted-foreground" />
              <h2 className="mt-4 text-[length:var(--text-h2)] font-bold">{t('feedback.empty')}</h2>
              <p className="mt-2 text-[length:var(--text-body)] text-muted-foreground">{t('feedback.empty_subtitle')}</p>
            </div>
          ) : (
            <div className="mt-8 divide-y divide-border border-y border-border">
              {page.items.map((item) => <FeedbackRow key={item.id} item={item} lang={lang} />)}
            </div>
          )}

          {page.nextCursor && (
            <div className="mt-8 flex flex-col items-center gap-3">
              <button type="button" onClick={() => void loadMore()} disabled={isLoadingMore} className="inline-flex min-h-12 items-center rounded-md border border-border bg-card px-6 font-bold hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500 disabled:opacity-60">
                {isLoadingMore ? t('common.loading') : t('common.load_more')}
              </button>
              {error && <p role="alert" className="text-[length:var(--text-label)] text-error">{t('feedback.unavailable')}</p>}
            </div>
          )}
        </section>
      </Container>
    </FeedbackGuard>
  );
}

export function NewFeedbackView() {
  const router = useRouter();
  const { dir, t } = useTranslation();
  const [files, setFiles] = React.useState<File[]>([]);
  const [submitError, setSubmitError] = React.useState<ApiError>();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<FeedbackFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { category: 'MAINTENANCE', body: '', isAnonymous: false },
  });
  const BackIcon = dir === 'rtl' ? ArrowRight : ArrowLeft;

  function selectFiles(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? []);
    const valid = selected.filter((file) => ['image/jpeg', 'image/png', 'image/webp'].includes(file.type) && file.size <= 5 * 1024 * 1024);
    if (valid.length !== selected.length || files.length + valid.length > 3) setSubmitError('validation');
    setFiles((current) => [...current, ...valid].slice(0, 3));
    event.target.value = '';
  }

  async function onSubmit(values: FeedbackFormValues) {
    setIsSubmitting(true);
    setSubmitError(undefined);
    try {
      const attachments: string[] = [];
      for (const file of files) {
        const formData = new FormData();
        formData.set('file', file);
        const upload = await fetch('/api/uploads/image', { method: 'POST', body: formData, signal: AbortSignal.timeout(20_000) });
        if (!upload.ok) throw new Error(upload.status === 401 ? 'unauthorized' : 'upload_failed');
        attachments.push(parseUploadResult(await upload.json()).url);
      }
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...values, attachments }),
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) throw new Error(response.status === 401 ? 'unauthorized' : 'request_failed');
      const created = parseFeedback(await response.json());
      router.replace(`/feedback/${encodeURIComponent(created.id)}?created=1`);
    } catch (error) {
      const code = error instanceof Error ? error.message : 'network';
      setSubmitError(['request_failed', 'unauthorized', 'upload_failed'].includes(code) ? code as ApiError : 'network');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <FeedbackGuard>
      <Container className="py-8 sm:py-12">
        <section aria-labelledby="new-feedback-title" className="mx-auto max-w-3xl">
          <Link href="/feedback" className="inline-flex min-h-11 items-center gap-2 text-[length:var(--text-label)] font-bold text-muted-foreground hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500">
            <BackIcon aria-hidden="true" className="size-4.5" />{t('feedback.back_to_list')}
          </Link>
          <h1 id="new-feedback-title" className="mt-5 text-[length:var(--text-h1)] font-bold">{t('feedback.new')}</h1>
          <p className="mt-3 text-[length:var(--text-body-lg)] text-muted-foreground">{t('feedback.new_subtitle')}</p>

          <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-7 border-y border-border py-8" noValidate>
            <Field id="feedback-category" label={t('feedback.category')} required>
              {(props) => <select {...props} {...register('category')} className={`${CONTROL_CLASS} ${controlBorder(false)}`}>{feedbackCategories.map((value) => <option key={value} value={value}>{t(`feedback.${value}`)}</option>)}</select>}
            </Field>
            <Field id="feedback-body" label={t('feedback.feedback_body')} required error={errors.body ? t('feedback.body_error') : undefined} hint={t('feedback.body_hint')}>
              {(props) => <textarea {...props} {...register('body')} rows={7} maxLength={4000} className={`${CONTROL_CLASS} ${controlBorder(Boolean(errors.body))} resize-y py-3`} />}
            </Field>

            <div>
              <p className="text-[length:var(--text-label)] font-medium">{t('feedback.attachments')}</p>
              <p className="mt-1 text-[length:var(--text-caption)] text-muted-foreground">{t('feedback.attachments_hint')}</p>
              <label className="mt-3 inline-flex min-h-12 items-center gap-2 rounded-md border border-border bg-card px-4 text-[length:var(--text-button)] font-bold hover:border-primary focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-gold-500">
                <Upload aria-hidden="true" className="size-4.5" />{t('feedback.add_photo')}
                <input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={files.length >= 3 || isSubmitting} onChange={selectFiles} className="sr-only" />
              </label>
              {files.length > 0 && <ul className="mt-3 divide-y divide-border border-y border-border">{files.map((file, index) => <li key={`${file.name}-${file.lastModified}`} className="flex min-h-12 items-center gap-3 py-2"><FileImage aria-hidden="true" className="size-4.5 shrink-0 text-primary" /><span className="min-w-0 flex-1 truncate text-[length:var(--text-label)]">{file.name}</span><button type="button" onClick={() => setFiles((current) => current.filter((_, fileIndex) => fileIndex !== index))} aria-label={`${t('common.delete')} ${file.name}`} className="flex size-11 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-error focus-visible:outline-2 focus-visible:outline-gold-500"><Trash2 aria-hidden="true" className="size-4.5" /></button></li>)}</ul>}
            </div>

            <label className="flex min-h-14 items-start gap-3 rounded-md border border-border bg-card p-4">
              <input type="checkbox" {...register('isAnonymous')} className="mt-1 size-5 accent-[var(--color-primary)]" />
              <span><span className="flex items-center gap-2 font-bold"><EyeOff aria-hidden="true" className="size-4.5 text-primary" />{t('feedback.anonymous')}</span><span className="mt-1 block text-[length:var(--text-caption)] text-muted-foreground">{t('feedback.anonymous_subtitle')}</span></span>
            </label>

            {submitError && <p role="alert" className="rounded-md bg-error/10 p-4 text-[length:var(--text-label)] font-semibold text-error">{t(`feedback.error_${submitError}`)}</p>}
            <button type="submit" disabled={isSubmitting} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-primary px-6 text-[length:var(--text-button)] font-bold text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500 disabled:opacity-60 sm:w-auto">
              {isSubmitting ? <PendingMark /> : <Send aria-hidden="true" className="size-4.5" />}{isSubmitting ? t('feedback.submitting') : t('common.submit')}
            </button>
          </form>
        </section>
      </Container>
    </FeedbackGuard>
  );
}

export function FeedbackDetailView({ id, created }: { id: string; created: boolean }) {
  const { dir, lang, t } = useTranslation();
  const [item, setItem] = React.useState<FeedbackDetail>();
  const [error, setError] = React.useState(false);
  const BackIcon = dir === 'rtl' ? ArrowRight : ArrowLeft;

  React.useEffect(() => {
    let active = true;
    void fetch(`/api/feedback/${encodeURIComponent(id)}`, { cache: 'no-store', signal: AbortSignal.timeout(10_000) })
      .then(async (response) => { if (!response.ok) throw new Error(); return parseFeedbackDetail(await response.json()); })
      .then((value) => active && setItem(value))
      .catch(() => active && setError(true));
    return () => { active = false; };
  }, [id]);

  return (
    <FeedbackGuard>
      <Container className="py-8 sm:py-12">
        <article aria-labelledby="feedback-detail-title" className="mx-auto max-w-3xl">
          <Link href="/feedback" className="inline-flex min-h-11 items-center gap-2 text-[length:var(--text-label)] font-bold text-muted-foreground hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500"><BackIcon aria-hidden="true" className="size-4.5" />{t('feedback.back_to_list')}</Link>
          {created && <div role="status" className="mt-5 flex items-center gap-3 rounded-md bg-success/15 p-4 font-semibold text-success"><CheckCircle2 aria-hidden="true" className="size-5" />{t('feedback.submitted_success')}</div>}
          {!item && !error ? <FeedbackSkeleton /> : error ? <StateMessage title={t('common.error')} body={t('feedback.detail_unavailable')} /> : item && (
            <>
              <div className="mt-6 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-primary/12 px-3 py-2 text-[length:var(--text-caption)] font-bold text-primary">{t(`feedback.${item.category}`)}</span>
                <StatusBadge status={item.status} />
                {item.isAnonymous && <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-2 text-[length:var(--text-caption)] font-bold text-muted-foreground"><EyeOff aria-hidden="true" className="size-3.5" />{t('feedback.anonymous_label')}</span>}
              </div>
              <h1 id="feedback-detail-title" className="mt-5 text-[length:var(--text-h1)] font-bold">{t('feedback.request_details')}</h1>
              <time dateTime={item.createdAt} className="mt-2 block text-[length:var(--text-caption)] text-muted-foreground">{formatDate(item.createdAt, lang, true)}</time>
              <p className="mt-6 whitespace-pre-wrap border-y border-border py-7 text-[length:var(--text-body-lg)] leading-8">{item.body}</p>
              {item.attachments.length > 0 && <section aria-labelledby="attachments-title" className="mt-8"><h2 id="attachments-title" className="text-[length:var(--text-h2)] font-bold">{t('feedback.attachments')}</h2><div className="mt-4 grid gap-3 sm:grid-cols-3">{item.attachments.map((url, index) => <a key={url} href={url} target="_blank" rel="noreferrer" className="group relative aspect-[4/3] overflow-hidden rounded-md border border-border bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500"><Image src={url} alt={`${t('feedback.attachment')} ${index + 1}`} fill sizes="(min-width: 640px) 14rem, 100vw" loader={({ src }) => src} className="object-cover transition-transform duration-300 group-hover:scale-[1.03] motion-reduce:transition-none" /></a>)}</div></section>}

              <section aria-labelledby="replies-title" className="mt-10">
                <h2 id="replies-title" className="text-[length:var(--text-h2)] font-bold">{t('feedback.reply')}</h2>
                {item.replies.length === 0 ? <div className="mt-4 flex items-start gap-3 border-y border-border py-6 text-muted-foreground"><Clock3 aria-hidden="true" className="mt-0.5 size-5 shrink-0" /><p className="text-[length:var(--text-body)]">{t('feedback.awaiting_reply')}</p></div> : <ol className="mt-4 divide-y divide-border border-y border-border">{item.replies.map((reply) => <li key={reply.id} className="py-6"><div className="flex items-center gap-2 text-[length:var(--text-label)] font-bold text-primary"><ShieldCheck aria-hidden="true" className="size-4.5" />{t('feedback.management')}</div><p className="mt-3 whitespace-pre-wrap text-[length:var(--text-body)] leading-7">{reply.body}</p><time dateTime={reply.createdAt} className="mt-3 block text-[length:var(--text-caption)] text-muted-foreground">{formatDate(reply.createdAt, lang, true)}</time></li>)}</ol>}
              </section>
            </>
          )}
        </article>
      </Container>
    </FeedbackGuard>
  );
}

function FeedbackGuard({ children }: { children: React.ReactNode }) {
  const { isLoading, user } = useAuth();
  const router = useRouter();
  const { t } = useTranslation();
  React.useEffect(() => {
    if (isLoading) return;
    if (!user) router.replace('/login');
    else if (user.role !== 'RESIDENT' && user.role !== 'MERCHANT') router.replace('/home');
  }, [isLoading, router, user]);
  if (isLoading || !user || (user.role !== 'RESIDENT' && user.role !== 'MERCHANT')) return <Container className="py-12"><div role="status" className="h-24 animate-pulse rounded-md bg-muted motion-reduce:animate-none"><span className="sr-only">{t('common.loading')}</span></div></Container>;
  return children;
}

function FeedbackRow({ item, lang }: { item: Feedback; lang: 'ar' | 'en' }) {
  const { t } = useTranslation();
  return <article className="grid gap-3 py-6 sm:grid-cols-[10rem_1fr_auto] sm:items-center sm:gap-6"><div><span className="text-[length:var(--text-label)] font-bold text-primary">{t(`feedback.${item.category}`)}</span><time dateTime={item.createdAt} className="mt-1 block text-[length:var(--text-caption)] text-muted-foreground">{formatDate(item.createdAt, lang)}</time></div><p className="line-clamp-2 min-w-0 whitespace-pre-wrap text-[length:var(--text-body)] leading-6">{item.body}</p><div className="flex items-center justify-between gap-3 sm:justify-end"><StatusBadge status={item.status} /><Link href={`/feedback/${encodeURIComponent(item.id)}`} aria-label={t('feedback.view_details')} className="inline-flex min-h-11 items-center text-[length:var(--text-label)] font-bold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500">{t('feedback.view_details')}</Link></div></article>;
}

function StatusBadge({ status }: { status: FeedbackStatus }) {
  const { t } = useTranslation();
  return <span className={`inline-flex min-h-8 items-center rounded-full px-3 text-[length:var(--text-caption)] font-bold ${statusStyles[status]}`}>{t(`feedback.${status}`)}</span>;
}

function FilterButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return <button type="button" aria-pressed={active} onClick={onClick} className={`min-h-11 shrink-0 rounded-full border px-4 text-[length:var(--text-label)] font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500 ${active ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-muted-foreground hover:border-primary'}`}>{label}</button>;
}

function FeedbackSkeleton() {
  return <div role="status" aria-busy="true" className="mt-8 space-y-4"><span className="sr-only">Loading</span>{[0, 1, 2].map((value) => <div key={value} className="h-24 animate-pulse rounded-md bg-muted motion-reduce:animate-none" />)}</div>;
}

function StateMessage({ body, title }: { body: string; title: string }) {
  return <div role="alert" className="mt-8 border-y border-border py-10"><h2 className="text-[length:var(--text-h2)] font-bold">{title}</h2><p className="mt-2 text-muted-foreground">{body}</p></div>;
}

function formatDate(value: string, lang: 'ar' | 'en', includeTime = false) {
  return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric', ...(includeTime ? { hour: 'numeric', minute: '2-digit' } : {}) }).format(new Date(value));
}