import { NextRequest, NextResponse } from "next/server";

import {
  getProducts,
  isProductAvailability,
} from "@/lib/api/products.server";

type ProductRouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: NextRequest, { params }: ProductRouteContext) {
  const { id } = await params;
  const availabilityValue = request.nextUrl.searchParams.get("availability");
  const availability = isProductAvailability(availabilityValue)
    ? availabilityValue
    : undefined;
  const cursor = request.nextUrl.searchParams.get("cursor") ?? undefined;
  const search =
    request.nextUrl.searchParams.get("search")?.trim().slice(0, 100) ||
    undefined;

  try {
    const page = await getProducts(id, { availability, cursor, search });
    return NextResponse.json({ data: page });
  } catch (error) {
    console.error("Products proxy failed", error);
    return NextResponse.json(
      { error: "Products are temporarily unavailable." },
      { status: 502 },
    );
  }
}