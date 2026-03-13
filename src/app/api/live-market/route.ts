import { NextRequest, NextResponse } from "next/server";

import { getLiveMarketSnapshot } from "@/lib/server/pyth-pro";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const asset = request.nextUrl.searchParams.get("asset") ?? "BTC / USD";
  const snapshot = await getLiveMarketSnapshot(asset);
  return NextResponse.json(snapshot, {
    headers: {
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
