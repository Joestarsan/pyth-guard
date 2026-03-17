import { NextRequest, NextResponse } from "next/server";

import { applyRateLimit } from "@/lib/server/rate-limit";
import { searchPythSymbols } from "@/lib/server/pyth-pro";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const rateLimit = applyRateLimit(request, {
    key: "pyth-symbols",
    limit: 90,
    windowMs: 60_000,
  });

  if (!rateLimit.ok) {
    return rateLimit.response;
  }

  const query = request.nextUrl.searchParams.get("query") ?? "";

  try {
    const symbols = await searchPythSymbols(query);

    return NextResponse.json(
        {
          symbols,
        },
        {
          headers: rateLimit.headers,
        },
      );
  } catch {
    return NextResponse.json(
      {
        error: "Unable to search Pyth symbols right now.",
        symbols: [],
      },
      {
        status: 500,
        headers: rateLimit.headers,
      },
    );
  }
}
