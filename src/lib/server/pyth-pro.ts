import {
  Channel,
  ParsedFeedPayload,
  ParsedPayload,
  PythLazerClient,
} from "@pythnetwork/pyth-lazer-sdk";

import { MarketInput, MarketState, mockScenarioFrames } from "@/lib/mock-market-state";
import {
  DEFAULT_MARKET_SELECTION,
  FEATURED_PYTH_SYMBOLS,
  formatChannelLabel,
  MarketSelection,
  PythSymbolOption,
  toPythSymbolOption,
} from "@/lib/pyth/symbols";
import { computeMarketState } from "@/lib/trust-engine";

const BASELINE_TARGET = 6;
const DEFAULT_SEED_TIMELINE = [86, 84, 83, 82, 84, 86];
const HISTORICAL_SAMPLE_INTERVAL_MS = 2 * 60 * 1000;

type BaselineState = {
  prices: number[];
  confidences: number[];
  spreadRatios: number[];
  publisherCounts: number[];
};

export type MarketRecord = {
  input: MarketInput;
  state: MarketState;
  source: "pyth-pro" | "mock";
  status: "live" | "warming" | "fallback";
  notice?: string;
  baselineSamples?: number;
  baselineTarget?: number;
  sampledAtMs: number;
  channel?: Channel;
};

type HistoricalPoint = {
  sampledAtMs: number;
  price: number;
  confidence: number;
  bestBidPrice: number;
  bestAskPrice: number;
  publisherCount: number;
};

type MarketSelectionInput = Partial<Omit<MarketSelection, "minChannel">> & {
  minChannel?: string;
};

const baselineCache = new Map<string, BaselineState>();
const symbolSearchCache = new Map<string, PythSymbolOption[]>();

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

function getSpreadRatio(bestBidPrice: number, bestAskPrice: number) {
  if (bestBidPrice <= 0 || bestAskPrice <= 0) {
    return 0.00016;
  }

  return (bestAskPrice - bestBidPrice) / ((bestAskPrice + bestBidPrice) / 2);
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
  selection: MarketSelection,
  baselineSamples: number,
  isBaselineReady: boolean,
  matchedChannel: Channel,
) {
  const notices = [
    `Live Pyth Pro feed active on ${selection.symbol} via ${formatChannelLabel(matchedChannel)}.`,
  ];

  if (!isBaselineReady) {
    notices.push(
      `Baseline warming ${baselineSamples}/${BASELINE_TARGET}. Guard is still calibrating normal conditions.`,
    );
  }

  if (selection.assetType === "equity") {
    notices.push("Session state is inferred from the feed schedule.");
  }

  return notices.join(" ");
}

function deriveSession(
  selection: MarketSelection,
): MarketInput["marketSession"] {
  if (selection.assetType !== "equity") {
    return "regular";
  }

  const schedule = selection.schedule.toLowerCase();
  if (schedule.includes("0930-1600")) return "regular";
  return "closed";
}

function toDecimal(value: string | undefined, exponent: number) {
  if (!value) return 0;
  return Number(value) * 10 ** exponent;
}

function resolveSelection(selection?: MarketSelectionInput): MarketSelection {
  const fallback =
    FEATURED_PYTH_SYMBOLS.find((candidate) => candidate.symbol === selection?.symbol) ??
    DEFAULT_MARKET_SELECTION;

  return {
    asset: selection?.asset?.trim() || fallback.asset,
    symbol: selection?.symbol?.trim() || fallback.symbol,
    name: selection?.name?.trim() || fallback.name,
    assetType: selection?.assetType?.trim() || fallback.assetType,
    minChannel:
      selection?.minChannel === "real_time" ||
      selection?.minChannel === "fixed_rate@50ms" ||
      selection?.minChannel === "fixed_rate@200ms"
        ? selection.minChannel
        : fallback.minChannel,
    schedule: selection?.schedule?.trim() || fallback.schedule,
  };
}

function getSelectionKey(selection: MarketSelection) {
  return `${selection.symbol}:${selection.asset}`;
}

function getChannelCandidates(channel: Channel) {
  if (channel === "real_time") {
    return ["real_time", "fixed_rate@50ms", "fixed_rate@200ms"] satisfies Channel[];
  }

  if (channel === "fixed_rate@50ms") {
    return ["fixed_rate@50ms", "fixed_rate@200ms"] satisfies Channel[];
  }

  return ["fixed_rate@200ms"] satisfies Channel[];
}

