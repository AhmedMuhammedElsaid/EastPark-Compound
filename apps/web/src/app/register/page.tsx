'use client';

import { Container } from '@/components/Container';
import { Header } from '@/components/Header';
import { SkipLink } from '@/components/SkipLink';
import { RegisterForm } from '@/components/auth/RegisterForm';
import { useTranslation } from '@/lib/i18n';

export default function RegisterPage() {
  const { t } = useTranslation();
  return <><SkipLink /><Header /><main id="main"><Container className="py-10 sm:py-14"><div className="mx-auto max-w-[760px]"><h1 className="text-[length:var(--text-h1)] font-bold text-foreground">{t('auth.register')}</h1><p className="mt-3 text-[length:var(--text-body-lg)] text-muted-foreground">{t('auth.register_subtitle')}</p><section className="mt-8 rounded-lg border border-border bg-card p-6 sm:p-9"><RegisterForm /></section></div></Container></main></>;
}
