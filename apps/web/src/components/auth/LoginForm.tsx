'use client';

import type { LoginInput } from '@/lib/validation/auth';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { useForm } from 'react-hook-form';

import { Button } from '@/components/Button';
import { PasswordVisibilityButton } from '@/components/auth/PasswordVisibilityButton';
import { useAuth } from '@/lib/auth/AuthProvider';
import { postLoginPath } from '@/lib/auth/return-path';
import { useTranslation } from '@/lib/i18n';
import { loginSchema } from '@/lib/validation/auth';

const ERROR_KEYS = {
  invalid_credentials: 'auth.errors.login_failed',
  network: 'errors.network',
  rate_limited: 'auth.errors.rate_limited',
  server: 'errors.server',
  unverified: 'auth.errors.unverified',
  validation: 'auth.errors.login_failed',
} as const;

export function LoginForm() {
  const router = useRouter();
  const { isLoading, login, user } = useAuth();
  const { t } = useTranslation();
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [showPassword, setShowPassword] = React.useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  React.useEffect(() => {
    void fetch('/api/auth/login', { cache: 'no-store' }).catch(() => undefined);
  }, []);

  // Already signed in (session validated by AuthProvider, not mere cookie presence): leave /login.
  React.useEffect(() => {
    if (isLoading || !user) return;
    router.replace(postLoginPath(user.role, new URLSearchParams(window.location.search).get('next')));
  }, [isLoading, router, user]);

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);
    const result = await login(values);
    if (!result.ok) {
      setSubmitError(t(ERROR_KEYS[result.error]));
      return;
    }
    router.replace(postLoginPath(result.user.role, new URLSearchParams(window.location.search).get('next')));
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
        <label htmlFor="password" className="mb-2 block text-[length:var(--text-label)] font-semibold text-foreground">
          {t('auth.password')}
        </label>
        <div className="relative" dir="ltr">
          <input
            id="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            aria-invalid={Boolean(errors.password)}
            aria-describedby={errors.password ? 'password-error' : undefined}
            className="min-h-12 w-full rounded-md border border-input bg-background py-0 pe-12 ps-4 text-[length:var(--text-body-lg)] text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-ring/25"
            {...register('password')}
          />
          <PasswordVisibilityButton
            visible={showPassword}
            onToggle={() => setShowPassword((value) => !value)}
            label={t(showPassword ? 'auth.hide_password' : 'auth.show_password')}
          />
        </div>
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
        <Link className="font-semibold text-primary hover:underline" href="/register-unit">
          {t('auth.register_unit_link')}
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
