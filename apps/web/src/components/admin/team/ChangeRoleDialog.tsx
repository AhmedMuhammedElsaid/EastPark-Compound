'use client';

import { LogOut, ShieldAlert } from 'lucide-react';
import * as React from 'react';

import { BACKDROP, useModalDialog } from '@/components/admin/residents/LeadDialogs';
import { roleLabel } from '@/lib/admin/activity-sentence';
import { ASSIGNABLE_ROLES, type AssignableRole } from '@/lib/auth/roles';
import { useTranslation } from '@/lib/i18n';
import type { AdminUserItem } from '@/lib/validation/super-admin';

const FOCUS = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500';

/**
 * Explicit confirm step for a role change: pick the new role, read that the person will be signed
 * out everywhere, then confirm. Only roles the backend can assign are offered.
 */
export function ChangeRoleDialog({
  user,
  onConfirm,
  onCancel,
}: {
  user: AdminUserItem | null;
  onConfirm: (user: AdminUserItem, role: AssignableRole) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const ref = useModalDialog(Boolean(user), onCancel);
  // Keep the last user rendered while the dialog closes.
  const [shown, setShown] = React.useState<AdminUserItem | null>(user);
  const [choice, setChoice] = React.useState<AssignableRole | null>(null);
  if (user && user !== shown) {
    setShown(user);
    setChoice(null);
  }

  const titleId = React.useId();
  const bodyId = React.useId();
  const name = shown ? shown.name || shown.email : '';
  const canConfirm = Boolean(shown && choice && choice !== shown.role);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={bodyId}
      className={`lead-dialog m-auto w-[min(30rem,calc(100vw-2rem))] rounded-xl border border-border bg-card p-0 text-foreground shadow-2xl ${BACKDROP}`}
    >
      {shown && (
        <form
          className="p-6"
          onSubmit={(event) => {
            event.preventDefault();
            if (!choice || choice === shown.role) return;
            onConfirm(shown, choice);
            ref.current?.close();
          }}
        >
          <h2 id={titleId} className="text-[length:var(--text-h2)] font-bold">
            {t('admin_team.dialog_title', { name })}
          </h2>
          <p className="mt-1 text-[length:var(--text-body)] text-muted-foreground">
            {t('admin_team.dialog_current', { role: roleLabel(shown.role, t) })}
          </p>

          <fieldset className="mt-5">
            <legend className="text-[length:var(--text-label)] font-semibold">{t('admin_team.dialog_choose')}</legend>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {ASSIGNABLE_ROLES.map((role) => {
                const current = role === shown.role;
                const selected = choice === role;
                return (
                  <label
                    key={role}
                    className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-md border px-3 text-[length:var(--text-body)] font-semibold transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-gold-500 ${selected ? 'border-primary bg-primary/12' : 'border-border hover:border-primary/60'} ${current ? 'cursor-not-allowed opacity-50' : ''}`}
                  >
                    <input
                      type="radio"
                      name="role"
                      value={role}
                      checked={selected}
                      disabled={current}
                      onChange={() => setChoice(role)}
                      className="size-4 accent-[var(--color-primary)]"
                    />
                    {roleLabel(role, t)}
                  </label>
                );
              })}
            </div>
          </fieldset>

          <div id={bodyId} className="mt-5 space-y-3 text-[length:var(--text-body)] leading-relaxed">
            <p className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-foreground">
              <LogOut aria-hidden="true" className="mt-1 size-4 shrink-0 rtl:-scale-x-100" />
              <span>{t('admin_team.dialog_signout', { name })}</span>
            </p>
            {choice === 'ADMIN' && (
              <p className="flex items-start gap-2 rounded-md border border-info/45 bg-info/10 px-3 py-2 text-foreground">
                <ShieldAlert aria-hidden="true" className="mt-1 size-4 shrink-0" />
                <span>{t('admin_team.dialog_admin_note')}</span>
              </p>
            )}
          </div>

          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              autoFocus
              onClick={() => ref.current?.close()}
              className={`inline-flex min-h-11 items-center justify-center rounded-md border border-border px-5 text-[length:var(--text-button)] font-semibold hover:bg-muted ${FOCUS}`}
            >
              {t('admin_team.dialog_cancel')}
            </button>
            <button
              type="submit"
              disabled={!canConfirm}
              className={`inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-5 text-[length:var(--text-button)] font-bold text-primary-foreground hover:bg-gold-600 disabled:cursor-not-allowed disabled:opacity-45 ${FOCUS}`}
            >
              {t('admin_team.dialog_confirm')}
            </button>
          </div>
        </form>
      )}
    </dialog>
  );
}
