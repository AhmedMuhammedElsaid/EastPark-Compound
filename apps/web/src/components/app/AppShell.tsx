'use client';

import { Bell, Building2, Home, Landmark, LogIn, LogOut, Megaphone, MessageSquareText, ShieldCheck, ShoppingBag, Store, UserRound } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

import { BrandMark } from '@/components/BrandMark';
import { Container } from '@/components/Container';
import { LanguageToggle } from '@/components/LanguageToggle';
import { SkipLink } from '@/components/SkipLink';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useAuth } from '@/lib/auth/AuthProvider';
import { useCart } from '@/lib/cart/CartProvider';
import { useTranslation } from '@/lib/i18n';

type AppShellProps = { children: React.ReactNode };
type NavItem = {
  activePaths?: string[];
  href: string;
  icon: LucideIcon;
  label: string;
  mobileLabel: string;
};

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { isLoading, logout, user } = useAuth();
  const { state: cart, isHydrated: isCartHydrated } = useCart();
  const { t } = useTranslation();
  const accountHref = user ? '/profile' : '/login';
  const canSubmitFeedback = user?.role === 'RESIDENT' || user?.role === 'MERCHANT';
  const serviceItem = canSubmitFeedback
    ? { href: '/feedback', label: t('feedback.title'), mobileLabel: t('home.feedback'), icon: MessageSquareText }
    : !user
      ? { href: '/register-unit', label: t('nav.register'), mobileLabel: t('nav.unit'), icon: Building2 }
      : null;
  const navItems: NavItem[] = [
    { href: '/home', label: t('home.tab_label'), mobileLabel: t('home.tab_label'), icon: Home },
    ...(user?.role === 'ADMIN'
      ? [{ href: '/admin', label: t('admin.title'), mobileLabel: t('admin.nav_label'), icon: ShieldCheck }]
      : []),
    { href: '/directory', label: t('directory.title'), mobileLabel: t('directory.title'), icon: Store },
    {
      href: '/announcements',
      label: t('community.announcements'),
      mobileLabel: t('community.title'),
      icon: Megaphone,
      activePaths: ['/announcements', '/reports'],
    },
    { href: '/governance', label: t('governance.title'), mobileLabel: t('governance.title'), icon: Landmark },
    ...(serviceItem ? [serviceItem] : []),
    { href: accountHref, label: t('profile.account'), mobileLabel: t('profile.account'), icon: UserRound },
  ];
  const mobileNavItems = navItems.filter(({ href }) =>
    (user?.role === 'ADMIN'
      ? ['/home', '/admin', '/announcements', '/governance', accountHref]
      : ['/home', '/directory', '/announcements', '/governance', accountHref]
    ).includes(href),
  );

  return (
    <div className="min-h-screen bg-background pb-24 text-foreground md:pb-0">
      <SkipLink />
      <header className="sticky top-0 z-50 border-b border-border bg-background/97 shadow-[0_1px_0_color-mix(in_srgb,var(--color-border)_28%,transparent)] backdrop-blur-xl">
        <Container className="flex min-h-16 items-center justify-between gap-4 md:min-h-[68px]">
          <Link
            href="/home"
            className="flex min-h-11 min-w-11 items-center justify-center gap-3 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500 min-[390px]:min-w-0 min-[390px]:justify-start"
          >
            <span className="text-primary"><BrandMark size={28} /></span>
            <span className="hidden text-[length:var(--text-body-lg)] font-bold text-foreground min-[390px]:inline">{t('nav.brand')}</span>
          </Link>

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
            {user && (
              <Link
                href="/notifications"
                aria-label={t('notifications.title')}
                aria-current={pathname.startsWith('/notifications') ? 'page' : undefined}
                className={`inline-flex min-h-11 min-w-11 items-center justify-center rounded-md transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500 ${pathname.startsWith('/notifications') ? 'bg-muted text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
              >
                <Bell aria-hidden="true" className="size-5" />
              </Link>
            )}
            {!isLoading &&
              (user ? (
                <button
                  type="button"
                  onClick={() => {
                    void logout().then(() => {
                      router.replace('/login');
                      router.refresh();
                    });
                  }}
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

        <div className="hidden border-t border-border/70 bg-card/45 md:block">
          <Container>
            <nav aria-label={t('nav.brand')} className="flex min-h-14 items-stretch justify-center gap-1 lg:gap-3">
              {navItems.map(({ activePaths, href, icon: Icon, label }) => {
                const active = activePaths
                  ? activePaths.some((path) => pathname.startsWith(path))
                  : href === '/home' ? pathname === href : pathname.startsWith(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    aria-current={active ? 'page' : undefined}
                    className={`relative inline-flex min-h-14 items-center justify-center gap-2.5 px-3 text-[length:var(--text-body)] font-semibold transition-[transform,color] active:scale-[0.97] after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:origin-center after:scale-x-0 after:bg-primary after:transition-transform focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-gold-500 motion-reduce:transition-none motion-reduce:active:scale-100 motion-reduce:after:transition-none lg:px-4 ${
                      active
                        ? 'text-primary after:scale-x-100'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Icon aria-hidden="true" className="size-5" />
                    {label}
                  </Link>
                );
              })}
            </nav>
          </Container>
        </div>
      </header>

      <main id="main">{children}</main>

      <nav
        aria-label={t('nav.brand')}
        className="fixed inset-x-0 bottom-0 z-50 grid min-h-[76px] grid-cols-5 border-t border-border bg-background/97 px-1 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
      >
        {mobileNavItems.map(({ activePaths, href, icon: Icon, mobileLabel }) => {
          const active = activePaths
            ? activePaths.some((path) => pathname.startsWith(path))
            : href === '/home' ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={`flex min-h-[76px] min-w-0 flex-col items-center justify-center gap-1.5 rounded-sm px-1 text-[length:var(--text-body)] font-semibold transition-transform active:scale-[0.94] focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-gold-500 motion-reduce:transition-none motion-reduce:active:scale-100 ${
                active ? 'text-primary' : 'text-muted-foreground'
              }`}
            >
              <Icon aria-hidden="true" className="size-6" />
              <span className="max-w-full truncate">{mobileLabel}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}