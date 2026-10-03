import type { Metadata } from 'next';

import { DirectoryShopList } from '@/components/app/DirectoryShopList';
import { isShopCategory } from '@/lib/api/shops';
import { getShops } from '@/lib/api/shops.server';
import { requestClientIp } from '@/lib/auth/server';

export const metadata: Metadata = { title: 'الدليل' };

type DirectoryPageProps = {
  searchParams: Promise<{ category?: string; search?: string }>;
};

export default async function DirectoryPage({ searchParams }: DirectoryPageProps) {
  const params = await searchParams;
  const category = isShopCategory(params.category) ? params.category : undefined;
  const search = params.search?.trim().slice(0, 100) || undefined;
  const initialPage = await getShops({ category, search }, { clientIp: await requestClientIp() }).catch((error) => {
    console.error('Directory page failed', error);
    return null;
  });

  return (
    <DirectoryShopList
      key={`${category ?? 'ALL'}:${search ?? ''}`}
      category={category}
      initialPage={initialPage}
      initialSearch={search ?? ''}
    />
  );
}