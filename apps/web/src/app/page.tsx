import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { SkipLink } from '@/components/SkipLink';
import { LandingTeaser } from '@/components/landing/LandingTeaser';

// Static: no cookies, headers or live data, so the landing page prerenders at build time.
export default function HomePage() {
  return (
    <>
      <SkipLink />
      <Header />
      <main id="main">
        <LandingTeaser />
      </main>
      <Footer />
    </>
  );
}
