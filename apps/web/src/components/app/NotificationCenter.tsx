'use client';

import {
  BellOff,
  CheckCheck,
  ChevronRight,
  Mail,
  MailOpen,
  Settings2,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { startTransition, useRef, useState } from 'react';

import { Container } from '@/components/Container';
import { PendingMark } from '@/components/PendingMark';
import {
  parseMarkAllRead,
  parseNotificationPage,
  parseNotificationPreference,
  type AppNotification,
  type NotificationPage,
  type NotificationPreference,
  type NotificationType,
} from '@/lib/api/notifications';
import { useTranslation } from '@/lib/i18n';

type ReadFilter = 'all' | 'unread' | 'read';

type NotificationCenterProps = {
  initialPage: NotificationPage | null;
  initialPreferences: NotificationPreference[] | null;
};

const typeDotStyles: Record<NotificationType, string> = {
  ORDER_UPDATE: 'bg-primary',
  ANNOUNCEMENT: 'bg-info',
  POLL: 'bg-success',
  ELECTION: 'bg-warning',
  FEEDBACK_UPDATE: 'bg-info',
};

export function NotificationCenter({
  initialPage,
  initialPreferences,
}: NotificationCenterProps) {
  const { lang, t } = useTranslation();
  const router = useRouter();
  const [items, setItems] = useState(initialPage?.items ?? []);
  const [nextCursor, setNextCursor] = useState(initialPage?.nextCursor);
  const [unreadCount, setUnreadCount] = useState(initialPage?.unreadCount ?? 0);
  // `filter` is the tab whose items are on screen; `pendingFilter` is a tab still loading. The visible
  // tab only switches once its page has arrived, so a failed fetch never shows the wrong list.
  const [filter, setFilter] = useState<ReadFilter>('all');
  const [pendingFilter, setPendingFilter] = useState<ReadFilter | null>(null);
  const filterRef = useRef<ReadFilter>('all');
  // Bumped by every tab switch: list responses that started before it are stale and dropped.
  const listRequestRef = useRef(0);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState(initialPage === null);
  const [markingAll, setMarkingAll] = useState(false);
  const [preferences, setPreferences] = useState(initialPreferences ?? []);
  const [preferenceError, setPreferenceError] = useState(initialPreferences === null);
  const [pendingPreference, setPendingPreference] = useState<NotificationType | null>(null);

  async function fetchPage(nextFilter: ReadFilter, cursor?: string) {
    const params = new URLSearchParams({ limit: '20' });
    if (cursor) params.set('cursor', cursor);
    if (nextFilter !== 'all') params.set('isRead', String(nextFilter === 'read'));

    const response = await fetch(`/api/notifications?${params.toString()}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    });
    if (response.status === 401) {
      router.push('/login?next=/notifications');
      throw new Error('Authentication required');
    }
    if (!response.ok) throw new Error('Request failed');
    return parseNotificationPage(await response.json());
  }

  async function selectFilter(nextFilter: ReadFilter) {
    if (nextFilter === (pendingFilter ?? filter)) return;
    const request = ++listRequestRef.current;
    if (nextFilter === filter) {
      // Back to the tab already on screen: abandon the pending switch.
      setPendingFilter(null);
      setIsLoading(false);
      return;
    }
    setPendingFilter(nextFilter);
    setIsLoading(true);
    setLoadError(false);
    try {
      const page = await fetchPage(nextFilter);
      if (request !== listRequestRef.current) return;
      filterRef.current = nextFilter;
      startTransition(() => {
        setFilter(nextFilter);
        setItems(page.items);
        setNextCursor(page.nextCursor);
        setUnreadCount(page.unreadCount);
      });
    } catch {
      if (request === listRequestRef.current) setLoadError(true);
    } finally {
      if (request === listRequestRef.current) {
        setPendingFilter(null);
        setIsLoading(false);
      }
    }
  }

  async function loadMore() {
    if (!nextCursor || isLoading) return;
    const request = listRequestRef.current;
    setIsLoading(true);
    setLoadError(false);
    try {
      const page = await fetchPage(filter, nextCursor);
      if (request !== listRequestRef.current) return;
      startTransition(() => {
        setItems((current) => {
          const known = new Set(current.map((item) => item.id));
          return [...current, ...page.items.filter((item) => !known.has(item.id))];
        });
        setNextCursor(page.nextCursor);
        setUnreadCount(page.unreadCount);
      });
    } catch {
      if (request === listRequestRef.current) setLoadError(true);
    } finally {
      if (request === listRequestRef.current) setIsLoading(false);
    }
  }

  async function markRead(notification: AppNotification) {
    if (notification.isRead) return true;
    // Functional updates only: pages loaded while this request is in flight must survive a rollback.
    setItems((current) => current.map((item) => (
      item.id === notification.id ? { ...item, isRead: true } : item
    )));
    setUnreadCount((current) => Math.max(0, current - 1));

    try {
      const response = await fetch(`/api/notifications/${encodeURIComponent(notification.id)}/read`, {
        method: 'PATCH',
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) throw new Error('Request failed');
      if (filterRef.current === 'unread') {
        setItems((current) => current.filter((item) => item.id !== notification.id));
      }
      return true;
    } catch {
      // Targeted rollback: revert only this notification, keep everything else as it is now.
      setItems((current) => current.map((item) => (
        item.id === notification.id ? { ...item, isRead: false } : item
      )));
      setUnreadCount((current) => current + 1);
      setLoadError(true);
      return false;
    }
  }

  async function openNotification(notification: AppNotification) {
    const updated = await markRead(notification);
    const href = notificationHref(notification);
    if (updated && href) router.push(href);
  }

  async function markAllRead() {
    if (markingAll || unreadCount === 0) return;
    setMarkingAll(true);
    setLoadError(false);
    try {
      const response = await fetch('/api/notifications/read-all', {
        method: 'PATCH',
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) throw new Error('Request failed');
      parseMarkAllRead(await response.json());
      setUnreadCount(0);
      setItems((current) => filterRef.current === 'unread' ? [] : current.map((item) => ({ ...item, isRead: true })));
    } catch {
      setLoadError(true);
    } finally {
      setMarkingAll(false);
    }
  }

  async function togglePreference(preference: NotificationPreference) {
    if (pendingPreference) return;
    const enabled = !preference.enabled;
    setPendingPreference(preference.type);
    setPreferenceError(false);
    setPreferences((current) => current.map((item) => (
      item.type === preference.type ? { ...item, enabled } : item
    )));

    try {
      const response = await fetch(`/api/notifications/preferences/${preference.type}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) throw new Error('Request failed');
      const saved = parseNotificationPreference(await response.json());
      setPreferences((current) => current.map((item) => item.type === saved.type ? saved : item));
    } catch {
      setPreferences((current) => current.map((item) => (
        item.type === preference.type ? preference : item
      )));
      setPreferenceError(true);
    } finally {
      setPendingPreference(null);
    }
  }

  return (
    <Container className="py-8 sm:py-12">
      <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-14">
        <section aria-labelledby="notifications-title" className="min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-5 border-b border-border pb-7">
            <div>
              <p className="text-[length:var(--text-overline)] font-bold uppercase text-primary">
                {t('notifications.inbox')}
              </p>
              <div className="mt-2 flex items-center gap-3">
                <h1 id="notifications-title" className="text-[length:var(--text-h1)] font-bold text-foreground">
                  {t('notifications.title')}
                </h1>
                {unreadCount > 0 && (
                  <span className="inline-flex min-h-7 min-w-7 items-center justify-center rounded-full bg-primary px-2 text-[length:var(--text-caption)] font-bold text-primary-foreground" aria-label={t('notifications.unread_count', { count: unreadCount })}>
                    {unreadCount}
                  </span>
                )}
              </div>
              <p className="mt-3 text-[length:var(--text-body-lg)] text-muted-foreground">
                {t('notifications.subtitle')}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void markAllRead()}
              disabled={markingAll || unreadCount === 0}
              className="inline-flex min-h-11 items-center gap-2 rounded-md border border-border bg-card px-4 text-[length:var(--text-label)] font-bold text-foreground transition-colors hover:border-primary hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500 disabled:opacity-45 motion-reduce:transition-none"
            >
              <CheckCheck aria-hidden="true" className="size-4.5" />
              {markingAll ? t('common.loading') : t('notifications.mark_all_read')}
            </button>
          </div>

          <div className="mt-5 flex gap-1 rounded-md bg-muted p-1" role="group" aria-label={t('notifications.filter_label')}>
            {(['all', 'unread', 'read'] as const).map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={filter === value}
                aria-busy={pendingFilter === value || undefined}
                onClick={() => void selectFilter(value)}
                className={`inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-sm px-3 text-[length:var(--text-label)] font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500 motion-reduce:transition-none ${filter === value ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              >
                {pendingFilter === value && <PendingMark size={14} />}
                {t(`notifications.filter_${value}`)}
              </button>
            ))}
          </div>

          {loadError && (
            <p role="alert" className="mt-5 border-y border-error/40 py-3 text-[length:var(--text-label)] text-error">
              {t('notifications.unavailable')}
            </p>
          )}

          {isLoading && items.length === 0 ? (
            <NotificationSkeleton />
          ) : items.length === 0 ? (
            <div className="mt-8 border-y border-border py-14 text-center">
              <BellOff aria-hidden="true" className="mx-auto size-9 text-muted-foreground" />
              <h2 className="mt-4 text-[length:var(--text-h2)] font-bold text-foreground">{t('notifications.empty')}</h2>
              <p className="mt-2 text-[length:var(--text-body)] text-muted-foreground">{t('notifications.empty_subtitle')}</p>
            </div>
          ) : (
            <div
              className={`mt-6 divide-y divide-border border-y border-border transition-opacity motion-reduce:transition-none ${pendingFilter ? 'opacity-60' : ''}`}
              aria-live="polite"
              aria-busy={pendingFilter ? true : undefined}
            >
              {items.map((notification) => {
                const title = lang === 'ar' ? notification.titleAr : notification.title;
                const body = lang === 'ar' ? notification.bodyAr : notification.body;
                const href = notificationHref(notification);
                return (
                  <article key={notification.id} className={`relative grid grid-cols-[auto_1fr_auto] gap-3 py-5 sm:gap-5 sm:py-6 ${notification.isRead ? '' : 'bg-muted/45'}`}>
                    <span aria-hidden="true" className={`mt-2 size-2.5 rounded-full ${typeDotStyles[notification.type]}`} />
                    <button
                      type="button"
                      onClick={() => void openNotification(notification)}
                      className="min-w-0 text-start focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold-500"
                      aria-label={notification.isRead ? title : `${title}. ${t('notifications.unread')}`}
                    >
                      <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className={`text-[length:var(--text-body-lg)] text-foreground ${notification.isRead ? 'font-semibold' : 'font-bold'}`}>{title}</span>
                        <time dateTime={notification.createdAt} className="text-[length:var(--text-caption)] text-muted-foreground">
                          {formatRelativeTime(notification.createdAt, lang, t)}
                        </time>
                      </span>
                      <span className="mt-2 block text-[length:var(--text-body)] leading-6 text-muted-foreground">{body}</span>
                    </button>
                    <span className="flex items-center gap-2 text-muted-foreground">
                      {notification.isRead ? <MailOpen aria-hidden="true" className="size-4" /> : <Mail aria-hidden="true" className="size-4 text-primary" />}
                      {href && <ChevronRight aria-hidden="true" className="size-4 rtl:rotate-180" />}
                    </span>
                  </article>
                );
              })}
            </div>
          )}

          {nextCursor && (
            <div className="mt-8 flex justify-center">
              <button
                type="button"
                onClick={() => void loadMore()}
                disabled={isLoading}
                className="inline-flex min-h-12 items-center justify-center rounded-md border border-border bg-card px-6 text-[length:var(--text-button)] font-bold text-foreground hover:border-primary hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500 disabled:opacity-60"
              >
                {isLoading ? t('common.loading') : t('common.load_more')}
              </button>
            </div>
          )}
        </section>

        <aside aria-labelledby="notification-preferences-title" className="lg:border-s lg:border-border lg:ps-8">
          <div className="sticky top-24">
            <div className="flex items-center gap-3">
              <Settings2 aria-hidden="true" className="size-5 text-primary" />
              <h2 id="notification-preferences-title" className="text-[length:var(--text-h2)] font-bold text-foreground">
                {t('notifications.preferences')}
              </h2>
            </div>
            <p className="mt-3 text-[length:var(--text-body)] leading-6 text-muted-foreground">
              {t('notifications.preferences_subtitle')}
            </p>
            {preferenceError && <p role="alert" className="mt-4 text-[length:var(--text-label)] text-error">{t('notifications.preferences_unavailable')}</p>}
            <div className="mt-5 divide-y divide-border border-y border-border">
              {preferences.map((preference) => (
                <label key={preference.type} className="flex min-h-16 cursor-pointer items-center justify-between gap-4 py-3">
                  <span className="text-[length:var(--text-label)] font-semibold text-foreground">{t(`notifications.type_${preference.type}`)}</span>
                  <input
                    type="checkbox"
                    checked={preference.enabled}
                    disabled={pendingPreference !== null}
                    onChange={() => void togglePreference(preference)}
                    className="peer sr-only"
                  />
                  <span aria-hidden="true" className="relative h-7 w-12 shrink-0 rounded-full border border-border bg-muted transition-colors after:absolute after:start-1 after:top-1 after:size-[18px] after:rounded-full after:bg-muted-foreground after:transition-transform peer-checked:border-primary peer-checked:bg-primary peer-checked:after:translate-x-5 peer-checked:after:bg-primary-foreground peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-gold-500 rtl:peer-checked:after:-translate-x-5 motion-reduce:after:transition-none" />
                </label>
              ))}
            </div>
            <p className="mt-4 text-[length:var(--text-caption)] leading-5 text-muted-foreground">
              {t('notifications.in_app_note')}
            </p>
            <Link href="/home#account" className="mt-6 inline-flex min-h-11 items-center text-[length:var(--text-label)] font-bold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500">
              {t('profile.account')}
            </Link>
          </div>
        </aside>
      </div>
    </Container>
  );
}

function NotificationSkeleton() {
  return (
    <div className="mt-6 divide-y divide-border border-y border-border" aria-hidden="true">
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index} className="grid grid-cols-[auto_1fr] gap-4 py-6">
          <span className="mt-2 size-2.5 animate-pulse rounded-full bg-muted-foreground/40 motion-reduce:animate-none" />
          <div>
            <div className="h-5 w-2/5 animate-pulse rounded-xs bg-muted motion-reduce:animate-none" />
            <div className="mt-3 h-4 w-4/5 animate-pulse rounded-xs bg-muted motion-reduce:animate-none" />
          </div>
        </div>
      ))}
    </div>
  );
}

function notificationHref(notification: AppNotification): string | null {
  const data = notification.data ?? {};
  switch (notification.type) {
    case 'ORDER_UPDATE':
      return stringValue(data.orderId) ? `/orders/${encodeURIComponent(stringValue(data.orderId)!)}` : null;
    case 'ANNOUNCEMENT':
      return stringValue(data.announcementId) ? `/announcements/${encodeURIComponent(stringValue(data.announcementId)!)}` : null;
    case 'POLL':
      return stringValue(data.pollId) ? `/governance/polls/${encodeURIComponent(stringValue(data.pollId)!)}` : null;
    case 'ELECTION':
      return stringValue(data.electionId) ? `/governance/elections/${encodeURIComponent(stringValue(data.electionId)!)}` : null;
    case 'FEEDBACK_UPDATE':
      return stringValue(data.feedbackId) ? `/feedback/${encodeURIComponent(stringValue(data.feedbackId)!)}` : null;
  }
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function formatRelativeTime(
  iso: string,
  lang: 'ar' | 'en',
  t: (key: string, vars?: Record<string, string | number>) => string,
): string {
  const seconds = Math.round((new Date(iso).getTime() - Date.now()) / 1000);
  const formatter = new Intl.RelativeTimeFormat(lang === 'ar' ? 'ar-EG' : 'en', { numeric: 'auto' });
  if (Math.abs(seconds) < 60) return t('notifications.time_now');
  const minutes = Math.round(seconds / 60);
  if (Math.abs(minutes) < 60) return formatter.format(minutes, 'minute');
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return formatter.format(hours, 'hour');
  return formatter.format(Math.round(hours / 24), 'day');
}