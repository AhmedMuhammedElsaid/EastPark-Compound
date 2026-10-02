import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { AuthenticatedRequestError, ROUTE_SESSION } from "@/lib/api/authenticated.server";
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
  if (!query.success) return NextResponse.json({ error: "Invalid cursor." }, { status: 400 });

  try {
    const { id } = await params;
    return NextResponse.json({ data: await getReviews(id, query.data.cursor, { clientIp: clientIpFrom(request.headers) }) });
  } catch (error) {
    console.error("Reviews proxy failed", error);
    return NextResponse.json({ error: "Reviews are temporarily unavailable." }, { status: 502 });
  }
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const input = reviewInputSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) return NextResponse.json({ error: "Invalid review." }, { status: 400 });

  try {
    const { id } = await params;
    return NextResponse.json({ data: await upsertReview(id, input.data, ROUTE_SESSION) });
  } catch (error) {
    return interactionError(error, "Review could not be saved.");
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    await deleteReview(id, ROUTE_SESSION);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return interactionError(error, "Review could not be deleted.");
  }
}

function interactionError(error: unknown, message: string): NextResponse {
  if (error instanceof AuthenticatedRequestError) {
    return NextResponse.json({ error: "Authentication required." }, { status: error.status });
  }
  console.error("Review interaction proxy failed", error);
  return NextResponse.json({ error: message }, { status: 502 });
}