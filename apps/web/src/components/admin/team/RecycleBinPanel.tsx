'use client';

import type { LucideIcon } from 'lucide-react';

import { ArchiveRestore, Image as ImageIcon, Info, Package, RefreshCw, Star, Store, Trash2, UsersRound } from 'lucide-react';
import * as React from 'react';

import { formatExact, formatRelative } from '@/components/admin/residents/lead-format';
import { LeadToasts, useToasts } from '@/components/admin/residents/LeadToasts';
import {
  fetchTrash,
  restoreTrashItem,
  SuperAdminRequestError,
  teamErrorKey,
  type TrashItem,
  type TrashType,
} from '@/lib/api/super-admin';
import { useTranslation } from '@/lib/i18n';
import { TRASH_TYPES, trashReasonKey } from '@/lib/validation/trash';

import { ConfirmActionDialog, type ConfirmContent } from './ConfirmActionDialog';
import { EmptyState, ErrorState, FOCUS, LoadMoreButton, PanelHeader, RowsSkeleton } from './panel-parts';

const TYPE_ICONS: Record<TrashType, LucideIcon> = {
  USER: UsersRound,
  SHOP: Store,
  SHOP_PHOTO: ImageIcon,
  PRODUCT: Package,
  REVIEW: Star,
};

function errorStatus(error: unknown): [number, string | undefined] {
  return error instanceof SuperAdminRequestError ? [error.status, error.code] : [0, undefined];
}

/** SUPER_ADMIN only: soft-deleted users, shops, shop photos, products and reviews, with restore. */
export function RecycleBinPanel() {
  const { t, lang } = useTranslation();
  const { toasts, push, dismiss } = useToasts();

  const [type, setType] = React.useState<TrashType>('USER');
  const [items, setItems] = React.useState<TrashItem[]>([]);
  const [nextCursor, setNextCursor] = React.useState<string | undefined>();
  const [listState, setListState] = React.useState<'loading' | 'ready' | 'error'>('loading');
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [reloadKey, setReloadKey] = React.useState(0);
  const [pendingId, setPendingId] = React.useState<string | null>(null);
  const [confirming, setConfirming] = React.useState<TrashItem | null>(null);
  const listSeq = React.useRef(0);

  // First page for the selected type; a newer request (type switch, reload) supersedes an older one.
  React.useEffect(() => {
    const seq = ++listSeq.current;
    void (async () => {
      try {
        const page = await fetchTrash({ type });
        if (seq !== listSeq.current) return;
        setItems(page.items);
        setNextCursor(page.nextCursor);
        setListState('ready');
      } catch {
        if (seq === listSeq.current) setListState('error');
      }
    })();
  }, [type, reloadKey]);

  function reload() {
    setListState('loading');
    setReloadKey((key) => key + 1);
  }

  function selectType(next: TrashType) {
    if (next === type) return;
    setListState('loading');
    setItems([]);
    setNextCursor(undefined);
    setType(next);
  }

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    const seq = listSeq.current;
    setLoadingMore(true);
    try {
      const page = await fetchTrash({ type, cursor: nextCursor });
      if (seq !== listSeq.current) return;
      setItems((current) => {
        const seen = new Set(current.map((item) => item.id));
        return [...current, ...page.items.filter((item) => !seen.has(item.id))];
      });
      setNextCursor(page.nextCursor);
    } catch (error) {
      push('error', t(`admin_team.errors.${teamErrorKey(...errorStatus(error))}`));
    } finally {
      setLoadingMore(false);
    }
  }

  async function restore(target: TrashItem) {
    setPendingId(target.id);
    try {
      await restoreTrashItem(target.type, target.id);
      setItems((current) => current.filter((item) => item.id !== target.id));
      push('success', t('admin_trash.restore_success', { label: target.label || t(`admin_trash.types.${target.type}`) }));
    } catch (error) {
      const [status, code] = errorStatus(error);
      push('error', t(`admin_team.errors.${teamErrorKey(status, code)}`));
      // A conflict or a vanished item: reload so the row shows its current state and reason.
      if (status === 404 || status === 409) reload();
    } finally {
      setPendingId(null);
    }
  }

  const closeConfirm = React.useCallback(() => setConfirming(null), []);
  const confirmContent = React.useMemo<ConfirmContent | null>(() => {
    if (!confirming) return null;
    const label = confirming.label || t(`admin_trash.types.${confirming.type}`);
    return {
      title: t('admin_trash.restore_title', { label }),
      icon: ArchiveRestore,
      tone: 'primary',
      body: <p>{t(`admin_trash.restore_body.${confirming.type}`)}</p>,
      confirmLabel: t('admin_trash.restore_confirm'),
      cancelLabel: t('admin_team.dialog_cancel'),
    };
  }, [confirming, t]);

  const titleId = React.useId();
  const switcherId = React.useId();
  const TypeIcon = TYPE_ICONS[type];

  return (
    <section aria-labelledby={titleId} className="border-t border-border pt-8">
      <PanelHeader
        titleId={titleId}
        icon={Trash2}
        title={t('admin_trash.title')}
        intro={t('admin_trash.intro')}
        action={
          <button
            type="button"
            onClick={reload}
            disabled={listState === 'loading'}
            className={`inline-flex min-h-11 items-center gap-2 rounded-md border border-border px-4 text-[length:var(--text-button)] font-semibold text-foreground hover:bg-muted disabled:opacity-60 ${FOCUS}`}
          >
            <RefreshCw aria-hidden="true" className="size-4" />
            {t('admin_trash.refresh')}
          </button>
        }
      />

      <p id={switcherId} className="mb-2 text-[length:var(--text-label)] font-semibold text-muted-foreground">
        {t('admin_trash.type_label')}
      </p>
      <div role="group" aria-labelledby={switcherId} className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2">
        {TRASH_TYPES.map((value) => {
          const Icon = TYPE_ICONS[value];
          const active = value === type;
          return (
            <button
              key={value}
              type="button"
              aria-pressed={active}
              onClick={() => selectType(value)}
              className={`inline-flex min-h-12 shrink-0 items-center gap-2 rounded-md border px-4 text-[length:var(--text-label)] font-semibold transition-colors ${FOCUS} ${active ? 'border-primary bg-primary/12 text-foreground' : 'border-border text-muted-foreground hover:border-primary/60 hover:text-foreground'}`}
            >
              <Icon aria-hidden="true" className={`size-4.5 ${active ? 'text-primary' : ''}`} />
              {t(`admin_trash.types.${value}`)}
            </button>
          );
        })}
      </div>

      <div className="mt-4" aria-busy={listState === 'loading' || undefined}>
        {listState === 'loading' && <RowsSkeleton />}
        {listState === 'error' && (
          <ErrorState message={t('admin_trash.load_error')} retryLabel={t('admin_trash.retry')} onRetry={reload} />
        )}
        {listState === 'ready' && items.length === 0 && (
          <EmptyState message={t(`admin_trash.empty.${type}`)} icon={TypeIcon} />
        )}
        {listState === 'ready' && items.length > 0 && (
          <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
            {items.map((item) => (
              <TrashRow
                key={item.id}
                item={item}
                lang={lang}
                pending={pendingId === item.id}
                onRestore={() => setConfirming(item)}
              />
            ))}
          </ul>
        )}
        {listState === 'ready' && nextCursor && (
          <LoadMoreButton label={t('admin_trash.load_more')} loading={loadingMore} onClick={() => void loadMore()} />
        )}
      </div>

      <ConfirmActionDialog
        content={confirmContent}
        onConfirm={() => {
          if (confirming) void restore(confirming);
        }}
        onCancel={closeConfirm}
      />
      <LeadToasts toasts={toasts} onDismiss={dismiss} />
    </section>
  );
}

