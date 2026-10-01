'use client';

import { Building2, Home, Landmark, LogIn, LogOut, Megaphone, Package, ShoppingBag, Store, UserRound } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { BrandMark } from '@/components/BrandMark';
import { Container } from '@/components/Container';
import { LanguageToggle } from '@/components/LanguageToggle';
import { SkipLink } from '@/components/SkipLink';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useAuth } from '@/lib/auth/AuthProvider';
import { useCart } from '@/lib/cart/CartProvider';
import { useTranslation } from '@/lib/i18n';

type AppShellProps = { children: React.ReactNode };

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const { isLoading, logout, user } = useAuth();
  const { state: cart, isHydrated: isCartHydrated } = useCart();
  const { t } = useTranslation();
  const accountHref = user ? '/home#account' : '/login';
  const navItems = [
    { href: '/home', label: t('home.tab_label'), mobileLabel: t('home.tab_label'), icon: Home },
    { href: '/directory', label: t('directory.title'), mobileLabel: t('directory.title'), icon: Store },
    { href: '/orders', label: t('orders.title'), mobileLabel: t('orders.title'), icon: Package },
    { href: '/announcements', label: t('community.announcements'), mobileLabel: t('community.title'), icon: Megaphone },
    { href: '/governance', label: t('governance.title'), mobileLabel: t('governance.title'), icon: Landmark },
    { href: '/register-unit', label: t('nav.register'), mobileLabel: t('nav.unit'), icon: Building2 },
    { href: accountHref, label: t('profile.account'), mobileLabel: t('profile.account'), icon: UserRound },
  ];
  const mobileNavItems = navItems.filter(({ href }) =>
    ['/home', '/directory', '/orders', '/announcements', accountHref].includes(href),
  );

  return (
    <div className="min-h-screen bg-background pb-20 text-foreground md:pb-0">
      <SkipLink />
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur-xl">
        <Container className="flex min-h-[72px] items-center justify-between gap-4">
          <Link
            href="/home"
            className="flex min-h-11 items-center gap-2.5 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500"
          >
            <span className="text-primary"><BrandMark size={26} /></span>
            <span className="font-bold text-foreground">{t('nav.brand')}</span>
          </Link>

          <nav aria-label={t('nav.brand')} className="hidden items-center gap-1 md:flex">
            {navItems.map(({ href, icon: Icon, label }) => {
              const active = href === '/home' ? pathname === href : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  className={`inline-flex min-h-11 items-center gap-2 rounded-md px-4 text-[length:var(--text-label)] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500 motion-reduce:transition-none ${
                    active
                      ? 'bg-muted text-primary'
                      : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'
                  }`}
                >
                  <Icon aria-hidden="true" className="size-4.5" />
                  {label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            <Link
              href="/cart"
              aria-label={`${t('cart.title')}: ${isCartHydrated ? cart.items.reduce((count, item) => count + item.quantity, 0) : 0}`}
              className="relative inline-flex min-h-11 min-w-11 items-center justify-center rounded-md text-foreground hover:bg-muted hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500"
            >
              <ShoppingBag aria-hidden="true" className="size-5" />
              {isCartHydrated && cart.items.length > 0 && (
                <span className="absolute end-0 top-0 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                  {cart.items.reduce((count, item) => count + item.quantity, 0)}
                </span>
              )}
            </Link>
            {!isLoading &&
              (user ? (
                <button
                  type="button"
                  onClick={() => void logout()}
                  aria-label={t('auth.logout')}
                  className="hidden min-h-11 min-w-11 items-center justify-center gap-2 rounded-md px-3 text-[length:var(--text-label)] font-semibold text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500 sm:inline-flex"
                >
                  <LogOut aria-hidden="true" className="size-4.5" />
                  <span className="hidden lg:inline">{t('auth.logout')}</span>
                </button>
              ) : (
                <Link
                  href="/login"
                  className="hidden min-h-11 min-w-11 items-center justify-center gap-2 rounded-md px-3 text-[length:var(--text-label)] font-semibold text-foreground hover:bg-muted hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500 sm:inline-flex"
                >
                  <LogIn aria-hidden="true" className="size-4.5" />
                  <span className="hidden lg:inline">{t('auth.login')}</span>
                </Link>
              ))}
            <div className="flex items-center divide-x divide-border overflow-hidden rounded-md border border-border bg-card rtl:divide-x-reverse">
              <LanguageToggle />
              <ThemeToggle />
            </div>
          </div>
        </Container>
      </header>

      <main id="main">{children}</main>

      <nav
        aria-label={t('nav.brand')}
        className="fixed inset-x-0 bottom-0 z-50 grid min-h-16 grid-cols-5 border-t border-border bg-background/97 px-1 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
      >
        {mobileNavItems.map(({ href, icon: Icon, mobileLabel }) => {
          const active = href === '/home' ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={`flex min-h-16 min-w-0 flex-col items-center justify-center gap-1 rounded-sm px-1 text-[length:var(--text-caption)] font-semibold focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-gold-500 ${
                active ? 'text-primary' : 'text-muted-foreground'
              }`}
            >
              <Icon aria-hidden="true" className="size-5" />
              <span className="max-w-full truncate">{mobileLabel}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}