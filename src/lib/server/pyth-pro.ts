import { PythLazerClient, SymbolResponse } from "@pythnetwork/pyth-lazer-sdk";

import { MarketInput, mockScenarioFrames } from "@/lib/mock-market-state";

const BASELINE_TARGET = 6;

type AssetKey = "BTC / USD" | "ETH / USD" | "SPY / USD";

type AssetConfig = {
  key: AssetKey;
  feedId: number;
  symbol: string;
  assetType: "crypto" | "equity";
};

type BaselineState = {
  prices: number[];
  confidences: number[];
  spreadRatios: number[];
  publisherCounts: number[];
};

const ASSET_CONFIG: Record<AssetKey, AssetConfig> = {
  "BTC / USD": {
    key: "BTC / USD",
    feedId: 1,
    symbol: "Crypto.BTC/USD",
    assetType: "crypto",
  },
  "ETH / USD": {
    key: "ETH / USD",
    feedId: 2,
    symbol: "Crypto.ETH/USD",
    assetType: "crypto",
  },
  "SPY / USD": {
    key: "SPY / USD",
    feedId: 1398,
    symbol: "Equity.US.SPY/USD",
    assetType: "equity",
  },
};

const baselineCache = new Map<AssetKey, BaselineState>();
const symbolMetadataCache = new Map<AssetKey, SymbolResponse | null>();

let clientPromise: Promise<PythLazerClient> | null = null;

function getClient() {
  const token = process.env.PYTH_PRO_TOKEN;

  if (!token) {
    throw new Error("PYTH_PRO_TOKEN is missing");
  }

  if (!clientPromise) {
    clientPromise = PythLazerClient.create({
      token,
    });
  }

  return clientPromise;
}

function average(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1);
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  if (sorted.length === 0) return 0;
  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2;
  }

  return sorted[middle];
}

function pushWindow(values: number[], value: number, max = 20) {
  return [...values, value].slice(-max);
}

function formatFallbackNotice(message: string) {
  const normalized = message.toLowerCase();

  if (normalized.includes("pyth_pro_token is missing")) {
    return "Mock fallback active. Set PYTH_PRO_TOKEN to enable live Pyth Pro access.";
  }

  if (
    normalized.includes("insufficient access") ||
    normalized.includes("allowed types") ||
    normalized.includes("not in allowed types")
  ) {
    return "Mock fallback active. This key can discover symbols, but latest-price entitlements are not enabled yet.";
  }

  if (normalized.includes("incomplete parsed payload")) {
    return "Mock fallback active. Pyth Pro returned an incomplete live payload.";
  }

  return "Mock fallback active. Pyth Pro live data is temporarily unavailable.";
}

function formatLiveNotice(
  assetKey: AssetKey,
  baselineSamples: number,
  isBaselineReady: boolean,
) {
  const notices = ["Live Pyth Pro feed active."];

  if (!isBaselineReady) {
    notices.push(
      `Baseline warming ${baselineSamples}/${BASELINE_TARGET}. Guard is still calibrating normal conditions.`,
    );
  }

  if (assetKey === "SPY / USD") {
    notices.push("Session state is currently inferred from symbol metadata.");
  }

  return notices.join(" ");
}

function deriveSession(
  assetKey: AssetKey,
  metadata: SymbolResponse | null,
): MarketInput["marketSession"] {
  if (assetKey !== "SPY / USD") {
    return "regular";
  }

  const schedule = metadata?.schedule?.toLowerCase() ?? "";
  if (schedule.includes("0930-1600")) return "regular";
  return "closed";
}

function toDecimal(value: string | undefined, exponent: number) {
  if (!value) return 0;
  return Number(value) * 10 ** exponent;
}

async function getSymbolMetadata(assetKey: AssetKey) {
  if (symbolMetadataCache.has(assetKey)) {
    return symbolMetadataCache.get(assetKey) ?? null;
  }

  const client = await getClient();
  const result = await client.getSymbols({ query: ASSET_CONFIG[assetKey].symbol });
  const found = result.find(
    (item) => item.pyth_lazer_id === ASSET_CONFIG[assetKey].feedId,
  ) ?? null;
  symbolMetadataCache.set(assetKey, found);
  return found;
}