export async function searchPythSymbols(query?: string) {
  const normalizedQuery = query?.trim() ?? "";

  if (!normalizedQuery) {
    return FEATURED_PYTH_SYMBOLS;
  }

  const cacheKey = normalizedQuery.toLowerCase();
  if (symbolSearchCache.has(cacheKey)) {
    return symbolSearchCache.get(cacheKey) ?? FEATURED_PYTH_SYMBOLS;
  }

  const client = await getClient();
  const result = await client.getSymbols({ query: normalizedQuery });
  const ranked = result
    .filter((item) => item.asset_type !== "funding-rate" && item.state !== "inactive")
    .map(toPythSymbolOption)
    .sort((left, right) => {
      const leftScore = getSymbolRank(left, cacheKey);
      const rightScore = getSymbolRank(right, cacheKey);
      if (leftScore !== rightScore) {
        return rightScore - leftScore;
      }

      return left.symbol.localeCompare(right.symbol);
    })
    .slice(0, 12);

  symbolSearchCache.set(cacheKey, ranked);
  return ranked;
}

function getSymbolRank(option: PythSymbolOption, query: string) {
  const symbol = option.symbol.toLowerCase();
  const asset = option.asset.toLowerCase();
  const name = option.name.toLowerCase();
  const description = option.description.toLowerCase();

  if (symbol === query || asset === query || name === query) return 6;
  if (symbol.endsWith(`.${query}`) || symbol.includes(`.${query}/`)) return 5;
  if (asset.startsWith(query) || name.startsWith(query)) return 4;
  if (symbol.includes(query)) return 3;
  if (asset.includes(query) || name.includes(query)) return 2;
  if (description.includes(query)) return 1;
  return 0;
}

