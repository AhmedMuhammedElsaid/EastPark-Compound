'use client';

import { FileText, Megaphone } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { useTranslation } from '@/lib/i18n';

const items = [
  { href: '/announcements', key: 'announcements', icon: Megaphone },
  { href: '/reports', key: 'reports', icon: FileText },
] as const;

export function CommunityNav() {
  const pathname = usePathname();
  const { t } = useTranslation();

  return (
    <nav aria-label={t('community.title')} className="mt-6 flex flex-wrap gap-2">
      {items.map(({ href, icon: Icon, key }) => {
        const active = pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-[length:var(--text-label)] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500 motion-reduce:transition-none ${
              active
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-card text-muted-foreground hover:border-primary hover:text-foreground'
            }`}
          >
            <Icon aria-hidden="true" className="size-4" />
            {t(`community.${key}`)}
          </Link>
        );
      })}
    </nav>
  );
}