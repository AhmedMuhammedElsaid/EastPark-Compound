import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ProductMenu } from "@/components/app/ProductMenu";
import {
  getProducts,
  isProductAvailability,
} from "@/lib/api/products.server";
import { getShopDetail, ShopRequestError } from "@/lib/api/shops.server";

export const metadata: Metadata = { title: "Menu" };

type ProductMenuPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ availability?: string; search?: string }>;
};

export default async function ProductMenuPage({
  params,
  searchParams,
}: ProductMenuPageProps) {
  const { id } = await params;
  const query = await searchParams;
  const availability = isProductAvailability(query.availability)
    ? query.availability
    : "all";
  const search = query.search?.trim().slice(0, 100) ?? "";

  const shop = await getShopDetail(id).catch((error) => {
    if (error instanceof ShopRequestError && error.status === 404) notFound();
    console.error("Product menu shop request failed", error);
    return null;
  });
  const initialPage = shop
    ? await getProducts(id, { availability, search }).catch((error) => {
        console.error("Product menu request failed", error);
        return null;
      })
    : null;

  return (
    <ProductMenu
      shop={shop}
      initialPage={initialPage}
      initialAvailability={availability}
      initialSearch={search}
    />
  );
}