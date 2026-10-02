import { NextResponse } from "next/server";

import { getShopDetail, ShopRequestError } from "@/lib/api/shops.server";
import { clientIpFrom } from "@/lib/auth/server";

export const maxDuration = 30;

type ShopRouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, { params }: ShopRouteContext) {
  const { id } = await params;

  try {
    const shop = await getShopDetail(id, { clientIp: clientIpFrom(request.headers) });
    return NextResponse.json({ data: shop });
  } catch (error) {
    if (error instanceof ShopRequestError && error.status === 404) {
      return NextResponse.json({ error: "Shop not found." }, { status: 404 });
    }

    console.error("Shop detail proxy failed", error);
    return NextResponse.json(
      { error: "Shop is temporarily unavailable." },
      { status: 502 },
    );
  }
}
