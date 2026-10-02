'use client';

import type { RegisterFormInput } from '@/lib/validation/auth';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { useForm } from 'react-hook-form';

import { Button } from '@/components/Button';
import { PasswordVisibilityButton } from '@/components/auth/PasswordVisibilityButton';
import { rememberPendingVerification } from '@/lib/auth/pending-verification';
import { useTranslation } from '@/lib/i18n';
import { registerFormSchema } from '@/lib/validation/auth';

const FIELDS = [
  { name: 'name', type: 'text', autoComplete: 'name', key: 'auth.name', dir: undefined },
  { name: 'email', type: 'email', autoComplete: 'email', key: 'auth.email', dir: 'ltr' },
  { name: 'phone', type: 'tel', autoComplete: 'tel', key: 'auth.phone', dir: 'ltr' },
  { name: 'unitNumber', type: 'text', autoComplete: 'street-address', key: 'auth.unit_number', dir: undefined },
] as const;

export function RegisterForm() {
  const router = useRouter();
  const { t } = useTranslation();
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [showPasswords, setShowPasswords] = React.useState(false);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<RegisterFormInput>({
    resolver: zodResolver(registerFormSchema),
  });

  const onSubmit = handleSubmit(async (values) => {
    const payload = {
      name: values.name,
      email: values.email,
      phone: values.phone,
      unitNumber: values.unitNumber,
      password: values.password,
    };
    setSubmitError(null);
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        const key = result.error === 'email_taken' ? 'auth.errors.email_taken' : result.error === 'rate_limited' ? 'auth.errors.rate_limited' : 'errors.server';
        setSubmitError(t(key));
        return;
      }
      // Prefer sessionStorage so the email stays out of the URL; fall back to the query string.
      router.push(
        rememberPendingVerification(payload.email)
          ? '/verify-otp'
          : `/verify-otp?email=${encodeURIComponent(payload.email)}`,
      );
    } catch {
      setSubmitError(t('errors.network'));
    }
  });

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      {FIELDS.map((field) => {
        const error = errors[field.name];
        return (
          <div key={field.name}>
            <label htmlFor={field.name} className="mb-2 block text-[length:var(--text-label)] font-semibold text-foreground">{t(field.key)}</label>
            <input id={field.name} type={field.type} autoComplete={field.autoComplete} dir={field.dir} aria-invalid={Boolean(error)} className="min-h-12 w-full rounded-md border border-input bg-background px-4 text-[length:var(--text-body-lg)] text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring/25" {...register(field.name)} />
            {error && <p role="alert" className="mt-2 text-[length:var(--text-caption)] text-error">{t(error.message ?? 'common.error')}</p>}
          </div>
        );
      })}

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="password" className="mb-2 block text-[length:var(--text-label)] font-semibold text-foreground">{t('auth.password')}</label>
          <div className="relative" dir="ltr"><input id="password" type={showPasswords ? 'text' : 'password'} autoComplete="new-password" aria-invalid={Boolean(errors.password)} className="min-h-12 w-full rounded-md border border-input bg-background py-0 pe-12 ps-4 text-[length:var(--text-body-lg)] text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring/25" {...register('password')} /><PasswordVisibilityButton visible={showPasswords} onToggle={() => setShowPasswords((value) => !value)} label={t(showPasswords ? 'auth.hide_password' : 'auth.show_password')} /></div>
          {errors.password && <p role="alert" className="mt-2 text-[length:var(--text-caption)] text-error">{t(errors.password.message ?? 'auth.errors.password_too_short')}</p>}
        </div>
        <div>
          <label htmlFor="confirmPassword" className="mb-2 block text-[length:var(--text-label)] font-semibold text-foreground">{t('auth.confirm_password')}</label>
          <div className="relative" dir="ltr"><input id="confirmPassword" type={showPasswords ? 'text' : 'password'} autoComplete="new-password" aria-invalid={Boolean(errors.confirmPassword)} className="min-h-12 w-full rounded-md border border-input bg-background py-0 pe-12 ps-4 text-[length:var(--text-body-lg)] text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring/25" {...register('confirmPassword')} /><PasswordVisibilityButton visible={showPasswords} onToggle={() => setShowPasswords((value) => !value)} label={t(showPasswords ? 'auth.hide_password' : 'auth.show_password')} /></div>
          {errors.confirmPassword && <p role="alert" className="mt-2 text-[length:var(--text-caption)] text-error">{t(errors.confirmPassword.message ?? 'auth.errors.passwords_no_match')}</p>}
        </div>
      </div>

      {submitError && <p role="alert" className="rounded-sm bg-error/12 px-4 py-3 text-[length:var(--text-body)] text-error">{submitError}</p>}
      <Button type="submit" fullWidth disabled={isSubmitting} aria-busy={isSubmitting}>{isSubmitting ? t('common.loading') : t('auth.register')}</Button>
      <p className="text-center text-[length:var(--text-body)] text-muted-foreground">{t('auth.already_have_account')} <Link className="font-semibold text-primary hover:underline" href="/login">{t('auth.login')}</Link></p>
    </form>
  );
}
