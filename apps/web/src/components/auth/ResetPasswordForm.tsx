'use client';

import type { ResetPasswordFormInput } from '@/lib/validation/auth';

import { zodResolver } from '@hookform/resolvers/zod';
import { CircleCheck } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';
import { useForm } from 'react-hook-form';

import { Button } from '@/components/Button';
import { PasswordVisibilityButton } from '@/components/auth/PasswordVisibilityButton';
import { useTranslation } from '@/lib/i18n';
import { resetPasswordFormSchema } from '@/lib/validation/auth';

export function ResetPasswordForm({ token }: { token: string | null }) {
  const { t } = useTranslation();
  const [completed, setCompleted] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [showPasswords, setShowPasswords] = React.useState(false);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<ResetPasswordFormInput>({
    resolver: zodResolver(resetPasswordFormSchema),
  });

  const onSubmit = handleSubmit(async (values) => {
    if (!token) return;
    setSubmitError(null);
    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password: values.password }),
        signal: AbortSignal.timeout(12_000),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        const key = result.error === 'invalid_token'
          ? 'auth.reset_link_expired'
          : result.error === 'rate_limited' ? 'auth.errors.rate_limited' : 'errors.server';
        setSubmitError(t(key));
        return;
      }
      setCompleted(true);
    } catch {
      setSubmitError(t('errors.network'));
    }
  });

  if (!token) {
    return (
      <div className="text-center" role="alert">
        <h2 className="text-[length:var(--text-h2)] font-bold text-card-foreground">{t('auth.invalid_reset_link')}</h2>
        <p className="mt-3 text-[length:var(--text-body)] leading-6 text-muted-foreground">{t('auth.reset_link_expired')}</p>
        <Link href="/forgot-password" className="mt-6 flex min-h-11 items-center justify-center font-semibold text-primary hover:underline">{t('auth.send_reset_link')}</Link>
      </div>
    );
  }

  if (completed) {
    return (
      <div className="text-center" role="status" aria-live="polite">
        <CircleCheck aria-hidden="true" className="mx-auto size-12 text-success" strokeWidth={1.5} />
        <h2 className="mt-5 text-[length:var(--text-h2)] font-bold text-card-foreground">{t('auth.password_reset_success')}</h2>
        <Link href="/login" className="mt-6 flex min-h-11 items-center justify-center font-semibold text-primary hover:underline">{t('auth.back_to_login')}</Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      {(['password', 'confirmPassword'] as const).map((name) => {
        const error = errors[name];
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
                aria-describedby={error ? `${name}-error` : undefined}
                className="min-h-12 w-full rounded-md border border-input bg-background py-0 pe-12 ps-4 text-[length:var(--text-body-lg)] text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring/25"
                {...register(name)}
              />
              <PasswordVisibilityButton
                visible={showPasswords}
                onToggle={() => setShowPasswords((value) => !value)}
                label={t(showPasswords ? 'auth.hide_password' : 'auth.show_password')}
              />
            </div>
            {error && <p id={`${name}-error`} role="alert" className="mt-2 text-[length:var(--text-caption)] text-error">{t(error.message ?? 'common.error')}</p>}
          </div>
        );
      })}
      {submitError && <p role="alert" className="rounded-sm bg-error/12 px-4 py-3 text-[length:var(--text-body)] text-error">{submitError}</p>}
      <Button type="submit" fullWidth disabled={isSubmitting} aria-busy={isSubmitting}>{isSubmitting ? t('common.loading') : t('auth.reset_password')}</Button>
    </form>
  );
}