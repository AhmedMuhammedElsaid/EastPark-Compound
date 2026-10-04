'use client';

import { Lock, Search, SearchX, ShieldCheck, Trash2, UserCog, UserX, X } from 'lucide-react';
import * as React from 'react';

import { LeadToasts, useToasts } from '@/components/admin/residents/LeadToasts';
import { roleLabel } from '@/lib/admin/activity-sentence';
import {
  changeUserRole,
  deleteUser,
  fetchUsers,
  SuperAdminRequestError,
  teamErrorKey,
  type AdminUserItem,
} from '@/lib/api/super-admin';
import { useAuth } from '@/lib/auth/AuthProvider';
import { ROLES, type AssignableRole, type RoleName } from '@/lib/auth/roles';
import { useTranslation } from '@/lib/i18n';

import { ChangeRoleDialog } from './ChangeRoleDialog';
import { ConfirmActionDialog, type ConfirmContent } from './ConfirmActionDialog';
import { EmptyState, ErrorState, FOCUS, initialOf, LoadMoreButton, PanelHeader, RowsSkeleton, SELECT_CLASS } from './panel-parts';
import { RoleBadge } from './RoleBadge';

const FILTER_ROLES = ROLES.filter((role) => role !== 'GUEST');
const SEARCH_DEBOUNCE_MS = 350;

function errorStatus(error: unknown): [number, string | undefined] {
  return error instanceof SuperAdminRequestError ? [error.status, error.code] : [0, undefined];
}

