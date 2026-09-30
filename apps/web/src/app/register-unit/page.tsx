'use client';

import { Container } from '@/components/Container';
import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { SkipLink } from '@/components/SkipLink';
import { RegisterUnitForm } from '@/components/form/RegisterUnitForm';
import { useTranslation } from '@/lib/i18n';

export default function RegisterUnitPage() {
  const { t } = useTranslation();

  return (
    <>
      <SkipLink />
      <Header />
      <main id="main">
        <Container className="pb-20 pt-12 sm:pb-24 sm:pt-16">
          <div className="mx-auto max-w-[760px]">
            <h1 className="text-[length:var(--text-h1)] font-bold text-foreground">
              {t('register.title')}
            </h1>
            <p className="mt-3 max-w-[60ch] text-[length:var(--text-body-lg)] leading-[1.6] text-muted-foreground">
              {t('register.subtitle')}
            </p>

            <div className="mt-9">
              <RegisterUnitForm />
            </div>
          </div>
        </Container>
      </main>
      <Footer />
    </>
  );
}
