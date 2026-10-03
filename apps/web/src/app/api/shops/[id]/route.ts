import { NextResponse } from "next/server";

import { bffErrorResponse } from "@/lib/api/bff-errors";
import { getShopDetail } from "@/lib/api/shops.server";
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
    return bffErrorResponse(error, "Shop detail proxy failed");
  }
}
