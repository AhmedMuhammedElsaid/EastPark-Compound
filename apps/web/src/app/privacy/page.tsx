import type { Metadata } from 'next';

import { Container } from '@/components/Container';
import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { SkipLink } from '@/components/SkipLink';
import {
  PRIVACY_PATH,
  PRIVACY_POLICY,
  type PolicyDocument,
  type PolicyLanguage,
} from '@/content/privacy-policy';

export const metadata: Metadata = {
  title: 'سياسة الخصوصية | Privacy Policy',
  description:
    'How EastPark collects, uses, shares and protects personal data. سياسة الخصوصية الخاصة بإيست بارك.',
  alternates: { canonical: PRIVACY_PATH },
  robots: { index: true, follow: true },
  openGraph: {
    title: 'EastPark Privacy Policy',
    description: 'How EastPark collects, uses, shares and protects personal data.',
    url: PRIVACY_PATH,
  },
};

const LANGUAGES: PolicyLanguage[] = ['ar', 'en'];

function PolicyArticle({ doc, lang }: { doc: PolicyDocument; lang: PolicyLanguage }) {
  const dir = lang === 'ar' ? 'rtl' : 'ltr';

  return (
    // Both languages are in the server HTML; `.privacy-doc[lang]` rules in globals.css show the one
    // that matches the page language (html[lang]), so crawlers and store reviewers see both.
    <article lang={lang} dir={dir} className={`privacy-doc privacy-doc-${lang}`}>
      <h1 className="text-[length:var(--text-h1)] font-bold text-foreground">{doc.title}</h1>
      <p className="mt-2 text-[length:var(--text-caption)] text-muted-foreground">
        {doc.effectiveLabel}: <time dateTime="2026-10-12">{doc.effectiveDate}</time>
      </p>
      <div className="mt-6 space-y-4">
        {doc.intro.map((paragraph) => (
          <p key={paragraph} className="text-[length:var(--text-body)] leading-[1.8] text-muted-foreground">
            {paragraph}
          </p>
        ))}
      </div>
      {doc.sections.map((section) => (
        <section key={section.id} aria-labelledby={`${lang}-${section.id}`} className="mt-10">
          <h2
            id={`${lang}-${section.id}`}
            className="text-[length:var(--text-h2)] font-semibold text-foreground"
          >
            {section.heading}
          </h2>
          {section.paragraphs?.map((paragraph) => (
            <p
              key={paragraph}
              className="mt-3 text-[length:var(--text-body)] leading-[1.8] text-muted-foreground"
            >
              {paragraph}
            </p>
          ))}
          {section.items ? (
            <ul className="mt-3 list-disc space-y-2 ps-6 marker:text-primary">
              {section.items.map((item) => (
                <li
                  key={item}
                  className="text-[length:var(--text-body)] leading-[1.8] text-muted-foreground"
                >
                  {item}
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ))}
    </article>
  );
}

export default function PrivacyPage() {
  return (
    <>
      <SkipLink />
      <Header />
      <main id="main">
        <Container className="py-12 sm:py-16">
          <div className="mx-auto max-w-[820px]">
            {LANGUAGES.map((lang) => (
              <PolicyArticle key={lang} doc={PRIVACY_POLICY[lang]} lang={lang} />
            ))}
          </div>
        </Container>
      </main>
      <Footer />
    </>
  );
}
