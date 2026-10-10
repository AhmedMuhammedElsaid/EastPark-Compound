'use client';

import { History, RefreshCw } from 'lucide-react';
import * as React from 'react';

import { formatExact, formatRelative } from '@/components/admin/residents/lead-format';
import { LeadToasts, useToasts } from '@/components/admin/residents/LeadToasts';
import { activityParts } from '@/lib/admin/activity-sentence';
import {
  fetchActivity,
  fetchAdminActors,
  SuperAdminRequestError,
  teamErrorKey,
  type ActivityItem,
  type AdminUserItem,
} from '@/lib/api/super-admin';
import { useTranslation } from '@/lib/i18n';
import { displayUserName } from '@/lib/user-name';

import { EmptyState, ErrorState, FOCUS, initialOf, LoadMoreButton, PanelHeader, RowsSkeleton, SELECT_CLASS } from './panel-parts';
import { RoleBadge } from './RoleBadge';

/** SUPER_ADMIN only: readable feed of everything admins do, newest first, filterable by admin. */
export function ActivityLogPanel() {
  const { t, lang } = useTranslation();
  const { toasts, push, dismiss } = useToasts();

  const [actorId, setActorId] = React.useState('');
  const [actors, setActors] = React.useState<AdminUserItem[]>([]);
  const [items, setItems] = React.useState<ActivityItem[]>([]);
  const [nextCursor, setNextCursor] = React.useState<string | undefined>();
  const [listState, setListState] = React.useState<'loading' | 'ready' | 'error'>('loading');
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [reloadKey, setReloadKey] = React.useState(0);
  const listSeq = React.useRef(0);

  // The filter lists every admin-like account, not only actors seen in the loaded page.
  React.useEffect(() => {
    let active = true;
    void fetchAdminActors().then((list) => {
      if (active) setActors(list);
    });
    return () => {
      active = false;
    };
  }, []);

  React.useEffect(() => {
    const seq = ++listSeq.current;
    void (async () => {
      try {
        const page = await fetchActivity({ actorId: actorId || undefined });
        if (seq !== listSeq.current) return;
        setItems(page.items);
        setNextCursor(page.nextCursor);
        setListState('ready');
      } catch {
        if (seq === listSeq.current) setListState('error');
      }
    })();
  }, [actorId, reloadKey]);

  function reload() {
    setListState('loading');
    setReloadKey((key) => key + 1);
  }

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    const seq = listSeq.current;
    setLoadingMore(true);
    try {
      const page = await fetchActivity({ actorId: actorId || undefined, cursor: nextCursor });
      if (seq !== listSeq.current) return;
      setItems((current) => {
        const seen = new Set(current.map((item) => item.id));
        return [...current, ...page.items.filter((item) => !seen.has(item.id))];
      });
      setNextCursor(page.nextCursor);
    } catch (error) {
      const [status, code] = error instanceof SuperAdminRequestError ? [error.status, error.code] : [0, undefined];
      push('error', t(`admin_team.errors.${teamErrorKey(status, code)}`));
    } finally {
      setLoadingMore(false);
    }
  }

  const filterId = React.useId();
  const titleId = React.useId();

  return (
    <section aria-labelledby={titleId} className="border-t border-border pt-8">
      <PanelHeader
        titleId={titleId}
        icon={History}
        title={t('admin_activity.title')}
        intro={t('admin_activity.intro')}
        action={
          <button
            type="button"
            onClick={reload}
            disabled={listState === 'loading'}
            className={`inline-flex min-h-11 items-center gap-2 rounded-md border border-border px-4 text-[length:var(--text-button)] font-semibold text-foreground hover:bg-muted disabled:opacity-60 ${FOCUS}`}
          >
            <RefreshCw aria-hidden="true" className="size-4" />
            {t('admin_activity.refresh')}
          </button>
        }
      />

      <div className="sm:max-w-xs">
        <label htmlFor={filterId} className="mb-1.5 block text-[length:var(--text-label)] font-semibold text-muted-foreground">
          {t('admin_activity.filter_label')}
        </label>
        <select
          id={filterId}
          value={actorId}
          onChange={(event) => {
            setListState('loading');
            setActorId(event.target.value);
          }}
          className={SELECT_CLASS}
        >
          <option value="">{t('admin_activity.filter_all')}</option>
          {actors.map((actor) => (
            <option key={actor.id} value={actor.id}>
              {displayUserName(actor.name, t('common.deleted_user')) || actor.email}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-5" aria-busy={listState === 'loading' || undefined}>
        {listState === 'loading' && <RowsSkeleton />}
        {listState === 'error' && (
          <ErrorState message={t('admin_activity.load_error')} retryLabel={t('admin_activity.retry')} onRetry={reload} />
        )}
        {listState === 'ready' && items.length === 0 && (
          <EmptyState message={actorId ? t('admin_activity.empty_filtered') : t('admin_activity.empty')} icon={History} />
        )}
        {listState === 'ready' && items.length > 0 && (
          <ol className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
            {items.map((item) => {
              const parts = activityParts(item, t);
              return (
                <li key={item.id} className="flex items-start gap-3 px-4 py-4">
                  <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted font-bold text-primary">
                    {initialOf(parts.actor)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[length:var(--text-body)] leading-relaxed text-muted-foreground">
                      <bdi className="font-bold text-foreground">{parts.actor}</bdi> {parts.verb}
                      {parts.label && (
                        <>
                          {': '}
                          <bdi className="break-words font-semibold text-foreground">{parts.label}</bdi>
                        </>
                      )}
                    </p>
                    {parts.detail && (
                      <p className="mt-1 text-[length:var(--text-caption)] font-semibold text-foreground">{parts.detail}</p>
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
                      {item.createdAt && (
                        <time dateTime={item.createdAt} title={formatExact(item.createdAt, lang)} className="text-[length:var(--text-caption)] text-muted-foreground">
                          {formatRelative(item.createdAt, lang)}
                        </time>
                      )}
                      {item.actor?.role && <RoleBadge role={item.actor.role} />}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
        {listState === 'ready' && nextCursor && (
          <LoadMoreButton label={t('admin_activity.load_more')} loading={loadingMore} onClick={() => void loadMore()} />
        )}
      </div>

      <LeadToasts toasts={toasts} onDismiss={dismiss} />
    </section>
  );
}
