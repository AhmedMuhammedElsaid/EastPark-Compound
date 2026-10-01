import type { Metadata } from 'next';
import { Alexandria, Cormorant_Garamond } from 'next/font/google';

import { AuthProvider } from '@/lib/auth/AuthProvider';
import { CartProvider } from '@/lib/cart/CartProvider';
import { LanguageProvider } from '@/lib/i18n';
import { ThemeProvider, THEME_INIT_SCRIPT } from '@/lib/theme';

import './globals.css';

const SITE_URL = 'https://eastpark-web-app.vercel.app';
const DEVELOPER_URL = 'https://ahmed-muhammed-elsaid.dev/';
const SITE_DESCRIPTION =
  'Commerce, services, and community in one trusted place. Built By Ahmed Muhammed Elsaid.';

const websiteJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'EastPark',
  url: SITE_URL,
  description: SITE_DESCRIPTION,
  inLanguage: ['ar', 'en'],
  creator: {
    '@type': 'Person',
    name: 'Ahmed Muhammed Elsaid',
    url: DEVELOPER_URL,
    sameAs: [
      'https://www.linkedin.com/in/ahmedmuhammedelsaid',
      'https://github.com/AhmedMuhammedElsaid',
    ],
  },
};

// Alexandria — bilingual functional UI with a geometric, architectural character.
const alexandria = Alexandria({
  variable: '--font-family-sans',
  subsets: ['latin', 'arabic'],
  weight: ['400', '500', '600', '700'],
});

// Cormorant Garamond — English display/hero only. Never functional UI, never Arabic.
const cormorantGaramond = Cormorant_Garamond({
  variable: '--font-family-display',
  subsets: ['latin'],
  weight: '700',
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: 'EastPark',
  title: {
    default: 'EastPark | Your Compound, Connected',
    template: '%s | EastPark',
  },
  description: SITE_DESCRIPTION,
  authors: [{ name: 'Ahmed Muhammed Elsaid', url: DEVELOPER_URL }],
  creator: 'Ahmed Muhammed Elsaid',
  publisher: 'EastPark',
  category: 'community',
  keywords: [
    'EastPark',
    'إيست بارك',
    'compound services',
    'residential community',
    'community management',
    'local marketplace',
  ],
  alternates: {
    canonical: '/',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
  openGraph: {
    title: 'EastPark | Your Compound, Connected',
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    siteName: 'EastPark',
    locale: 'ar_EG',
    alternateLocale: ['en_US'],
    type: 'website',
    images: [
      {
        url: '/opengraph-image.jpg',
        width: 1200,
        height: 630,
        alt: 'EastPark residential community platform',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'EastPark | Your Compound, Connected',
    description: SITE_DESCRIPTION,
    images: ['/twitter-image.jpg'],
  },
  other: {
    developer: 'Ahmed Muhammed Elsaid',
    'developer:website': DEVELOPER_URL,
    'developer:linkedin': 'https://www.linkedin.com/in/ahmedmuhammedelsaid',
    'developer:github': 'https://github.com/AhmedMuhammedElsaid',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // Arabic is the primary language and default; lang/dir are kept in sync
    // client-side by LanguageProvider after mount.
    <html
      lang="ar"
      dir="rtl"
      className={`${alexandria.variable} ${cormorantGaramond.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
        />
        {/* Applies the persisted theme class before hydration to avoid a flash of the wrong theme. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-screen antialiased">
        <ThemeProvider>
          <LanguageProvider>
            <AuthProvider>
              <CartProvider>{children}</CartProvider>
            </AuthProvider>
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
