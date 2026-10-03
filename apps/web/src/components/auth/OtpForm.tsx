'use client';

import { useRouter } from 'next/navigation';
import * as React from 'react';

import { Button } from '@/components/Button';
import { useAuth } from '@/lib/auth/AuthProvider';
import { clearPendingVerification } from '@/lib/auth/pending-verification';
import { useTranslation } from '@/lib/i18n';
import { verifyOtpSchema } from '@/lib/validation/auth';

export function OtpForm({ email }: { email: string }) {
  const router = useRouter();
  const { verifyOtp } = useAuth();
  const { t } = useTranslation();
  const [otp, setOtp] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = verifyOtpSchema.safeParse({ email, otp });
    if (!parsed.success) return setError(t('auth.errors.invalid_otp'));
    setPending(true);
    setError(null);
    const result = await verifyOtp(email, otp);
    setPending(false);
    if (!result.ok) {
      const key =
        result.error === 'rate_limited'
          ? 'auth.errors.rate_limited'
          : result.error === 'network'
            ? 'errors.network'
            : result.error === 'server'
              ? 'errors.server'
              : 'auth.errors.invalid_otp';
      return setError(t(key));
    }
    clearPendingVerification();
    router.replace('/home');
  }

  async function resend() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch('/api/auth/resend-otp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
      if (!response.ok) throw new Error();
      setMessage(t('auth.otp_resent'));
    } catch {
      setError(t('errors.server'));
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <p className="text-[length:var(--text-body)] text-muted-foreground">{t('auth.otp_sent')}</p>
      <p dir="ltr" className="text-[length:var(--text-body)] font-semibold text-foreground">{email}</p>
      <div>
        <label htmlFor="otp" className="mb-2 block text-[length:var(--text-label)] font-semibold text-foreground">{t('auth.otp')}</label>
        <input id="otp" value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" dir="ltr" className="min-h-12 w-full rounded-md border border-input bg-background px-4 text-center text-2xl tracking-[0.35em] text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring/25" />
      </div>
      {error && <p role="alert" className="rounded-sm bg-error/12 px-4 py-3 text-[length:var(--text-body)] text-error">{error}</p>}
      {message && <p role="status" className="rounded-sm bg-success/12 px-4 py-3 text-[length:var(--text-body)] text-success">{message}</p>}
      <Button type="submit" fullWidth disabled={pending} aria-busy={pending}>{pending ? t('common.loading') : t('auth.verify_otp')}</Button>
      <button type="button" disabled={pending} onClick={() => void resend()} className="min-h-11 w-full text-[length:var(--text-body)] font-semibold text-primary disabled:opacity-40">{t('auth.resend_otp')}</button>
    </form>
  );
}