function TrashRow({
  item,
  lang,
  pending,
  onRestore,
}: {
  item: TrashItem;
  lang: string;
  pending: boolean;
  onRestore: () => void;
}) {
  const { t } = useTranslation();
  const reasonId = React.useId();
  const Icon = TYPE_ICONS[item.type];
  const label = item.label || t(`admin_trash.types.${item.type}`);
  const deleter = item.deletedBy?.name.trim();

  return (
    <li className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:gap-4">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-primary">
          <Icon className="size-4.5" />
        </span>
        <div className="min-w-0">
          <p className="text-[length:var(--text-body-lg)] font-bold">
            <bdi className="break-words">{label}</bdi>
          </p>
          {item.sublabel && (
            <p className="truncate text-[length:var(--text-body)] text-muted-foreground">
              <bdi>{item.sublabel}</bdi>
            </p>
          )}
          <p className="mt-1 text-[length:var(--text-caption)] text-muted-foreground">
            {item.deletedAt && (
              <>
                {t('admin_trash.deleted')}{' '}
                <time dateTime={item.deletedAt} title={formatExact(item.deletedAt, lang)}>
                  {formatRelative(item.deletedAt, lang)}
                </time>
                {' · '}
              </>
            )}
            {deleter ? (
              <>
                {t('admin_trash.deleted_by')} <bdi className="font-semibold text-foreground">{deleter}</bdi>
              </>
            ) : (
              t('admin_trash.deleted_by_unknown')
            )}
          </p>
          {!item.restorable && (
            <p id={reasonId} className="mt-2 flex items-start gap-2 text-[length:var(--text-caption)] font-semibold text-foreground">
              <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-warning" />
              <span>{t(`admin_trash.reasons.${trashReasonKey(item.reason)}`)}</span>
            </p>
          )}
        </div>
      </div>
      <div className="ps-13 sm:ps-0">
        <button
          type="button"
          onClick={onRestore}
          disabled={pending || !item.restorable}
          aria-busy={pending || undefined}
          aria-describedby={item.restorable ? undefined : reasonId}
          aria-label={t('admin_trash.restore_for', { label })}
          className={`inline-flex min-h-11 items-center gap-2 rounded-md border border-primary/55 px-4 text-[length:var(--text-button)] font-semibold text-foreground hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-45 ${FOCUS} ${pending ? 'lead-pending cursor-wait' : ''}`}
        >
          <ArchiveRestore aria-hidden="true" className="size-4 text-primary" />
          {pending ? t('admin_trash.restoring') : t('admin_trash.restore')}
        </button>
      </div>
    </li>
  );
}
