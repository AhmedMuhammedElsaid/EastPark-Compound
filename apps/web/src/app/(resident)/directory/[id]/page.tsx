import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ShopDetailView } from "@/components/app/ShopDetailView";
import { getProducts } from "@/lib/api/products.server";
import { getReviews } from "@/lib/api/shop-interactions.server";
import { getShopDetail, ShopRequestError } from "@/lib/api/shops.server";
import { requestClientIp } from "@/lib/auth/server";

export const metadata: Metadata = { title: 'المتجر' };

type ShopDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function ShopDetailPage({ params }: ShopDetailPageProps) {
  const { id } = await params;
  const context = { clientIp: await requestClientIp() };
  const [shop, initialReviews, products] = await Promise.all([
    getShopDetail(id, context).catch((error) => {
      if (error instanceof ShopRequestError && error.status === 404) notFound();
      console.error("Shop detail page failed", error);
      return null;
    }),
    getReviews(id, undefined, context).catch((error) => {
        console.error("Shop reviews failed", error);
        return null;
    }),
    getProducts(id, context).catch((error) => {
      console.error("Shop products page failed", error);
      return null;
    }),
  ]);

  return (
    <ShopDetailView
      shop={shop}
      products={products}
      initialReviews={initialReviews}
    />
  );
}