function getMockFallback(selection: MarketSelection, notice: string) {
  const frameIndex = Math.floor(Date.now() / 1800) % mockScenarioFrames.length;
  const frame = mockScenarioFrames[frameIndex];
  const normalizedAsset = selection.asset.toUpperCase();
  const remappedAsset =
    normalizedAsset.includes("ETH")
      ? { ...frame, asset: selection.asset, price: frame.price / 25 }
      : selection.assetType === "equity" || normalizedAsset.includes("SPY")
        ? {
            ...frame,
            asset: selection.asset,
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
        : { ...frame, asset: selection.asset };

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

function buildMarketInputFromPoint(
  selection: MarketSelection,
  point: HistoricalPoint,
  baseline: BaselineState,
) {
  const spreadRatio = getSpreadRatio(point.bestBidPrice, point.bestAskPrice);

  return {
    asset: selection.asset,
    marketSession: deriveSession(selection),
    price: point.price,
    confidence: point.confidence,
    emaPrice: average(baseline.prices.length > 0 ? baseline.prices : [point.price]),
    emaConfidence: average(
      baseline.confidences.length > 0 ? baseline.confidences : [point.confidence],
    ),
    bestBidPrice: point.bestBidPrice || point.price,
    bestAskPrice: point.bestAskPrice || point.price,
    publisherCount: point.publisherCount,
    baselinePublisherCount:
      baseline.publisherCounts.length > 0
        ? Math.max(...baseline.publisherCounts, point.publisherCount)
        : point.publisherCount,
    baselineSpreadRatio:
      baseline.spreadRatios.length > 0 ? median(baseline.spreadRatios) : spreadRatio,
    updateAgeMs: 0,
  } satisfies MarketInput;
}

function deriveHistoricalState(inputs: MarketInput[]) {
  let timeline = DEFAULT_SEED_TIMELINE;
  let currentState: MarketState | null = null;

  for (const input of inputs) {
    currentState = computeMarketState(input, timeline);
    timeline = [...currentState.timeline, currentState.trustScore].slice(-12);
  }

  if (!currentState) {
    currentState = computeMarketState(mockScenarioFrames[0], DEFAULT_SEED_TIMELINE);
  }

  return currentState;
}

async function fetchHistoricalPoint(
  client: PythLazerClient,
  selection: MarketSelection,
  timestampMs: number,
) {
  const requestBase: Omit<Parameters<PythLazerClient["getPrice"]>[0], "timestamp"> = {
    symbols: [selection.symbol],
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
    channel: selection.minChannel,
  };

  const attempts = [timestampMs, Math.floor(timestampMs / 1000)];
  let lastError: Error | null = null;

  for (const channel of getChannelCandidates(selection.minChannel)) {
    for (const timestamp of attempts) {
      try {
        const snapshot = await client.getPrice({
          ...requestBase,
          timestamp,
          channel,
        });
        const parsed = snapshot.parsed;
        const feed = parsed?.priceFeeds?.[0];

        if (!parsed || !feed || feed.exponent === undefined) {
          throw new Error("Pyth Pro returned an incomplete historical payload");
        }

        const exponent = feed.exponent;
        const sampledAtMs = Number.isFinite(Number(parsed.timestampUs))
          ? Math.floor(Number(parsed.timestampUs) / 1000)
          : timestampMs;

        return {
          sampledAtMs,
          price: toDecimal(feed.price, exponent),
          confidence: toDecimal(feed.confidence, exponent),
          bestBidPrice: toDecimal(feed.bestBidPrice, exponent),
          bestAskPrice: toDecimal(feed.bestAskPrice, exponent),
          publisherCount: feed.publisherCount ?? 0,
          channel,
        } satisfies HistoricalPoint & { channel: Channel };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
      }
    }
  }

  throw lastError ?? new Error("Unable to fetch historical point");
}

export async function getHistoricalMarketRecord(
  selectionInput: MarketSelectionInput,
  timestampMs: number,
) {
  const selection = resolveSelection(selectionInput);

  try {
    const client = await getClient();
    const timestamps = Array.from({ length: BASELINE_TARGET }, (_, index) =>
      timestampMs - (BASELINE_TARGET - 1 - index) * HISTORICAL_SAMPLE_INTERVAL_MS,
    );

    const points = (
      await Promise.all(
        timestamps.map((timestamp) =>
          fetchHistoricalPoint(client, selection, timestamp).catch(() => null),
        ),
      )
    ).filter(
      (point): point is HistoricalPoint & { channel: Channel } => point !== null,
    );

    if (points.length === 0) {
      throw new Error("No historical points were returned");
    }

    const baseline: BaselineState = {
      prices: [],
      confidences: [],
      spreadRatios: [],
      publisherCounts: [],
    };

    const inputs: MarketInput[] = [];

    for (const point of points) {
      const input = buildMarketInputFromPoint(selection, point, baseline);
      inputs.push(input);

      baseline.prices = pushWindow(baseline.prices, point.price);
      baseline.confidences = pushWindow(baseline.confidences, point.confidence);
      baseline.spreadRatios = pushWindow(
        baseline.spreadRatios,
        getSpreadRatio(point.bestBidPrice, point.bestAskPrice),
      );
      baseline.publisherCounts = pushWindow(baseline.publisherCounts, point.publisherCount);
    }

    const finalInput = inputs.at(-1) ?? inputs[0];
    const finalPoint = points.at(-1) ?? points[0];
    const state = deriveHistoricalState(inputs);

    return {
      input: finalInput,
      state,
      source: "pyth-pro" as const,
      status: "live" as const,
      baselineSamples: points.length,
      baselineTarget: BASELINE_TARGET,
      notice: `Historical Pyth Pro record reconstructed from ${points.length} samples ending at ${new Date(finalPoint.sampledAtMs).toLocaleString("en-US")} on ${selection.symbol} via ${formatChannelLabel(finalPoint.channel)}.`,
      sampledAtMs: finalPoint.sampledAtMs,
      channel: finalPoint.channel,
    } satisfies MarketRecord;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const fallback = getMockFallback(
      selection,
      `Historical record unavailable. ${formatFallbackNotice(message)}`,
    );
    const state = deriveHistoricalState([fallback.input]);

    return {
      input: fallback.input,
      state,
      source: fallback.source,
      status: fallback.status,
      baselineSamples: fallback.baselineSamples,
      baselineTarget: fallback.baselineTarget,
      notice: fallback.notice,
      sampledAtMs: timestampMs,
      channel: selection.minChannel,
    } satisfies MarketRecord;
  }
}

export async function getLiveMarketSnapshot(selectionInput: MarketSelectionInput) {
  const selection = resolveSelection(selectionInput);

  try {
    const client = await getClient();
    let parsed: ParsedPayload | undefined;
    let feed: ParsedFeedPayload | undefined;
    let matchedChannel = selection.minChannel;
    let lastError: Error | null = null;

    for (const channel of getChannelCandidates(selection.minChannel)) {
      try {
        const latest = await client.getLatestPrice({
          symbols: [selection.symbol],
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
          channel,
        });

        parsed = latest.parsed;
        feed = parsed?.priceFeeds?.[0];

        if (!parsed || !feed || feed.exponent === undefined) {
          throw new Error("Pyth Pro returned an incomplete parsed payload");
        }

        matchedChannel = channel;
        lastError = null;
        break;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
      }
    }

    if (!parsed || !feed || feed.exponent === undefined) {
      throw lastError ?? new Error("Pyth Pro returned an incomplete parsed payload");
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

    const cacheKey = getSelectionKey(selection);
    const existing = baselineCache.get(cacheKey) ?? {
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

    baselineCache.set(cacheKey, nextBaseline);

    const input: MarketInput = {
      asset: selection.asset,
      marketSession: deriveSession(selection),
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
      notice: formatLiveNotice(selection, baselineSamples, isBaselineReady, matchedChannel),
      channel: matchedChannel,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ...getMockFallback(selection, formatFallbackNotice(message)),
      channel: selection.minChannel,
    };
  }
}
