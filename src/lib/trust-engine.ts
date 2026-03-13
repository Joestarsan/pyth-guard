import {
  EvidenceItem,
  MarketInput,
  MarketState,
  Recommendation,
  RiskLevel,
} from "@/lib/mock-market-state";

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function toPercent(value: number, digits = 3) {
  return `${(value * 100).toFixed(digits)}%`;
}

function toSignedPercent(value: number) {
  const prefix = value >= 0 ? "+" : "";
  return `${prefix}${value.toFixed(0)}%`;
}

function toBps(value: number) {
  return `${(value * 10_000).toFixed(1)} bps`;
}

function getSessionPenalty(session: MarketInput["marketSession"]) {
  switch (session) {
    case "regular":
      return 0;
    case "preMarket":
      return 8;
    case "postMarket":
      return 10;
    case "overNight":
      return 14;
    case "closed":
      return 30;
    default:
      return 0;
  }
}

function getRiskLevel(score: number): RiskLevel {
  if (score >= 75) return "Safe";
  if (score >= 45) return "Caution";
  return "Unsafe";
}

function getRecommendation(score: number, flags: string[]): Recommendation {
  if (score >= 75) return "Market order acceptable";
  if (score >= 60) return "Prefer limit order";
  if (score >= 45) return "Reduce size";
  if (flags.includes("Publisher Drop")) return "Avoid market order";
  return "Wait";
}

function buildNarrative(score: number, flags: string[]) {
  if (score >= 75) {
    return "Publisher agreement, spread quality, and freshness all support execution. Conditions look clean enough for normal positioning.";
  }

  if (score >= 45) {
    return "This is still tradable, but the market is losing clarity. Size down and prefer cleaner execution paths while trust stabilizes.";
  }

  if (flags.includes("Publisher Drop")) {
    return "Confidence is expanding, liquidity is slipping, and fewer publishers are participating. This is a poor window for aggressive execution.";
  }

  return "Trust is collapsing faster than price suggests. The market may still look tradable, but the underlying conditions are not clean enough.";
}

function buildEvidence(
  input: MarketInput,
  confidenceMultiplier: number,
  spreadMultiplier: number,
  publisherRatio: number,
): EvidenceItem[] {
  const confRatio = input.confidence / Math.abs(input.price);
  const spreadRatio =
    (input.bestAskPrice - input.bestBidPrice) /
    ((input.bestAskPrice + input.bestBidPrice) / 2);

  return [
    {
      label: "Confidence",
      value: toPercent(confRatio),
      delta: `${toSignedPercent((confidenceMultiplier - 1) * 100)} vs EMA`,
      trend: confidenceMultiplier > 1.2 ? "damaging" : "supporting",
      note: "Measures how much publisher disagreement has widened relative to the moving baseline.",
    },
    {
      label: "Spread",
      value: toBps(spreadRatio),
      delta: `${toSignedPercent((spreadMultiplier - 1) * 100)} vs baseline`,
      trend: spreadMultiplier > 1.2 ? "damaging" : "supporting",
      note: "Tracks whether real-time execution quality is deteriorating.",
    },
    {
      label: "Publisher Count",
      value: `${input.publisherCount} / ${input.baselinePublisherCount}`,
      delta: `${toSignedPercent((publisherRatio - 1) * 100)} vs warmup`,
      trend: publisherRatio < 0.9 ? "damaging" : "supporting",
      note: "Shows whether the market picture is being formed by fewer active contributors.",
    },
    {
      label: "Session",
      value: input.marketSession,
      delta: input.marketSession === "regular" ? "stable" : "fragile",
      trend: input.marketSession === "regular" ? "supporting" : "neutral",
      note: "Session context can change how much trust we should place in price discovery.",
    },
    {
      label: "Feed Freshness",
      value: `${input.updateAgeMs} ms`,
      delta: input.updateAgeMs <= 1500 ? "healthy" : "watching",
      trend: input.updateAgeMs <= 1500 ? "supporting" : "neutral",
      note: "A stale feed should never be allowed to masquerade as confidence.",
    },
  ];
}

export function computeMarketState(
  input: MarketInput,
  timeline: number[],
): MarketState {
  const tinyValue = 0.0000001;
  const confRatio = input.confidence / Math.abs(input.price);
  const emaConfRatio = input.emaConfidence / Math.abs(input.emaPrice);
  const spreadRatio =
    (input.bestAskPrice - input.bestBidPrice) /
    ((input.bestAskPrice + input.bestBidPrice) / 2);
  const confidenceMultiplier = confRatio / Math.max(emaConfRatio, tinyValue);
  const spreadMultiplier =
    spreadRatio / Math.max(input.baselineSpreadRatio, tinyValue);
  const publisherRatio =
    input.publisherCount / Math.max(input.baselinePublisherCount, 1);

  const confidencePenalty =
    35 * clamp((confidenceMultiplier - 1) / 2.5, 0, 1);
  const spreadPenalty = 25 * clamp((spreadMultiplier - 1) / 3, 0, 1);
  const publisherPenalty = 20 * clamp((1 - publisherRatio) / 0.4, 0, 1);
  const sessionPenalty = getSessionPenalty(input.marketSession);
  const stalenessPenalty =
    input.updateAgeMs <= 1500
      ? 0
      : input.updateAgeMs <= 3000
        ? 8
        : input.updateAgeMs <= 7000
          ? 18
          : 35;

  const trustScore = Math.round(
    clamp(
      100 -
        confidencePenalty -
        spreadPenalty -
        publisherPenalty -
        sessionPenalty -
        stalenessPenalty,
      0,
      100,
    ),
  );

  const flags: string[] = [];

  if (confidenceMultiplier > 1.8) flags.push("Confidence Spike");
  if (spreadMultiplier > 1.8) flags.push("Liquidity Stress");
  if (publisherRatio < 0.75) flags.push("Publisher Drop");

  const riskLevel = getRiskLevel(trustScore);
  const recommendation = getRecommendation(trustScore, flags);

  return {
    asset: input.asset,
    marketSession: input.marketSession,
    trustScore,
    riskLevel,
    recommendation,
    narrative: buildNarrative(trustScore, flags),
    flags,
    evidence: buildEvidence(
      input,
      confidenceMultiplier,
      spreadMultiplier,
      publisherRatio,
    ),
    timeline,
  };
}
