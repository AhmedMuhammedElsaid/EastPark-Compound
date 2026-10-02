'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { useAuth } from '@/lib/auth/AuthProvider';
import { loginPath } from '@/lib/auth/return-path';
import { useTranslation } from '@/lib/i18n';

export function OrderAuthGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isLoading, user } = useAuth();
  const { t } = useTranslation();

  useEffect(() => {
    if (!isLoading && !user) router.replace(loginPath(pathname));
  }, [isLoading, pathname, router, user]);

  if (isLoading || !user) {
    return (
      <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8" aria-live="polite" aria-busy="true">
        <span className="sr-only">{t('common.loading')}</span>
        <div className="h-8 w-48 animate-pulse rounded-sm bg-muted motion-reduce:animate-none" />
        <div className="mt-8 space-y-4">
          {[0, 1, 2].map((item) => (
            <div key={item} className="h-32 animate-pulse rounded-md border border-border bg-card motion-reduce:animate-none" />
          ))}
        </div>
      </div>
    );
  }

  return children;
}