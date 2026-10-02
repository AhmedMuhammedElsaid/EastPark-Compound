import { NextRequest, NextResponse } from "next/server";

import { AuthenticatedRequestError, ROUTE_SESSION } from "@/lib/api/authenticated.server";
import { getShopSaved, setShopSaved } from "@/lib/api/shop-interactions.server";

export const maxDuration = 30;

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    return NextResponse.json({ data: { saved: await getShopSaved(id, ROUTE_SESSION) } });
  } catch (error) {
    return savedError(error);
  }
}

export async function POST(_request: NextRequest, { params }: RouteContext) {
  return updateSaved(params, true);
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  return updateSaved(params, false);
}

async function updateSaved(params: Promise<{ id: string }>, saved: boolean) {
  try {
    const { id } = await params;
    await setShopSaved(id, saved, ROUTE_SESSION);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return savedError(error);
  }
}

function savedError(error: unknown): NextResponse {
  if (error instanceof AuthenticatedRequestError) {
    return NextResponse.json({ error: "Authentication required." }, { status: error.status });
  }
  console.error("Saved shop proxy failed", error);
  return NextResponse.json({ error: "Saved shop could not be updated." }, { status: 502 });
}