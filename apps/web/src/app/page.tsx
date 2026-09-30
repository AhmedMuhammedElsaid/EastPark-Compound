import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { SkipLink } from '@/components/SkipLink';
import { ClosingCta } from '@/components/landing/ClosingCta';
import { HowItWorks } from '@/components/landing/HowItWorks';
import { Hero } from '@/components/landing/Hero';
import { Pillars } from '@/components/landing/Pillars';

export default function HomePage() {
  return (
    <>
      <SkipLink />
      <Header />
      <main id="main">
        <Hero />
        <HowItWorks />
        <Pillars />
        <ClosingCta />
      </main>
      <Footer />
    </>
  );
}
