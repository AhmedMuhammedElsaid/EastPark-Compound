'use client';

import type { ForgotPasswordInput } from '@/lib/validation/auth';

import { zodResolver } from '@hookform/resolvers/zod';
import { MailCheck } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';
import { useForm } from 'react-hook-form';

import { Button } from '@/components/Button';
import { useTranslation } from '@/lib/i18n';
import { forgotPasswordSchema } from '@/lib/validation/auth';

export function ForgotPasswordForm() {
  const { t } = useTranslation();
  const [sentEmail, setSentEmail] = React.useState<string | null>(null);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
        signal: AbortSignal.timeout(12_000),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        setSubmitError(t(result.error === 'rate_limited' ? 'auth.errors.rate_limited' : 'errors.server'));
        return;
      }
      setSentEmail(values.email);
    } catch {
      setSubmitError(t('errors.network'));
    }
  });

  if (sentEmail) {
    return (
      <div className="text-center" role="status" aria-live="polite">
        <MailCheck aria-hidden="true" className="mx-auto size-12 text-primary" strokeWidth={1.5} />
        <h2 className="mt-5 text-[length:var(--text-h2)] font-bold text-card-foreground">{t('auth.reset_link_sent')}</h2>
        <p className="mt-3 text-[length:var(--text-body)] leading-6 text-muted-foreground">
          {t('auth.reset_link_body', { email: sentEmail })}
        </p>
        <Link href="/login" className="mt-7 flex min-h-11 items-center justify-center font-semibold text-primary hover:underline">
          {t('auth.back_to_login')}
        </Link>
        <button
          type="button"
          onClick={() => setSentEmail(null)}
          className="mt-2 min-h-11 px-3 text-[length:var(--text-body)] font-semibold text-muted-foreground hover:text-foreground"
        >
          {t('auth.forgot.tryDifferentEmail')}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <div>
        <label htmlFor="email" className="mb-2 block text-[length:var(--text-label)] font-semibold text-foreground">{t('auth.email')}</label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          dir="ltr"
          aria-invalid={Boolean(errors.email)}
          aria-describedby={errors.email ? 'email-error' : undefined}
          className="min-h-12 w-full rounded-md border border-input bg-background px-4 text-[length:var(--text-body-lg)] text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring/25"
          {...register('email')}
        />
        {errors.email && <p id="email-error" role="alert" className="mt-2 text-[length:var(--text-caption)] text-error">{t(errors.email.message ?? 'auth.errors.invalid_email')}</p>}
      </div>
      {submitError && <p role="alert" className="rounded-sm bg-error/12 px-4 py-3 text-[length:var(--text-body)] text-error">{submitError}</p>}
      <Button type="submit" fullWidth disabled={isSubmitting} aria-busy={isSubmitting}>
        {isSubmitting ? t('common.loading') : t('auth.send_reset_link')}
      </Button>
      <Link href="/login" className="flex min-h-11 items-center justify-center font-semibold text-muted-foreground hover:text-foreground">
        {t('auth.back_to_login')}
      </Link>
    </form>
  );
}