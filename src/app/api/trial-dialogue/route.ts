import { NextRequest, NextResponse } from "next/server";

import { applyRateLimit } from "@/lib/server/rate-limit";
import { enhanceTrialDialogue } from "@/lib/server/trial-dialogue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isValidBody(value: unknown) {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.asset === "string" &&
    typeof candidate.action === "string" &&
    typeof candidate.caseLine === "string" &&
    Array.isArray(candidate.beats) &&
    candidate.beats.length > 0 &&
    candidate.verdict &&
    typeof candidate.verdict === "object"
  );
}

export async function POST(request: NextRequest) {
  const rateLimit = applyRateLimit(request, {
    key: "trial-dialogue",
    limit: 24,
    windowMs: 60_000,
  });

  if (!rateLimit.ok) {
    return rateLimit.response;
  }

  const body = await request.json().catch(() => null);

  if (!isValidBody(body)) {
    return NextResponse.json(
      {
        enhanced: false,
      },
      {
        status: 400,
        headers: rateLimit.headers,
      },
    );
  }

  try {
    const enhanced = await enhanceTrialDialogue(body);

    if (!enhanced) {
      return NextResponse.json(
        {
          enhanced: false,
        },
        {
          headers: rateLimit.headers,
        },
      );
    }

    return NextResponse.json(
      {
        enhanced: true,
        ...enhanced,
      },
      {
        headers: rateLimit.headers,
      },
    );
  } catch {
    return NextResponse.json(
      {
        enhanced: false,
      },
      {
        headers: rateLimit.headers,
      },
    );
  }
}