function getMockFallback(assetKey: AssetKey, notice: string) {
  const frameIndex = Math.floor(Date.now() / 1800) % mockScenarioFrames.length;
  const frame = mockScenarioFrames[frameIndex];
  const remappedAsset =
    assetKey === "ETH / USD"
      ? { ...frame, asset: "ETH / USD", price: frame.price / 25 }
      : assetKey === "SPY / USD"
        ? {
            ...frame,
            asset: "SPY / USD",
            marketSession: "regular" as const,
            price: 575.12,
            emaPrice: 574.84,
            bestBidPrice: 575.08,
            bestAskPrice: 575.15,
            confidence: 0.19,
            emaConfidence: 0.16,
            publisherCount: 5,
            baselinePublisherCount: 6,
            baselineSpreadRatio: 0.00012,
          }
        : frame;

  return {
    frameIndex,
    input: remappedAsset,
    source: "mock" as const,
    status: "fallback" as const,
    baselineSamples: 0,
    baselineTarget: BASELINE_TARGET,
    notice,
  };
}

export async function getLiveMarketSnapshot(asset: string) {
  const assetKey = (Object.keys(ASSET_CONFIG).includes(asset)
    ? asset
    : "BTC / USD") as AssetKey;

  try {
    const client = await getClient();
    const metadata = await getSymbolMetadata(assetKey);
    const latest = await client.getLatestPrice({
      priceFeedIds: [ASSET_CONFIG[assetKey].feedId],
      properties: [
        "price",
        "confidence",
        "bestBidPrice",
        "bestAskPrice",
        "publisherCount",
        "exponent",
      ],
      formats: ["evm"],
      parsed: true,
      channel: "fixed_rate@200ms",
    });

    const parsed = latest.parsed;
    const feed = parsed?.priceFeeds?.[0];

    if (!parsed || !feed || feed.exponent === undefined) {
      throw new Error("Pyth Pro returned an incomplete parsed payload");
    }

    const exponent = feed.exponent;
    const price = toDecimal(feed.price, exponent);
    const confidence = toDecimal(feed.confidence, exponent);
    const bestBidPrice = toDecimal(feed.bestBidPrice, exponent);
    const bestAskPrice = toDecimal(feed.bestAskPrice, exponent);
    const publisherCount = feed.publisherCount ?? 0;
    const timestampUs = Number(parsed.timestampUs);
    const updateAgeMs = Number.isFinite(timestampUs)
      ? Math.max(0, Date.now() - Math.floor(timestampUs / 1000))
      : 0;

    const existing = baselineCache.get(assetKey) ?? {
      prices: [],
      confidences: [],
      spreadRatios: [],
      publisherCounts: [],
    };

    const spreadRatio =
      bestBidPrice > 0 && bestAskPrice > 0
        ? (bestAskPrice - bestBidPrice) / ((bestAskPrice + bestBidPrice) / 2)
        : existing.spreadRatios.at(-1) ?? 0.00016;

    const nextBaseline: BaselineState = {
      prices: pushWindow(existing.prices, price),
      confidences: pushWindow(existing.confidences, confidence),
      spreadRatios: pushWindow(existing.spreadRatios, spreadRatio),
      publisherCounts: pushWindow(existing.publisherCounts, publisherCount),
    };
    const baselineSamples = nextBaseline.prices.length;
    const isBaselineReady = baselineSamples >= BASELINE_TARGET;

    baselineCache.set(assetKey, nextBaseline);

    const input: MarketInput = {
      asset: assetKey,
      marketSession: deriveSession(assetKey, metadata),
      price,
      confidence,
      emaPrice: average(nextBaseline.prices),
      emaConfidence: average(nextBaseline.confidences),
      bestBidPrice: bestBidPrice || price,
      bestAskPrice: bestAskPrice || price,
      publisherCount,
      baselinePublisherCount: Math.max(...nextBaseline.publisherCounts, publisherCount),
      baselineSpreadRatio: median(nextBaseline.spreadRatios) || 0.00016,
      updateAgeMs,
    };

    return {
      frameIndex: baselineSamples - 1,
      input,
      source: "pyth-pro" as const,
      status: isBaselineReady ? ("live" as const) : ("warming" as const),
      baselineSamples,
      baselineTarget: BASELINE_TARGET,
      notice: formatLiveNotice(assetKey, baselineSamples, isBaselineReady),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return getMockFallback(assetKey, formatFallbackNotice(message));
  }
}
