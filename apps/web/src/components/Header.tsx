'use client';

import { LogIn, LogOut } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { useAuth } from '@/lib/auth/AuthProvider';
import { useTranslation } from '@/lib/i18n';

import { BrandMark } from './BrandMark';
import { Container } from './Container';
import { LanguageToggle } from './LanguageToggle';
import { ThemeToggle } from './ThemeToggle';

export function Header() {
  const { t } = useTranslation();
  const { isLoading, logout, user } = useAuth();
  const pathname = usePathname();

  const navItems = [
    { href: '/', label: t('nav.home') },
    { href: '/register-unit', label: t('nav.register') },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-border/80 bg-background/95 shadow-[0_1px_0_color-mix(in_srgb,var(--color-border)_35%,transparent)] backdrop-blur-xl">
      <Container className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-1 py-2 [padding-inline:12px] sm:[padding-inline:32px] md:h-[72px] md:grid-cols-[1fr_auto_1fr] md:gap-3 md:py-0">
        <Link
          href="/"
          className="flex min-h-11 w-fit min-w-0 items-center gap-2 rounded-sm text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500"
        >
          <BrandMark size={26} />
          <span className="whitespace-nowrap text-[length:var(--text-label)] font-bold leading-none text-foreground sm:text-[length:var(--text-body-lg)]">
            {t('nav.brand')}
          </span>
        </Link>

        <nav
          aria-label={t('nav.brand')}
          className="col-span-2 row-start-2 flex items-center justify-center gap-1 border-t border-border/70 pt-1 md:col-span-1 md:row-start-auto md:border-0 md:pt-0"
        >
          {navItems.map((item) => {
            const active = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`inline-flex min-h-11 flex-1 items-center justify-center rounded-md px-3 text-[length:var(--text-label)] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500 motion-reduce:transition-none md:flex-none md:px-4 ${
                  active
                    ? 'bg-muted text-primary'
                    : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="col-start-2 row-start-1 flex shrink-0 items-center justify-end gap-1 sm:gap-2 md:col-start-auto">
          {!isLoading &&
            (user ? (
              <>
                <span className="hidden max-w-40 truncate text-[length:var(--text-label)] font-semibold text-foreground sm:block">
                  {user.name}
                </span>
                <button
                  type="button"
                  onClick={() => void logout()}
                  className="inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-md px-2 text-[length:var(--text-label)] font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500 motion-reduce:transition-none sm:px-3"
                >
                  <LogOut aria-hidden="true" className="size-[18px]" />
                  <span className="hidden sm:inline">{t('auth.logout')}</span>
                </button>
              </>
            ) : (
              <Link
                href="/login"
                className="inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-md px-2 text-[length:var(--text-label)] font-semibold text-foreground transition-colors hover:bg-muted hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500 motion-reduce:transition-none sm:px-3"
              >
                <LogIn aria-hidden="true" className="size-[18px]" />
                <span className="hidden sm:inline">{t('auth.login')}</span>
              </Link>
            ))}
          <div className="flex items-center divide-x divide-border overflow-hidden rounded-md border border-border bg-card shadow-sm rtl:divide-x-reverse">
            <LanguageToggle />
            <ThemeToggle />
          </div>
        </div>
      </Container>
    </header>
  );
}
