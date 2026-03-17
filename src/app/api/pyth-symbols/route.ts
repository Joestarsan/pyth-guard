import { NextRequest, NextResponse } from "next/server";

import { searchPythSymbols } from "@/lib/server/pyth-pro";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("query") ?? "";

  try {
    const symbols = await searchPythSymbols(query);

    return NextResponse.json(
      {
        symbols,
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to search Pyth symbols.";

    return NextResponse.json(
      {
        error: message,
        symbols: [],
      },
      {
        status: 500,
      },
    );
  }
}
