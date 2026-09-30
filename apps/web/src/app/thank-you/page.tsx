'use client';

import { Clock3, Home, Mail, Phone } from 'lucide-react';

import { BrandMark } from '@/components/BrandMark';
import { ButtonLink } from '@/components/Button';
import { Container } from '@/components/Container';
import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { Reveal } from '@/components/Reveal';
import { SkipLink } from '@/components/SkipLink';
import { useTranslation } from '@/lib/i18n';

function CheckSeal() {
  return (
    <div aria-hidden="true" className="relative mx-auto flex size-24 items-center justify-center">
      <span className="absolute inset-0 rounded-full border border-success/20" />
      <span className="absolute inset-2 rounded-full border border-success/30 bg-success/10" />
      <span className="relative text-primary">
        <BrandMark size={42} />
      </span>
    </div>
  );
}

export default function ThankYouPage() {
  const { t } = useTranslation();
  const email = t('contact.email');
  const phone = t('contact.phone');

  const steps = [t('thank_you.next_1'), t('thank_you.next_2'), t('thank_you.next_3')];

  return (
    <>
      <SkipLink />
      <Header />
      <main id="main" className="relative isolate flex min-h-[72svh] items-center overflow-hidden">
        <div
          aria-hidden="true"
          className="thank-you-logo-watermark pointer-events-none absolute inset-0 flex items-center justify-center"
        >
          <div className="hero-logo-art thank-you-logo-art aspect-square w-[min(120vw,56rem)] shrink-0 sm:w-[min(82vw,56rem)]" />
        </div>

        <Container className="relative z-10 w-full py-12 sm:py-16">
          <Reveal className="mx-auto max-w-[760px] text-center">
            <CheckSeal />

            <h1 className="mt-7 text-[length:var(--text-h1)] font-bold text-foreground">
              {t('thank_you.title')}
            </h1>
            <p className="mx-auto mt-3 max-w-[52ch] text-[length:var(--text-body-lg)] leading-[1.7] text-muted-foreground">
              {t('thank_you.body')}
            </p>

            <section aria-labelledby="next-title" className="mt-10">
              <h2
                id="next-title"
                className="text-[length:var(--text-h2)] font-semibold text-foreground"
              >
                {t('thank_you.next_title')}
              </h2>
              <ol className="mt-5 grid border-y border-border md:grid-cols-3">
                {steps.map((step, index) => (
                  <li
                    key={step}
                    className="flex min-h-36 flex-col items-center justify-center gap-3 px-5 py-6 [&+&]:border-t [&+&]:border-border md:[&+&]:border-s md:[&+&]:border-t-0"
                  >
                    <span
                      aria-hidden="true"
                      className="text-[length:var(--text-h2)] font-semibold text-primary"
                    >
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <span className="max-w-[28ch] text-[length:var(--text-body)] leading-[1.7] text-foreground">
                      {step}
                    </span>
                  </li>
                ))}
              </ol>
              <div className="mx-auto mt-5 flex max-w-[590px] items-start justify-center gap-2 text-muted-foreground">
                <Clock3 aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                <p className="text-[length:var(--text-caption)] leading-[1.7]">
                  {t('thank_you.note')}
                </p>
              </div>
            </section>

            <section aria-labelledby="contact-title" className="mt-10 border-t border-border pt-8">
              <h2
                id="contact-title"
                className="text-[length:var(--text-body-lg)] font-semibold text-foreground"
              >
                {t('thank_you.contact_title')}
              </h2>
              <p className="mt-2 text-[length:var(--text-body)] text-muted-foreground">
                {t('thank_you.contact_body')}
              </p>
              <div className="mt-4 flex flex-col items-center justify-center gap-x-6 gap-y-1 sm:flex-row">
                <a
                  href={`mailto:${email}`}
                  className="inline-flex min-h-[44px] items-center gap-2 text-[length:var(--text-body)] text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500"
                >
                  <Mail aria-hidden="true" className="size-4" />
                  <span dir="ltr">{email}</span>
                </a>
                <a
                  href={`tel:${phone}`}
                  className="inline-flex min-h-[44px] items-center gap-2 text-[length:var(--text-body)] text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500"
                >
                  <Phone aria-hidden="true" className="size-4" />
                  <span dir="ltr">{phone}</span>
                </a>
              </div>
            </section>

            <div className="mt-8">
              <ButtonLink href="/" variant="outline" className="min-w-48">
                <Home aria-hidden="true" className="size-5" />
                {t('thank_you.back_home')}
              </ButtonLink>
            </div>
          </Reveal>
        </Container>
      </main>
      <Footer />
    </>
  );
}
