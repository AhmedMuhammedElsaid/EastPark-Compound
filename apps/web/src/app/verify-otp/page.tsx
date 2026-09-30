'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

import { Container } from '@/components/Container';
import { Header } from '@/components/Header';
import { OtpForm } from '@/components/auth/OtpForm';
import { useTranslation } from '@/lib/i18n';

function VerifyOtpContent() {
  const email = useSearchParams().get('email') ?? '';
  const { t } = useTranslation();
  return <Container className="py-12 sm:py-16"><section className="mx-auto max-w-[480px] rounded-lg border border-border bg-card p-6 sm:p-9"><h1 className="text-[length:var(--text-h2)] font-bold text-foreground">{t('auth.verify_otp')}</h1><div className="mt-7">{email ? <OtpForm email={email} /> : <p className="text-error">{t('auth.errors.invalid_email')}</p>}</div><Link href="/register" className="mt-5 flex min-h-11 items-center justify-center text-[length:var(--text-body)] font-semibold text-muted-foreground">{t('common.back')}</Link></section></Container>;
}

export default function VerifyOtpPage() {
  return <><Header /><main id="main"><Suspense fallback={null}><VerifyOtpContent /></Suspense></main></>;
}