/** SUPER_ADMIN only: search accounts and change their role (RESIDENT / MERCHANT / ADMIN). */
export function TeamRolesPanel() {
  const { t } = useTranslation();
  const { user: viewer } = useAuth();
  const { toasts, push, dismiss } = useToasts();

  const [query, setQuery] = React.useState('');
  const [debouncedQuery, setDebouncedQuery] = React.useState('');
  const [role, setRole] = React.useState<RoleName | ''>('');
  const [rows, setRows] = React.useState<AdminUserItem[]>([]);
  const [nextCursor, setNextCursor] = React.useState<string | undefined>();
  const [listState, setListState] = React.useState<'loading' | 'ready' | 'error'>('loading');
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [reloadKey, setReloadKey] = React.useState(0);
  const [pendingId, setPendingId] = React.useState<string | null>(null);
  const [editing, setEditing] = React.useState<AdminUserItem | null>(null);
  const [deleting, setDeleting] = React.useState<AdminUserItem | null>(null);
  const listSeq = React.useRef(0);
  const debouncedRef = React.useRef('');

  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      const next = query.trim();
      if (next === debouncedRef.current) return;
      debouncedRef.current = next;
      setListState('loading');
      setDebouncedQuery(next);
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [query]);

  // First page for the current search + filter; a newer request supersedes an older one.
  React.useEffect(() => {
    const seq = ++listSeq.current;
    void (async () => {
      try {
        const page = await fetchUsers({ q: debouncedQuery || undefined, role: role || undefined });
        if (seq !== listSeq.current) return;
        setRows(page.items);
        setNextCursor(page.nextCursor);
        setListState('ready');
      } catch {
        if (seq === listSeq.current) setListState('error');
      }
    })();
  }, [debouncedQuery, role, reloadKey]);

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    const seq = listSeq.current;
    setLoadingMore(true);
    try {
      const page = await fetchUsers({ q: debouncedQuery || undefined, role: role || undefined, cursor: nextCursor });
      if (seq !== listSeq.current) return;
      setRows((current) => {
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

  async function applyRole(target: AdminUserItem, nextRole: AssignableRole) {
    setPendingId(target.id);
    const name = target.name || target.email;
    try {
      const updated = await changeUserRole(target.id, nextRole);
      setRows((current) => current.map((item) => (item.id === target.id ? (updated ?? { ...item, role: nextRole }) : item)));
      push('success', t('admin_team.success', { name, role: roleLabel(nextRole, t) }));
    } catch (error) {
      push('error', t(`admin_team.errors.${teamErrorKey(...errorStatus(error))}`));
    } finally {
      setPendingId(null);
    }
  }

  async function removeUser(target: AdminUserItem) {
    setPendingId(target.id);
    const name = target.name || target.email;
    try {
      await deleteUser(target.id);
      setRows((current) => current.filter((item) => item.id !== target.id));
      push('success', t('admin_team.delete_success', { name }));
    } catch (error) {
      push('error', t(`admin_team.errors.${teamErrorKey(...errorStatus(error))}`));
    } finally {
      setPendingId(null);
    }
  }

  const closeDialog = React.useCallback(() => setEditing(null), []);
  const closeDelete = React.useCallback(() => setDeleting(null), []);
  const deleteContent = React.useMemo<ConfirmContent | null>(() => {
    if (!deleting) return null;
    const name = deleting.name || deleting.email;
    return {
      title: t('admin_team.delete_title', { name }),
      icon: UserX,
      tone: 'danger',
      body: (
        <>
          <p>{t('admin_team.delete_body', { name })}</p>
          <p className="text-muted-foreground">{t('admin_team.delete_restore_note')}</p>
        </>
      ),
      confirmLabel: t('admin_team.delete_confirm'),
      cancelLabel: t('admin_team.dialog_cancel'),
    };
  }, [deleting, t]);
  const searchId = React.useId();
  const roleId = React.useId();
  const titleId = React.useId();
  const filtered = Boolean(debouncedQuery || role);

  return (
    <section aria-labelledby={titleId} className="border-t border-border pt-8">
      <PanelHeader titleId={titleId} icon={UserCog} title={t('admin_team.title')} intro={t('admin_team.intro')} />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label htmlFor={searchId} className="mb-1.5 block text-[length:var(--text-label)] font-semibold text-muted-foreground">
            {t('admin_team.search_label')}
          </label>
          <div className="relative">
            <Search aria-hidden="true" className="pointer-events-none absolute start-3.5 top-1/2 size-4.5 -translate-y-1/2 text-muted-foreground" />
            <input
              id={searchId}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('admin_team.search_placeholder')}
              autoComplete="off"
              enterKeyHint="search"
              maxLength={100}
              className={`min-h-12 w-full rounded-md border border-input bg-background ps-11 pe-12 text-[length:var(--text-body)] placeholder:text-muted-foreground focus:border-primary ${FOCUS} [&::-webkit-search-cancel-button]:hidden`}
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label={t('admin_leads.clear_search')}
                className={`absolute end-1 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground ${FOCUS}`}
              >
                <X aria-hidden="true" className="size-4" />
              </button>
            )}
          </div>
        </div>
        <div className="sm:w-52">
          <label htmlFor={roleId} className="mb-1.5 block text-[length:var(--text-label)] font-semibold text-muted-foreground">
            {t('admin_team.role_filter')}
          </label>
          <select id={roleId} value={role} onChange={(event) => {
              setListState('loading');
              setRole(event.target.value as RoleName | '');
            }} className={SELECT_CLASS}>
            <option value="">{t('admin_team.filter_all')}</option>
            {FILTER_ROLES.map((value) => (
              <option key={value} value={value}>
                {roleLabel(value, t)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-5" aria-busy={listState === 'loading' || undefined}>
        {listState === 'loading' && <RowsSkeleton />}
        {listState === 'error' && (
          <ErrorState message={t('admin_team.load_error')} retryLabel={t('admin_team.retry')} onRetry={() => {
              setListState('loading');
              setReloadKey((key) => key + 1);
            }} />
        )}
        {listState === 'ready' && rows.length === 0 && (
          <EmptyState message={filtered ? t('admin_team.empty') : t('admin_team.empty_all')} icon={filtered ? SearchX : undefined} />
        )}
        {listState === 'ready' && rows.length > 0 && (
          <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
            {rows.map((person) => {
              const name = person.name || person.email;
              const isSelf = person.id === viewer?.id;
              const locked = person.role === 'SUPER_ADMIN';
              const pending = pendingId === person.id;
              return (
                <li key={person.id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:gap-4">
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted font-bold text-primary">
                      {initialOf(name)}
                    </span>
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-x-2 text-[length:var(--text-body-lg)] font-bold">
                        <bdi className="truncate">{name}</bdi>
                        {isSelf && (
                          <span className="rounded-sm bg-muted px-1.5 text-[length:var(--text-caption)] font-semibold text-muted-foreground">
                            {t('admin_team.you')}
                          </span>
                        )}
                      </p>
                      <p className="truncate text-[length:var(--text-body)] text-muted-foreground">
                        <bdi>{person.email}</bdi>
                      </p>
                      <p className="text-[length:var(--text-caption)] text-muted-foreground">
                        {person.unitNumber ? t('admin_team.unit', { unit: person.unitNumber }) : t('admin_team.no_unit')}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 ps-13 sm:ps-0">
                    <RoleBadge role={person.role} />
                    {locked ? (
                      <span
                        title={t('admin_team.locked_hint')}
                        className="inline-flex min-h-11 items-center gap-2 rounded-md border border-dashed border-border px-3 text-[length:var(--text-label)] font-semibold text-muted-foreground"
                      >
                        <Lock aria-hidden="true" className="size-4" />
                        {t('admin_team.locked')}
                        <span className="sr-only">{t('admin_team.locked_hint')}</span>
                      </span>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => setEditing(person)}
                          disabled={pending}
                          aria-busy={pending || undefined}
                          aria-label={t('admin_team.change_role_for', { name })}
                          className={`inline-flex min-h-11 items-center gap-2 rounded-md border border-border px-4 text-[length:var(--text-button)] font-semibold text-foreground hover:border-primary/60 hover:bg-muted disabled:cursor-wait disabled:opacity-60 ${FOCUS} ${pending ? 'lead-pending' : ''}`}
                        >
                          <ShieldCheck aria-hidden="true" className="size-4" />
                          {pending ? t('admin_team.saving') : t('admin_team.change_role')}
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleting(person)}
                          disabled={pending}
                          aria-label={t('admin_team.delete_for', { name })}
                          className={`inline-flex min-h-11 items-center gap-2 rounded-md border border-error/55 px-4 text-[length:var(--text-button)] font-semibold text-foreground hover:bg-error/10 disabled:cursor-wait disabled:opacity-60 ${FOCUS}`}
                        >
                          <Trash2 aria-hidden="true" className="size-4 text-error" />
                          {t('admin_team.delete')}
                        </button>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {listState === 'ready' && nextCursor && (
          <LoadMoreButton label={t('admin_team.load_more')} loading={loadingMore} onClick={() => void loadMore()} />
        )}
      </div>

      <ChangeRoleDialog user={editing} onConfirm={(target, nextRole) => void applyRole(target, nextRole)} onCancel={closeDialog} />
      <ConfirmActionDialog
        content={deleteContent}
        onConfirm={() => {
          if (deleting) void removeUser(deleting);
        }}
        onCancel={closeDelete}
      />
      <LeadToasts toasts={toasts} onDismiss={dismiss} />
    </section>
  );
}
