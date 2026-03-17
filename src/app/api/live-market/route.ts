import { NextRequest, NextResponse } from "next/server";

import { getLiveMarketSnapshot } from "@/lib/server/pyth-pro";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const snapshot = await getLiveMarketSnapshot({
    asset: request.nextUrl.searchParams.get("asset") ?? undefined,
    symbol: request.nextUrl.searchParams.get("symbol") ?? undefined,
    name: request.nextUrl.searchParams.get("name") ?? undefined,
    assetType: request.nextUrl.searchParams.get("assetType") ?? undefined,
    minChannel: request.nextUrl.searchParams.get("minChannel") ?? undefined,
    schedule: request.nextUrl.searchParams.get("schedule") ?? undefined,
  });
  return NextResponse.json(snapshot, {
    headers: {
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
