import { NextRequest, NextResponse } from "next/server";

import { applyRateLimit } from "@/lib/server/rate-limit";
import { getHistoricalCoverageHint } from "@/lib/server/pyth-pro";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const rateLimit = applyRateLimit(request, {
    key: "historical-coverage",
    limit: 30,
    windowMs: 60_000,
  });

  if (!rateLimit.ok) {
    return rateLimit.response;
  }

  try {
    const coverage = await getHistoricalCoverageHint({
      asset: request.nextUrl.searchParams.get("asset") ?? undefined,
      symbol: request.nextUrl.searchParams.get("symbol") ?? undefined,
      name: request.nextUrl.searchParams.get("name") ?? undefined,
      assetType: request.nextUrl.searchParams.get("assetType") ?? undefined,
      minChannel: request.nextUrl.searchParams.get("minChannel") ?? undefined,
      schedule: request.nextUrl.searchParams.get("schedule") ?? undefined,
    });

    return NextResponse.json(coverage, {
      headers: rateLimit.headers,
    });
  } catch {
    return NextResponse.json(
      {
        available: false,
        notice: "Historical coverage could not be checked right now.",
      },
      {
        status: 500,
        headers: rateLimit.headers,
      },
    );
  }
}
