import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ShopDetailView } from "@/components/app/ShopDetailView";
import { getShopDetail, ShopRequestError } from "@/lib/api/shops.server";

export const metadata: Metadata = { title: "Shop" };

type ShopDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function ShopDetailPage({ params }: ShopDetailPageProps) {
  const { id } = await params;
  const shop = await getShopDetail(id).catch((error) => {
    if (error instanceof ShopRequestError && error.status === 404) notFound();
    console.error("Shop detail page failed", error);
    return null;
  });

  return <ShopDetailView shop={shop} />;
}
