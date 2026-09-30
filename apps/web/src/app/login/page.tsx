'use client';

import { BrandMark } from '@/components/BrandMark';
import { Container } from '@/components/Container';
import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { SkipLink } from '@/components/SkipLink';
import { LoginForm } from '@/components/auth/LoginForm';
import { useTranslation } from '@/lib/i18n';

export default function LoginPage() {
  const { t } = useTranslation();

  return (
    <>
      <SkipLink />
      <Header />
      <main id="main" className="overflow-hidden">
        <Container className="grid items-center gap-6 pb-14 pt-6 sm:gap-10 sm:pb-20 sm:pt-10 lg:min-h-[calc(100svh-72px)] lg:grid-cols-[minmax(0,1fr)_minmax(360px,480px)] lg:gap-20 lg:py-16">
          <section className="relative isolate flex max-w-[620px] items-center overflow-hidden lg:min-h-[32rem] lg:py-10">
            <div
              aria-hidden="true"
              className="auth-welcome-logo pointer-events-none absolute inset-0 hidden items-center justify-center lg:flex"
            >
              <div className="hero-logo-art auth-welcome-logo-art aspect-square w-[min(94%,32rem)] shrink-0" />
            </div>

            <div className="relative z-10">
              <div className="hidden lg:block">
                <BrandMark size={52} />
              </div>
              <p className="mt-8 hidden text-[length:var(--text-overline)] font-bold uppercase text-primary lg:block">
                EastPark
              </p>
              <h1 className="max-w-[18ch] text-[length:var(--text-h1)] font-bold leading-tight text-foreground lg:mt-3 lg:text-[length:var(--text-display)]">
                {t('auth.welcome_back')}
              </h1>
              <p className="mt-3 max-w-[48ch] text-[length:var(--text-body)] leading-6 text-muted-foreground sm:text-[length:var(--text-body-lg)] sm:leading-7 lg:mt-5">
                {t('auth.login_subtitle')}
              </p>
            </div>
          </section>

          <section className="rounded-lg border border-border bg-card p-4 shadow-gold sm:p-9" aria-labelledby="login-heading">
            <h2 id="login-heading" className="text-[length:var(--text-h2)] font-bold text-card-foreground">
              {t('auth.login')}
            </h2>
            <div className="mt-7">
              <LoginForm />
            </div>
          </section>
        </Container>
      </main>
      <Footer />
    </>
  );
}
