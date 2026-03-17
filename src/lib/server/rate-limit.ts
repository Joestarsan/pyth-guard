import { NextRequest, NextResponse } from "next/server";

type RateLimitOptions = {
  key: string;
  limit: number;
  windowMs: number;
};

type Bucket = {
  count: number;
  resetAt: number;
};

const rateLimitBuckets = new Map<string, Bucket>();

function getClientId(request: NextRequest) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const firstIp = forwardedFor
      .split(",")
      .map((value) => value.trim())
      .find(Boolean);

    if (firstIp) return firstIp;
  }

  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();

  return "anonymous";
}

function cleanupExpiredBuckets(now: number) {
  for (const [key, bucket] of rateLimitBuckets) {
    if (bucket.resetAt <= now) {
      rateLimitBuckets.delete(key);
    }
  }
}

export function applyRateLimit(request: NextRequest, options: RateLimitOptions) {
  const now = Date.now();
  cleanupExpiredBuckets(now);

  const clientId = getClientId(request);
  const bucketKey = `${options.key}:${clientId}`;
  const existing = rateLimitBuckets.get(bucketKey);

  const bucket =
    existing && existing.resetAt > now
      ? existing
      : {
          count: 0,
          resetAt: now + options.windowMs,
        };

  bucket.count += 1;
  rateLimitBuckets.set(bucketKey, bucket);

  const remaining = Math.max(0, options.limit - bucket.count);
  const resetSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
  const headers = {
    "Cache-Control": "no-store, max-age=0",
    "X-RateLimit-Limit": String(options.limit),
    "X-RateLimit-Remaining": String(remaining),
    "X-RateLimit-Reset": String(resetSeconds),
  };

  if (bucket.count > options.limit) {
    return {
      ok: false as const,
      response: NextResponse.json(
        {
          error: "Rate limit exceeded. Please wait a moment and try again.",
        },
        {
          status: 429,
          headers: {
            ...headers,
            "Retry-After": String(resetSeconds),
          },
        },
      ),
    };
  }

  return {
    ok: true as const,
    headers,
  };
}
