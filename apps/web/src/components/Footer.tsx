'use client';

import Image from 'next/image';
import Link from 'next/link';
import { MapPin } from 'lucide-react';

import { useTranslation } from '@/lib/i18n';

import { Container } from './Container';

type ContactIconName = 'email' | 'github' | 'linkedin' | 'phone' | 'website';

function ContactIcon({ name }: { name: ContactIconName }) {
  if (name === 'linkedin') {
    return (
      <svg className="size-4 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
      </svg>
    );
  }

  if (name === 'github') {
    return (
      <svg className="size-4 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222 0 1.606-.014 2.898-.014 3.293 0 .322.216.694.825.576C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
      </svg>
    );
  }

  if (name === 'website') {
    return (
      <svg className="size-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10Z" />
      </svg>
    );
  }

  if (name === 'email') {
    return (
      <svg className="size-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="2" y="4" width="20" height="16" rx="2" />
        <path d="m22 6-10 7L2 6" />
      </svg>
    );
  }

  return (
    <svg className="size-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92Z" />
    </svg>
  );
}

export function Footer() {
  const { dir, t } = useTranslation();
  const email = t('contact.email');
  const phone = t('contact.phone');
  const linkClass =
    'inline-flex min-h-11 min-w-0 items-center gap-3 text-body text-muted-foreground transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500 motion-reduce:transition-none';
  const contactLinkClass =
    `${linkClass} w-full rounded-md border border-border bg-muted px-4 lg:w-auto lg:border-transparent lg:bg-transparent lg:px-0`;
  const developerContactLinkClass =
    `${linkClass} min-h-[72px] w-full justify-center rounded-md border border-border bg-muted px-3 text-center text-caption lg:min-h-11 lg:w-auto lg:justify-start lg:border-transparent lg:bg-transparent lg:px-0 lg:text-body`;
  const socialLinkClass =
    'flex min-h-[72px] min-w-0 flex-col items-center justify-center gap-2 rounded-md border border-border bg-muted px-2 text-center text-caption font-medium text-muted-foreground transition-colors hover:border-primary hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500 motion-reduce:transition-none';

  return (
    <footer className="border-t border-border bg-background text-foreground">
      <Container className="py-8 sm:py-12 lg:py-16">
        <div className="grid lg:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)] lg:gap-32">
          <section
            aria-labelledby="footer-developer-title"
            className="order-2 border-b border-border py-8 text-center lg:order-1 lg:border-0 lg:py-0 lg:text-start"
          >
            <h2 className="text-caption font-semibold uppercase text-muted-foreground lg:text-label lg:normal-case lg:text-card-foreground">
              <span id="footer-developer-title">{t('footer.developed_by')}</span>
            </h2>
            <p className="mt-3 text-body-lg font-semibold text-card-foreground lg:mt-4">
              {t('footer.developer_name')}
            </p>
            <p className="mt-1 text-caption text-muted-foreground">
              {t('footer.developer_role')}
            </p>
            <ul className="mt-4 grid min-w-0 grid-cols-2 gap-2 lg:mt-3 lg:flex lg:flex-col lg:gap-0">
              <li className="min-w-0"><a href="mailto:ahmed.muhammed.elsaid@gmail.com" className={developerContactLinkClass} dir={dir}><ContactIcon name="email" /><span dir="ltr" className="min-w-0 wrap-anywhere">ahmed.muhammed.elsaid@gmail</span></a></li>
              <li className="min-w-0"><a href="tel:+201017134627" className={developerContactLinkClass} dir={dir}><ContactIcon name="phone" /><span dir="ltr" className="whitespace-nowrap">+20 101 713 4627</span></a></li>
            </ul>
            <ul className="mt-2 grid grid-cols-3 gap-2">
              <li><a href="https://www.linkedin.com/in/ahmedmuhammedelsaid" target="_blank" rel="noreferrer" className={socialLinkClass} dir={dir}><ContactIcon name="linkedin" /><span>{t('footer.linkedin')}</span></a></li>
              <li><a href="https://github.com/AhmedMuhammedElsaid" target="_blank" rel="noreferrer" className={socialLinkClass} dir={dir}><ContactIcon name="github" /><span>{t('footer.github')}</span></a></li>
              <li><a href="https://ahmed-muhammed-elsaid.dev/" target="_blank" rel="noreferrer" className={socialLinkClass} dir={dir}><ContactIcon name="website" /><span>{t('footer.portfolio')}</span></a></li>
            </ul>
          </section>

          <section
            aria-label={t('nav.brand')}
            className="order-1 border-b border-border pb-8 lg:order-2 lg:border-0 lg:pb-0"
          >
            <div className="flex flex-col items-center text-center lg:items-start lg:text-start">
              <Link
                href="/"
                className="inline-flex min-h-11 items-center gap-3 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold-500"
              >
                <Image src="/eastpark-mark.png" width={40} height={40} alt="" className="size-10 lg:size-8" />
                <span className="text-h2 font-semibold text-card-foreground lg:text-body-lg">
                  {t('nav.brand')}
                </span>
              </Link>
              <div className="mt-5 grid w-full grid-cols-2 gap-2 lg:mt-3 lg:flex lg:flex-col lg:gap-0">
                <a href={`mailto:${email}`} className={contactLinkClass} dir={dir}>
                  <ContactIcon name="email" /><span dir="ltr" className="min-w-0 wrap-anywhere">{email}</span>
                </a>
                <a href={`tel:${phone}`} className={contactLinkClass} dir={dir}>
                  <ContactIcon name="phone" /><span dir="ltr">{phone}</span>
                </a>
                <a href="https://maps.app.goo.gl/ht4YpvCpQQ2fQdnR9?g_st=aw" target="_blank" rel="noreferrer" className={contactLinkClass} dir={dir}>
                  <MapPin className="size-4 shrink-0" aria-hidden="true" /><span>{t('footer.company_location')}</span>
                </a>
                <a href="https://maps.app.goo.gl/jo1zgoUW2g2Upsp7A?g_st=ic" target="_blank" rel="noreferrer" className={contactLinkClass} dir={dir}>
                  <MapPin className="size-4 shrink-0" aria-hidden="true" /><span>{t('footer.eastpark_location')}</span>
                </a>
              </div>
              <p className="mt-5 text-caption text-muted-foreground lg:mt-2">
                © {new Date().getFullYear()} {t('nav.brand')}
              </p>
            </div>
          </section>
        </div>
      </Container>
    </footer>
  );
}
