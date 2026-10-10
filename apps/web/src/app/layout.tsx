import type { Metadata } from 'next';
import localFont from 'next/font/local';
import { Analytics } from '@vercel/analytics/next';

import { AuthProvider } from '@/lib/auth/AuthProvider';
import { CartProvider } from '@/lib/cart/CartProvider';
import { LanguageProvider } from '@/lib/i18n';
import { ThemeProvider } from '@/lib/theme';

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

// Self-hosted (OFL, see src/fonts/OFL-*.txt) so `next build` never downloads from Google Fonts.
// Alexandria — bilingual functional UI with a geometric, architectural character.
// Variable wght 400-700, split by script (same subsets as the Google CSS) and joined by
// unicode-range (literals: next/font needs static values) through the `--font-family-sans` stack in globals.css.
const alexandriaArabic = localFont({
  variable: '--font-alexandria-arabic',
  src: [{ path: '../fonts/Alexandria-arabic.woff2', weight: '400 700', style: 'normal' }],
  declarations: [{ prop: 'unicode-range', value: 'U+0600-06FF, U+0750-077F, U+0870-0891, U+0897-08E1, U+08E3-08FF, U+200C-200E, U+2010-2011, U+204F, U+2E41, U+FB50-FDFF, U+FE70-FE74, U+FE76-FEFC' }],
  display: 'swap',
  fallback: ['ui-sans-serif', 'system-ui', 'sans-serif'],
});

const alexandriaLatin = localFont({
  variable: '--font-alexandria-latin',
  src: [{ path: '../fonts/Alexandria-latin.woff2', weight: '400 700', style: 'normal' }],
  declarations: [{ prop: 'unicode-range', value: 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD' }],
  display: 'swap',
  fallback: ['ui-sans-serif', 'system-ui', 'sans-serif'],
});

// Cormorant Garamond — English display/hero only. Never functional UI, never Arabic.
const cormorantGaramond = localFont({
  variable: '--font-family-display',
  src: [{ path: '../fonts/CormorantGaramond-700-latin.woff2', weight: '700', style: 'normal' }],
  display: 'swap',
  fallback: ['Georgia', 'serif'],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: 'EastPark',
  title: {
    default: 'إيست بارك | مجمعك السكني، متصل',
    template: '%s | إيست بارك',
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
      className={`${alexandriaLatin.variable} ${alexandriaArabic.variable} ${cormorantGaramond.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
        />
        {/* Static same-origin script (public/theme-init.js): applies the persisted theme class before hydration, with no inline-script CSP allowance. */}
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script src="/theme-init.js" />
      </head>
      <body className="min-h-screen antialiased">
        <ThemeProvider>
          <LanguageProvider>
            <AuthProvider>
              <CartProvider>{children}</CartProvider>
            </AuthProvider>
          </LanguageProvider>
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  );
}
