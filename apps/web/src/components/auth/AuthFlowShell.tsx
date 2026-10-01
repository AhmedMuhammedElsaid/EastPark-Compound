'use client';

import { BrandMark } from '@/components/BrandMark';
import { Container } from '@/components/Container';
import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { SkipLink } from '@/components/SkipLink';

export function AuthFlowShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <SkipLink />
      <Header />
      <main id="main">
        <Container className="py-10 sm:py-16">
          <div className="mx-auto max-w-[520px]">
            <div className="mb-8 text-center">
              <div className="flex justify-center"><BrandMark size={48} /></div>
              <h1 className="mt-6 text-[length:var(--text-h1)] font-bold text-foreground">{title}</h1>
              <p className="mt-3 text-[length:var(--text-body)] leading-6 text-muted-foreground sm:text-[length:var(--text-body-lg)]">
                {subtitle}
              </p>
            </div>
            <section className="rounded-lg border border-border bg-card p-6 shadow-gold sm:p-9">
              {children}
            </section>
          </div>
        </Container>
      </main>
      <Footer />
    </>
  );
}