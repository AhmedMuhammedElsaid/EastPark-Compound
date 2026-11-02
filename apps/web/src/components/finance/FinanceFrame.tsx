'use client';

import { Building2, History, LayoutDashboard, PlusCircle, ReceiptText } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import * as React from 'react';

import { Container } from '@/components/Container';
import { useTranslation } from '@/lib/i18n';

import { FOCUS } from './parts';

const ITEMS = [
  { href: '/finance', key: 'finance.nav.dashboard', icon: LayoutDashboard },
  { href: '/finance/flats', key: 'finance.nav.flats', icon: Building2 },
  { href: '/finance/payments', key: 'finance.nav.payments', icon: ReceiptText },
  { href: '/finance/payments/new', key: 'finance.nav.record_payment', icon: PlusCircle },
  { href: '/finance/audit', key: 'finance.nav.audit', icon: History },
] as const;

function isActive(pathname: string, href: string): boolean {
  if (href === '/finance') return pathname === '/finance';
  if (href === '/finance/payments') return pathname.startsWith(href) && !pathname.startsWith('/finance/payments/new');
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** The finance desk's section bar (top tabs; no drawer). Wraps every `/finance` page. */
export function FinanceFrame({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const pathname = usePathname();
  return (
    <div className="pb-16">
      <div className="border-b border-border bg-card/60">
        <Container>
          <nav aria-label={t('finance.nav.label')} className="-mb-px flex gap-1 overflow-x-auto">
            {ITEMS.map(({ href, key, icon: Icon }) => {
              const active = isActive(pathname, href);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  className={`flex min-h-12 shrink-0 items-center gap-2 border-b-2 px-3 text-[length:var(--text-label)] font-semibold ${FOCUS} ${
                    active ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Icon aria-hidden="true" className="size-4.5" />
                  {t(key)}
                </Link>
              );
            })}
          </nav>
        </Container>
      </div>
      <Container className="pt-8">{children}</Container>
    </div>
  );
}
