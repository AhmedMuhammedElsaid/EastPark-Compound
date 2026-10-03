import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { ProductMenu } from '@/components/app/ProductMenu';
import { getProducts } from '@/lib/api/products.server';
import { getShopDetail, ShopRequestError } from '@/lib/api/shops.server';
import { requestClientIp } from '@/lib/auth/server';

export const metadata: Metadata = { title: 'القائمة' };

type ProductMenuPageProps = {
  params: Promise<{ id: string }>;
};

export default async function ProductMenuPage({ params }: ProductMenuPageProps) {
  const { id } = await params;

  const context = { clientIp: await requestClientIp() };
  // Independent requests: fetch in parallel instead of shop-then-products.
  const [shop, initialPage] = await Promise.all([
    getShopDetail(id, context).catch((error) => {
      if (error instanceof ShopRequestError && error.status === 404) notFound();
      console.error('Product menu shop request failed', error);
      throw error;
    }),
    getProducts(id, context).catch((error) => {
      console.error('Product menu request failed', error);
      return null;
    }),
  ]);

  return <ProductMenu shop={shop} initialPage={initialPage} />;
}