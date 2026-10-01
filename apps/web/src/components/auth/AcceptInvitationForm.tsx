'use client';

import type { AuthUser } from '@/lib/api/contracts';
import type { AcceptInvitationFormInput } from '@/lib/validation/auth';

import { zodResolver } from '@hookform/resolvers/zod';
import { Check, Circle, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { useForm, useWatch } from 'react-hook-form';

import { Button } from '@/components/Button';
import { PasswordVisibilityButton } from '@/components/auth/PasswordVisibilityButton';
import { useAuth } from '@/lib/auth/AuthProvider';
import { useTranslation } from '@/lib/i18n';
import { acceptInvitationFormSchema, getPasswordRequirements } from '@/lib/validation/auth';

export function AcceptInvitationForm({ token }: { token: string | null }) {
  const router = useRouter();
  const { establishSession } = useAuth();
  const { t } = useTranslation();
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [showPasswords, setShowPasswords] = React.useState(false);
  const { control, register, handleSubmit, formState: { errors, isSubmitting } } = useForm<AcceptInvitationFormInput>({
    resolver: zodResolver(acceptInvitationFormSchema),
  });
  const password = useWatch({ control, name: 'password' }) ?? '';
  const passwordRequirements = getPasswordRequirements(password);

  const onSubmit = handleSubmit(async (values) => {
    if (!token) return;
    setSubmitError(null);
    try {
      const response = await fetch('/api/auth/accept-invitation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, name: values.name, password: values.password }),
        signal: AbortSignal.timeout(12_000),
      });
      const result = (await response.json()) as { data?: { user: AuthUser }; error?: string };
      if (!response.ok || !result.data) {
        const key = result.error === 'invalid_invitation'
          ? 'auth.invitation_invalid'
          : result.error === 'rate_limited' ? 'auth.errors.rate_limited' : 'errors.server';
        setSubmitError(t(key));
        return;
      }
      establishSession(result.data.user);
      router.replace('/home');
    } catch {
      setSubmitError(t('errors.network'));
    }
  });

  if (!token) {
    return (
      <div className="text-center" role="alert">
        <h2 className="text-[length:var(--text-h2)] font-bold text-card-foreground">{t('auth.invitation_invalid')}</h2>
        <p className="mt-3 text-[length:var(--text-body)] leading-6 text-muted-foreground">{t('auth.contact_administrator')}</p>
        <Link href="/login" className="mt-6 flex min-h-11 items-center justify-center font-semibold text-primary hover:underline">{t('auth.back_to_login')}</Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <div>
        <label htmlFor="name" className="mb-2 block text-[length:var(--text-label)] font-semibold text-foreground">{t('auth.name')}</label>
        <input id="name" type="text" autoComplete="name" aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? 'name-error' : undefined} className="min-h-12 w-full rounded-md border border-input bg-background px-4 text-[length:var(--text-body-lg)] text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring/25" {...register('name')} />
        {errors.name && <p id="name-error" role="alert" className="mt-2 text-[length:var(--text-caption)] text-error">{t(errors.name.message ?? 'auth.errors.name_too_short')}</p>}
      </div>
      {(['password', 'confirmPassword'] as const).map((name) => {
        const error = errors[name];
        const describedBy = [
          name === 'password' ? 'password-requirements' : null,
          error ? `${name}-error` : null,
        ].filter(Boolean).join(' ') || undefined;

        return (
          <div key={name}>
            <label htmlFor={name} className="mb-2 block text-[length:var(--text-label)] font-semibold text-foreground">
              {t(name === 'password' ? 'auth.password' : 'auth.confirm_password')}
            </label>
            <div className="relative" dir="ltr">
              <input
                id={name}
                type={showPasswords ? 'text' : 'password'}
                autoComplete="new-password"
                aria-invalid={Boolean(error)}
                aria-describedby={describedBy}
                className="min-h-12 w-full rounded-md border border-input bg-background py-0 pe-12 ps-4 text-[length:var(--text-body-lg)] text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring/25"
                {...register(name)}
              />
              <PasswordVisibilityButton visible={showPasswords} onToggle={() => setShowPasswords((value) => !value)} label={t(showPasswords ? 'auth.hide_password' : 'auth.show_password')} />
            </div>
            {name === 'password' && (
              <div id="password-requirements" className="mt-3" aria-label={t('auth.password_requirements.title')}>
                <p className="text-[length:var(--text-caption)] font-semibold text-muted-foreground">
                  {t('auth.password_requirements.title')}
                </p>
                <ul className="mt-2 grid gap-x-4 gap-y-2 sm:grid-cols-2">
                  {Object.entries(passwordRequirements).map(([requirement, met]) => {
                    const isMissing = password.length > 0 && !met;
                    const Icon = met ? Check : isMissing ? X : Circle;
                    return (
                      <li
                        key={requirement}
                        className={`flex items-center gap-2 text-[length:var(--text-caption)] ${met ? 'text-success' : isMissing ? 'text-error' : 'text-muted-foreground'}`}
                      >
                        <Icon aria-hidden="true" className="size-4 shrink-0" />
                        <span>{t(`auth.password_requirements.${requirement}`)}</span>
                        <span className="sr-only">: {t(`auth.password_requirements.${met ? 'met' : 'missing'}`)}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
            {error && <p id={`${name}-error`} role="alert" className="mt-2 text-[length:var(--text-caption)] text-error">{t(error.message ?? 'common.error')}</p>}
          </div>
        );
      })}
      {submitError && <div role="alert" className="rounded-sm bg-error/12 px-4 py-3 text-[length:var(--text-body)] text-error"><p>{submitError}</p>{submitError === t('auth.invitation_invalid') && <p className="mt-1">{t('auth.contact_administrator')}</p>}</div>}
      <Button type="submit" fullWidth disabled={isSubmitting} aria-busy={isSubmitting}>{isSubmitting ? t('common.loading') : t('auth.complete_setup')}</Button>
    </form>
  );
}