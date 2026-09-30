'use client';

import { Home, RefreshCw } from 'lucide-react';
import Image from 'next/image';

import { Button, ButtonLink } from '@/components/Button';
import { Container } from '@/components/Container';
import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { SkipLink } from '@/components/SkipLink';
import { useTranslation } from '@/lib/i18n';

type StatusPageProps = {
  kind: 'notFound' | 'error';
  onRetry?: () => void;
};

export function StatusPage({ kind, onRetry }: StatusPageProps) {
  const { t } = useTranslation();
  const isNotFound = kind === 'notFound';

  return (
    <>
      <SkipLink />
      <Header />
      <main id="main" className="relative isolate flex min-h-[calc(100vh-64px)] items-center overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 opacity-40"
          style={{
            backgroundImage:
              'linear-gradient(var(--color-border) 1px, transparent 1px), linear-gradient(90deg, var(--color-border) 1px, transparent 1px)',
            backgroundSize: '72px 72px',
            maskImage: 'linear-gradient(to bottom, transparent, black 30%, black 70%, transparent)',
          }}
        />

        <Container className="grid items-center gap-10 py-16 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20 lg:py-24">
          <div className="status-logo-float relative mx-auto size-52 sm:size-64" aria-hidden="true">
            <div className="absolute inset-[16%] rounded-full bg-gold-500/10 blur-2xl" />
            <Image
              src="/eastpark-mark.png"
              alt=""
              fill
              priority
              sizes="(max-width: 640px) 208px, 256px"
              className="object-contain drop-shadow-[0_16px_32px_rgba(184,150,106,0.18)]"
            />
          </div>

          <div className="max-w-[640px] text-center lg:text-start">
            <p className="text-overline font-semibold uppercase tracking-[1px] text-primary">
              {isNotFound ? '404' : t('status_pages.error_eyebrow')}
            </p>
            <h1 className="mt-3 text-[length:var(--text-h1)] font-bold text-foreground sm:text-[length:var(--text-display)]">
              {t(isNotFound ? 'status_pages.not_found_title' : 'status_pages.error_title')}
            </h1>
            <p className="mt-4 max-w-[52ch] text-body-lg leading-[1.7] text-muted-foreground max-lg:mx-auto">
              {t(isNotFound ? 'status_pages.not_found_body' : 'status_pages.error_body')}
            </p>

            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row lg:justify-start">
              <ButtonLink href="/">
                <Home aria-hidden="true" className="size-5" />
                {t('status_pages.home')}
              </ButtonLink>
              {!isNotFound && onRetry ? (
                <Button type="button" variant="outline" onClick={onRetry}>
                  <RefreshCw aria-hidden="true" className="size-5" />
                  {t('status_pages.retry')}
                </Button>
              ) : null}
            </div>
          </div>
        </Container>
      </main>
      <Footer />
    </>
  );
}