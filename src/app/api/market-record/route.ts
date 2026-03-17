import { NextRequest, NextResponse } from "next/server";

import { applyRateLimit } from "@/lib/server/rate-limit";
import { getHistoricalMarketRecord } from "@/lib/server/pyth-pro";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const rateLimit = applyRateLimit(request, {
    key: "market-record",
    limit: 60,
    windowMs: 60_000,
  });

  if (!rateLimit.ok) {
    return rateLimit.response;
  }

  const timestamp = Number(request.nextUrl.searchParams.get("timestamp"));

  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    return NextResponse.json(
      {
        error: "timestamp is required",
      },
      {
        status: 400,
        headers: rateLimit.headers,
      },
    );
  }

  try {
    const record = await getHistoricalMarketRecord(
      {
        asset: request.nextUrl.searchParams.get("asset") ?? undefined,
        symbol: request.nextUrl.searchParams.get("symbol") ?? undefined,
        name: request.nextUrl.searchParams.get("name") ?? undefined,
        assetType: request.nextUrl.searchParams.get("assetType") ?? undefined,
        minChannel: request.nextUrl.searchParams.get("minChannel") ?? undefined,
        schedule: request.nextUrl.searchParams.get("schedule") ?? undefined,
      },
      timestamp,
    );

    return NextResponse.json(record, {
      headers: rateLimit.headers,
    });
  } catch {
    return NextResponse.json(
      {
        error: "Unable to reconstruct that market record right now.",
      },
      {
        status: 503,
        headers: rateLimit.headers,
      },
    );
  }
}
