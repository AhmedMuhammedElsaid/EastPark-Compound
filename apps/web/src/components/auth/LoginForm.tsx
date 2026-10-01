'use client';

import type { LoginInput } from '@/lib/validation/auth';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { useForm } from 'react-hook-form';

import { Button } from '@/components/Button';
import { useAuth } from '@/lib/auth/AuthProvider';
import { useTranslation } from '@/lib/i18n';
import { loginSchema } from '@/lib/validation/auth';

const ERROR_KEYS = {
  invalid_credentials: 'auth.errors.login_failed',
  network: 'errors.network',
  rate_limited: 'auth.errors.rate_limited',
  server: 'errors.server',
  validation: 'auth.errors.login_failed',
} as const;

export function LoginForm() {
  const router = useRouter();
  const { login } = useAuth();
  const { t } = useTranslation();
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [showPassword, setShowPassword] = React.useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);
    const result = await login(values);
    if (!result.ok) {
      setSubmitError(t(ERROR_KEYS[result.error]));
      return;
    }
    router.replace('/');
  });

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <div>
        <label htmlFor="email" className="mb-2 block text-[length:var(--text-label)] font-semibold text-foreground">
          {t('auth.email')}
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          dir="ltr"
          aria-invalid={Boolean(errors.email)}
          aria-describedby={errors.email ? 'email-error' : undefined}
          className="min-h-12 w-full rounded-md border border-input bg-background px-4 text-[length:var(--text-body-lg)] text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-ring/25"
          {...register('email')}
        />
        {errors.email && (
          <p id="email-error" role="alert" className="mt-2 text-[length:var(--text-caption)] text-error">
            {t(errors.email.message ?? 'auth.errors.invalid_email')}
          </p>
        )}
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between gap-3">
          <label htmlFor="password" className="text-[length:var(--text-label)] font-semibold text-foreground">
            {t('auth.password')}
          </label>
          <button
            type="button"
            onClick={() => setShowPassword((value) => !value)}
            className="min-h-11 px-2 text-[length:var(--text-caption)] font-semibold text-primary focus-visible:outline-2 focus-visible:outline-gold-500"
          >
            {t(showPassword ? 'auth.hide_password' : 'auth.show_password')}
          </button>
        </div>
        <input
          id="password"
          type={showPassword ? 'text' : 'password'}
          autoComplete="current-password"
          dir="ltr"
          aria-invalid={Boolean(errors.password)}
          aria-describedby={errors.password ? 'password-error' : undefined}
          className="min-h-12 w-full rounded-md border border-input bg-background px-4 text-[length:var(--text-body-lg)] text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-ring/25"
          {...register('password')}
        />
        {errors.password && (
          <p id="password-error" role="alert" className="mt-2 text-[length:var(--text-caption)] text-error">
            {t(errors.password.message ?? 'auth.errors.password_too_short')}
          </p>
        )}
        <Link className="mt-2 flex min-h-11 items-center justify-end text-[length:var(--text-caption)] font-semibold text-primary hover:underline" href="/forgot-password">
          {t('auth.forgot_password')}
        </Link>
      </div>

      {submitError && (
        <p role="alert" className="rounded-sm bg-error/12 px-4 py-3 text-[length:var(--text-body)] text-error">
          {submitError}
        </p>
      )}

      <Button type="submit" fullWidth disabled={isSubmitting} aria-busy={isSubmitting}>
        {isSubmitting ? t('common.loading') : t('auth.login')}
      </Button>

      <p className="text-center text-[length:var(--text-body)] text-muted-foreground">
        {t('auth.no_account')}{' '}
        <Link className="font-semibold text-primary hover:underline" href="/register">
          {t('auth.register')}
        </Link>
      </p>

      <Link
        href="/"
        className="flex min-h-11 items-center justify-center text-[length:var(--text-body)] font-semibold text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-gold-500"
      >
        {t('auth.continue_as_guest')}
      </Link>
    </form>
  );
}
