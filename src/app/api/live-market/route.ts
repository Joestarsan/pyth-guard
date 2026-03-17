import { NextRequest, NextResponse } from "next/server";

import { applyRateLimit } from "@/lib/server/rate-limit";
import { getLiveMarketSnapshot } from "@/lib/server/pyth-pro";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const rateLimit = applyRateLimit(request, {
    key: "live-market",
    limit: 120,
    windowMs: 60_000,
  });

  if (!rateLimit.ok) {
    return rateLimit.response;
  }

  try {
    const snapshot = await getLiveMarketSnapshot({
      asset: request.nextUrl.searchParams.get("asset") ?? undefined,
      symbol: request.nextUrl.searchParams.get("symbol") ?? undefined,
      name: request.nextUrl.searchParams.get("name") ?? undefined,
      assetType: request.nextUrl.searchParams.get("assetType") ?? undefined,
      minChannel: request.nextUrl.searchParams.get("minChannel") ?? undefined,
      schedule: request.nextUrl.searchParams.get("schedule") ?? undefined,
    });

    return NextResponse.json(snapshot, {
      headers: rateLimit.headers,
    });
  } catch {
    return NextResponse.json(
      {
        error: "Unable to load the live market record right now.",
      },
      {
        status: 503,
        headers: rateLimit.headers,
      },
    );
  }
}
