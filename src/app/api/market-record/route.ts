import { NextRequest, NextResponse } from "next/server";

import { getHistoricalMarketRecord } from "@/lib/server/pyth-pro";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const asset = request.nextUrl.searchParams.get("asset") ?? "BTC / USD";
  const timestamp = Number(request.nextUrl.searchParams.get("timestamp"));

  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    return NextResponse.json(
      {
        error: "timestamp is required",
      },
      {
        status: 400,
      },
    );
  }

  const record = await getHistoricalMarketRecord(asset, timestamp);
  return NextResponse.json(record, {
    headers: {
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
