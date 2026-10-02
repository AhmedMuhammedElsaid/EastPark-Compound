'use client';

import { ClipboardList, LayoutDashboard, LogOut, Package, Store } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import * as React from 'react';

import { BrandMark } from '@/components/BrandMark';
import { LanguageToggle } from '@/components/LanguageToggle';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useAuth } from '@/lib/auth/AuthProvider';
import { loginPath } from '@/lib/auth/return-path';
import { useTranslation } from '@/lib/i18n';

export function MerchantShell({ children }: { children: React.ReactNode }) {
  const { isLoading, logout, user } = useAuth();
  const { t } = useTranslation();
  const pathname = usePathname();
  const router = useRouter();

  React.useEffect(() => {
    if (isLoading) return;
    if (!user) router.replace(loginPath(pathname));
    else if (user.role !== 'MERCHANT') router.replace('/home');
  }, [isLoading, pathname, router, user]);

  if (isLoading || !user || user.role !== 'MERCHANT') {
    return (
      <main className="grid min-h-screen place-items-center bg-background" aria-busy="true">
        <p className="text-[length:var(--text-body)] text-muted-foreground">{t('common.loading')}</p>
      </main>
    );
  }

  const navigation = [
    { href: '/merchant', label: t('merchant.dashboard'), icon: LayoutDashboard },
    { href: '/merchant/menu', label: t('merchant.menu'), icon: Package },
    { href: '/merchant/orders', label: t('merchant.orders'), icon: ClipboardList },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground md:grid md:grid-cols-[240px_1fr]">
      <aside className="border-b border-border bg-card md:sticky md:top-0 md:h-screen md:border-b-0 md:border-e">
        <div className="flex min-h-[72px] items-center justify-between gap-3 border-b border-border px-5">
          <Link href="/merchant" className="flex min-h-11 items-center gap-3 font-bold focus-visible:outline-2 focus-visible:outline-gold-500">
            <span className="text-primary"><BrandMark size={26} /></span>
            <span>{t('nav.brand')}</span>
          </Link>
          <div className="flex divide-x divide-border overflow-hidden rounded-md border border-border rtl:divide-x-reverse md:hidden">
            <LanguageToggle />
            <ThemeToggle />
          </div>
        </div>

        <div className="hidden px-5 py-6 md:block">
          <div className="flex items-center gap-3 border-b border-border pb-5">
            <span className="grid size-11 place-items-center rounded-full bg-muted text-primary"><Store className="size-5" aria-hidden="true" /></span>
            <div className="min-w-0">
              <p className="truncate text-[length:var(--text-body)] font-bold">{user.name}</p>
              <p className="text-[length:var(--text-caption)] text-muted-foreground">{t('auth.role_merchant')}</p>
            </div>
          </div>
        </div>

        <nav aria-label={t('merchant.navigation')} className="flex overflow-x-auto px-3 py-2 md:block md:space-y-1 md:px-4 md:py-0">
          {navigation.map(({ href, icon: Icon, label }) => {
            const active = href === '/merchant' ? pathname === href : pathname.startsWith(href);
            return (
              <Link key={href} href={href} aria-current={active ? 'page' : undefined} className={`flex min-h-12 shrink-0 items-center gap-3 rounded-md px-4 text-[length:var(--text-label)] font-semibold focus-visible:outline-2 focus-visible:outline-gold-500 ${active ? 'bg-muted text-primary' : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'}`}>
                <Icon className="size-5" aria-hidden="true" />{label}
              </Link>
            );
          })}
        </nav>

        <div className="absolute bottom-0 hidden w-[240px] items-center gap-2 border-t border-border p-4 md:flex">
          <div className="flex divide-x divide-border overflow-hidden rounded-md border border-border rtl:divide-x-reverse"><LanguageToggle /><ThemeToggle /></div>
          <button type="button" onClick={() => void logout()} aria-label={t('auth.logout')} className="grid min-h-11 min-w-11 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-gold-500">
            <LogOut className="size-5" aria-hidden="true" />
          </button>
        </div>
      </aside>
      <main id="main" className="min-w-0">{children}</main>
    </div>
  );
}
