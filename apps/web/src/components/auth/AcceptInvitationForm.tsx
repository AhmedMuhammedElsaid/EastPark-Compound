'use client';

import type { AuthUser } from '@/lib/api/contracts';
import type { AcceptInvitationFormInput } from '@/lib/validation/auth';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { useForm } from 'react-hook-form';

import { Button } from '@/components/Button';
import { useAuth } from '@/lib/auth/AuthProvider';
import { useTranslation } from '@/lib/i18n';
import { acceptInvitationFormSchema } from '@/lib/validation/auth';

export function AcceptInvitationForm({ token }: { token: string | null }) {
  const router = useRouter();
  const { establishSession } = useAuth();
  const { t } = useTranslation();
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [showPasswords, setShowPasswords] = React.useState(false);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<AcceptInvitationFormInput>({
    resolver: zodResolver(acceptInvitationFormSchema),
  });

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
        return <div key={name}><label htmlFor={name} className="mb-2 block text-[length:var(--text-label)] font-semibold text-foreground">{t(name === 'password' ? 'auth.password' : 'auth.confirm_password')}</label><input id={name} type={showPasswords ? 'text' : 'password'} autoComplete="new-password" dir="ltr" aria-invalid={Boolean(error)} aria-describedby={error ? `${name}-error` : undefined} className="min-h-12 w-full rounded-md border border-input bg-background px-4 text-[length:var(--text-body-lg)] text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring/25" {...register(name)} />{error && <p id={`${name}-error`} role="alert" className="mt-2 text-[length:var(--text-caption)] text-error">{t(error.message ?? 'common.error')}</p>}</div>;
      })}
      <label className="flex min-h-11 items-center gap-3 text-[length:var(--text-body)] text-muted-foreground"><input type="checkbox" checked={showPasswords} onChange={(event) => setShowPasswords(event.target.checked)} className="size-5 accent-primary" />{t(showPasswords ? 'auth.hide_password' : 'auth.show_password')}</label>
      {submitError && <div role="alert" className="rounded-sm bg-error/12 px-4 py-3 text-[length:var(--text-body)] text-error"><p>{submitError}</p>{submitError === t('auth.invitation_invalid') && <p className="mt-1">{t('auth.contact_administrator')}</p>}</div>}
      <Button type="submit" fullWidth disabled={isSubmitting} aria-busy={isSubmitting}>{isSubmitting ? t('common.loading') : t('auth.complete_setup')}</Button>
    </form>
  );
}