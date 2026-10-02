'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

import { Button } from '@/components/Button';
import { Container } from '@/components/Container';
import { Header } from '@/components/Header';
import { OtpForm } from '@/components/auth/OtpForm';
import { readPendingVerification } from '@/lib/auth/pending-verification';
import { useTranslation } from '@/lib/i18n';
import { verifyOtpSchema } from '@/lib/validation/auth';

const emailSchema = verifyOtpSchema.shape.email;

function VerifyOtpContent() {
  const queryEmail = useSearchParams().get('email');
  const { t } = useTranslation();
  // Resolved after mount: sessionStorage is client-only, so reading it during render would
  // mismatch the server HTML.
  const [email, setEmail] = useState<string | null>(null);
  const [resolved, setResolved] = useState(false);
  const [draft, setDraft] = useState('');
  const [draftError, setDraftError] = useState(false);

  useEffect(() => {
    queueMicrotask(() => {
      setEmail(readPendingVerification() ?? queryEmail ?? null);
      setResolved(true);
    });
  }, [queryEmail]);

  function submitDraft(event: React.FormEvent) {
    event.preventDefault();
    const parsed = emailSchema.safeParse(draft.trim());
    setDraftError(!parsed.success);
    if (parsed.success) setEmail(parsed.data);
  }

  let body: React.ReactNode = null;
  if (resolved && email) {
    body = <OtpForm email={email} />;
  } else if (resolved) {
    body = (
      <form onSubmit={submitDraft} className="space-y-5" noValidate>
        <div>
          <label htmlFor="verify-email" className="mb-2 block text-[length:var(--text-label)] font-semibold text-foreground">
            {t('auth.email')}
          </label>
          <input
            id="verify-email"
            type="email"
            autoComplete="email"
            inputMode="email"
            dir="ltr"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            aria-invalid={draftError}
            aria-describedby={draftError ? 'verify-email-error' : undefined}
            className="min-h-12 w-full rounded-md border border-input bg-background px-4 text-[length:var(--text-body-lg)] text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-ring/25"
          />
          {draftError && (
            <p id="verify-email-error" role="alert" className="mt-2 text-[length:var(--text-caption)] text-error">
              {t('auth.errors.invalid_email')}
            </p>
          )}
        </div>
        <Button type="submit" fullWidth>{t('common.next')}</Button>
      </form>
    );
  }

  return <Container className="py-12 sm:py-16"><section className="mx-auto max-w-[480px] rounded-lg border border-border bg-card p-6 sm:p-9"><h1 className="text-[length:var(--text-h2)] font-bold text-foreground">{t('auth.verify_otp')}</h1><div className="mt-7" aria-busy={!resolved}>{body}</div><Link href="/register" className="mt-5 flex min-h-11 items-center justify-center text-[length:var(--text-body)] font-semibold text-muted-foreground">{t('common.back')}</Link></section></Container>;
}

export default function VerifyOtpPage() {
  return <><Header /><main id="main"><Suspense fallback={null}><VerifyOtpContent /></Suspense></main></>;
}
