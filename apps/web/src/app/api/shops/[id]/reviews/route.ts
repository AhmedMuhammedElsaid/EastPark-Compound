import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { ROUTE_SESSION } from "@/lib/api/authenticated.server";
import { bffErrorResponse } from "@/lib/api/bff-errors";
import { reviewInputSchema } from "@/lib/api/shop-interactions";
import {
  deleteReview,
  getReviews,
  upsertReview,
} from "@/lib/api/shop-interactions.server";
import { clientIpFrom } from "@/lib/auth/server";

export const maxDuration = 30;

type RouteContext = { params: Promise<{ id: string }> };
const querySchema = z.object({ cursor: z.string().min(1).max(200).optional() });

export async function GET(request: NextRequest, { params }: RouteContext) {
  const query = querySchema.safeParse({
    cursor: request.nextUrl.searchParams.get("cursor") ?? undefined,
  });
  if (!query.success) return NextResponse.json({ error: "validation" }, { status: 400 });

  try {
    const { id } = await params;
    return NextResponse.json({ data: await getReviews(id, query.data.cursor, { clientIp: clientIpFrom(request.headers) }) });
  } catch (error) {
    return bffErrorResponse(error, "Reviews proxy failed");
  }
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const input = reviewInputSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) return NextResponse.json({ error: "validation" }, { status: 400 });

  try {
    const { id } = await params;
    return NextResponse.json({ data: await upsertReview(id, input.data, ROUTE_SESSION) });
  } catch (error) {
    return bffErrorResponse(error, "Review save proxy failed");
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    await deleteReview(id, ROUTE_SESSION);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return bffErrorResponse(error, "Review delete proxy failed");
  }
}
