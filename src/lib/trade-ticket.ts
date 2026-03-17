import {
  EvidenceItem,
  MarketInput,
  MarketState,
  RiskLevel,
} from "@/lib/mock-market-state";

export const tradeIntents = ["Long", "Short", "Exit"] as const;
export type TradeIntent = (typeof tradeIntents)[number];

export const MAX_POSITION_NOTIONAL = 50_000;

export type CourtroomLine = {
  role: "Prosecutor" | "Defense" | "Judge" | "Guard";
  text: string;
};

export type TradeAssessment = {
  intent: TradeIntent;
  orderSize: number;
  leverage: number;
  leveragePenalty: number;
  entryPrice: number;
  referencePrice: number;
  marketPrice: number;
  guardCap: number;
  sizeRatio: number;
  distanceBps: number;
  score: number;
  riskLevel: RiskLevel;
  verdict: string;
  recommendedAction: string;
  summary: string;
  objections: string[];
  evidence: EvidenceItem[];
  lines: CourtroomLine[];
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getRiskLevel(score: number): RiskLevel {
  if (score >= 78) return "Safe";
  if (score >= 55) return "Caution";
  return "Unsafe";
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatPrice(value: number, asset: string) {
  const maximumFractionDigits = asset === "SPY / USD" ? 2 : 2;

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: maximumFractionDigits,
    maximumFractionDigits,
  }).format(value);
}

function toBps(value: number) {
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${value.toFixed(1)} bps`;
}

function getReferencePrice(input: MarketInput, intent: TradeIntent) {
  if (intent === "Long") return input.bestAskPrice;
  if (intent === "Short") return input.bestBidPrice;
  return (input.bestBidPrice + input.bestAskPrice) / 2;
}

export function getDefaultEntryPrice(
  input: MarketInput,
  intent: TradeIntent,
) {
  return getReferencePrice(input, intent);
}

function getDistanceBps(
  input: MarketInput,
  intent: TradeIntent,
  entryPrice: number,
) {
  const midPrice = (input.bestBidPrice + input.bestAskPrice) / 2 || input.price;
  const normalizedMid = Math.max(Math.abs(midPrice), 0.000001);

  if (intent === "Long") {
    return (Math.max(entryPrice - input.bestAskPrice, 0) / normalizedMid) * 10_000;
  }

  if (intent === "Short") {
    return (Math.max(input.bestBidPrice - entryPrice, 0) / normalizedMid) * 10_000;
  }

  return (Math.abs(entryPrice - midPrice) / normalizedMid) * 10_000;
}

function getIntentPenalty(intent: TradeIntent, marketRiskLevel: RiskLevel) {
  if (intent === "Long") {
    if (marketRiskLevel === "Safe") return 0;
    if (marketRiskLevel === "Caution") return 12;
    return 28;
  }

  if (intent === "Short") {
    if (marketRiskLevel === "Safe") return 24;
    if (marketRiskLevel === "Caution") return 8;
    return 0;
  }

  if (marketRiskLevel === "Safe") return 6;
  if (marketRiskLevel === "Caution") return -6;
  return -14;
}

function getLeveragePenalty(leverage: number, marketRiskLevel: RiskLevel) {
  if (leverage <= 3) return 0;
  if (leverage <= 5) return marketRiskLevel === "Safe" ? 2 : 4;
  if (leverage <= 10) return marketRiskLevel === "Safe" ? 6 : 10;
  if (leverage <= 20) return marketRiskLevel === "Safe" ? 12 : 18;
  return marketRiskLevel === "Safe" ? 20 : 28;
}

function getIntentLabel(intent: TradeIntent, marketRiskLevel: RiskLevel) {
  if (intent === "Exit") {
    return marketRiskLevel === "Safe"
      ? "Optional under current tape"
      : "Protective under degraded trust";
  }

  if (intent === "Long") {
    return marketRiskLevel === "Safe"
      ? "Aligned with clean trust"
      : marketRiskLevel === "Caution"
        ? "Aggressive into caution"
        : "Aggressive into unsafe trust";
  }

  return marketRiskLevel === "Safe"
    ? "Contrarian against orderly tape"
    : "Defensive against a stressed tape";
}

function getVerdict(intent: TradeIntent, score: number) {
  if (intent === "Exit") {
    if (score >= 78) return "Exit Optional";
    if (score >= 55) return "Protective Exit";
    return "Emergency De-Risk";
  }

  if (score >= 78) return "Entry Admissible";
  if (score >= 55) return "Contested Position";
  return "Objection Sustained";
}

function getRecommendedAction(
  intent: TradeIntent,
  score: number,
  guardCap: number,
  distanceBps: number,
) {
  if (intent === "Exit") {
    if (score >= 78) {
      return "Exit is optional; trust does not require urgent de-risking yet.";
    }

    if (score >= 55) {
      return "Reduce or exit deliberately; market quality is softening.";
    }

    return "Close risk and avoid re-adding size until trust recovers.";
  }

  if (score >= 78 && distanceBps <= 6) {
    return `Entry is admissible if kept under ${formatCurrency(guardCap)}.`;
  }

  if (score >= 55) {
    return `Cut size toward ${formatCurrency(guardCap)} and prefer a limit entry.`;
  }

  return "Stand down or wait for cleaner execution conditions.";
}

function buildSummary(
  intent: TradeIntent,
  score: number,
  state: MarketState,
  sizeRatio: number,
  distanceBps: number,
  leverage: number,
) {
  if (intent === "Exit") {
    if (score >= 78) {
      return "Guard does not see enough structural stress to demand an immediate exit. Closing here is optional, not compelled by the feed.";
    }

    if (score >= 55) {
      return "The tape is getting softer. A measured exit is defensible because trust is no longer clean enough for normal risk tolerance.";
    }

    return "Execution trust is deteriorating fast enough that a protective exit is the strongest case the court can make.";
  }

  if (score >= 78) {
    return "This ticket stays inside the policy envelope. Market quality and requested execution terms are coherent enough to proceed.";
  }

  if (score >= 55) {
    return "The market is tradable, but your ticket is pressing into a weaker regime. The court allows only a smaller, cleaner entry.";
  }

  const sizeClause =
    sizeRatio > 1
      ? "oversized relative to the safe-cap policy"
      : "directionally too aggressive for the current tape";
  const priceClause =
    distanceBps > 6
      ? "and the requested entry is chasing the live market"
      : leverage > 10
        ? `while ${leverage}x leverage magnifies any mistake`
        : "even before price slippage is considered";

  return `The position is ${sizeClause} ${priceClause}. The court would object to opening it in this state.`;
}

function buildObjections(
  intent: TradeIntent,
  state: MarketState,
  sizeRatio: number,
  distanceBps: number,
  guardCap: number,
  leverage: number,
) {
  const objections: string[] = [];

  if (sizeRatio > 1) {
    objections.push(
      `Requested size is ${Math.round(sizeRatio * 100)}% of the safe ticket cap. The court would rather keep this near ${formatCurrency(guardCap)}.`,
    );
  }

  if (distanceBps > 6) {
    objections.push(
      `Requested entry is ${distanceBps.toFixed(1)} bps through the live reference price, which turns the order into a chase.`,
    );
  }

  if (intent !== "Exit" && leverage > 10) {
    objections.push(
      `${leverage}x leverage leaves little room for market structure to be wrong. The court treats that as aggressive exposure, not routine positioning.`,
    );
  }

  if (intent === "Long" && state.riskLevel !== "Safe") {
    objections.push(
      "A long entry is colliding with degraded market trust rather than leaning on clean price discovery.",
    );
  }

  if (intent === "Short" && state.riskLevel === "Safe") {
    objections.push(
      "The short thesis is fighting an orderly tape, so the burden of proof is higher than the market data alone suggests.",
    );
  }

  if (intent === "Exit" && state.riskLevel !== "Safe") {
    objections.push(
      "De-risking is supported by the same Pyth evidence that would block fresh aggressive exposure.",
    );
  }

  if (objections.length === 0) {
    objections.push(
      "No major procedural objection. The ticket fits the live market structure and respects the live safety envelope.",
    );
  }

  return objections;
}

function buildEvidence(
  input: MarketInput,
  state: MarketState,
  intent: TradeIntent,
  orderSize: number,
  leverage: number,
  leveragePenalty: number,
  entryPrice: number,
  guardCap: number,
  sizeRatio: number,
  distanceBps: number,
  score: number,
): EvidenceItem[] {
  const sizeTrend = sizeRatio > 1 ? "damaging" : "supporting";
  const priceTrend =
    distanceBps > 6 ? "damaging" : distanceBps > 0 ? "neutral" : "supporting";
  const directionTrend =
    intent === "Exit"
      ? state.riskLevel === "Safe"
        ? "neutral"
        : "supporting"
      : state.riskLevel === "Safe"
        ? intent === "Short"
          ? "damaging"
          : "supporting"
        : intent === "Long"
          ? "damaging"
          : "supporting";
  const leverageTrend =
    intent === "Exit"
      ? "neutral"
      : leverage <= 5
        ? "supporting"
        : leverage <= 10
          ? "neutral"
          : "damaging";

  return [
    {
      label: "Ticket Score",
      value: `${score}`,
      delta: `${state.trustScore} market trust base`,
      trend: score >= 78 ? "supporting" : score >= 55 ? "neutral" : "damaging",
      note: "This is the admissibility score for the specific position, not just the raw market feed.",
    },
    {
      label: "Entry Price",
      value: formatPrice(entryPrice, input.asset),
      delta:
        intent === "Exit"
          ? `${toBps(distanceBps)} vs mid`
          : intent === "Long"
            ? `${toBps(distanceBps)} vs ask`
            : `${toBps(distanceBps)} vs bid`,
      trend: priceTrend,
      note: "If the requested price is already through the live market, the court treats the ticket as a chase.",
    },
    {
      label: "Size Discipline",
      value: formatCurrency(orderSize),
      delta: `${Math.round((orderSize / Math.max(guardCap, 1)) * 100)}% of safe cap`,
      trend: sizeTrend,
      note: "Sizing is judged against the live safety envelope, not against the trader's optimism.",
    },
    {
      label: "Leverage",
      value: `${leverage}x`,
      delta: leveragePenalty > 0 ? `-${leveragePenalty} score penalty` : "No leverage objection",
      trend: leverageTrend,
      note: "High leverage turns a marginal tape into an unacceptable one much faster.",
    },
    {
      label: "Direction Fit",
      value: intent,
      delta: getIntentLabel(intent, state.riskLevel),
      trend: directionTrend,
      note: "The same market can justify an exit while still objecting to a fresh aggressive entry.",
    },
  ];
}

function buildLines(
  intent: TradeIntent,
  orderSize: number,
  leverage: number,
  state: MarketState,
  score: number,
  verdict: string,
  recommendedAction: string,
  objections: string[],
) {
  const formattedSize = formatCurrency(orderSize);
  const firstObjection = objections[0];

  return [
    {
      role: "Prosecutor" as const,
      text:
        intent === "Exit"
          ? `The defendant wants to flatten ${formattedSize} of risk. The court must decide whether this is discipline or panic.`
          : `The defendant wants to open a ${formattedSize} ${intent.toLowerCase()} ticket at ${leverage}x leverage. The burden is to prove this entry deserves to be admitted.`,
    },
    {
      role: "Defense" as const,
      text:
        score >= 78
          ? "The live tape is orderly enough that the requested ticket still fits inside the policy envelope."
          : score >= 55
            ? "There is still a tradable case here, but the entry needs more restraint than a normal dashboard would imply."
            : firstObjection,
    },
    {
      role: "Guard" as const,
      text: `The Pyth record prints ${state.trustScore} on market trust, but only ${score} on ticket admissibility. Recommended action: ${recommendedAction}`,
    },
    {
      role: "Judge" as const,
      text: `Verdict: ${verdict}. ${score >= 78 ? "This position may proceed." : score >= 55 ? "This position may proceed only under tighter terms." : "This position should not be opened as requested."}`,
    },
  ];
}

export function assessTradeTicket({
  input,
  state,
  intent,
  orderSize,
  leverage = 1,
  entryPrice,
}: {
  input: MarketInput;
  state: MarketState;
  intent: TradeIntent;
  orderSize: number;
  leverage?: number;
  entryPrice: number;
}): TradeAssessment {
  const safeLeverage = Number.isFinite(leverage) && leverage > 0
    ? Math.min(Math.max(Math.round(leverage), 1), 50)
    : 1;
  const safeEntryPrice = Number.isFinite(entryPrice) && entryPrice > 0
    ? entryPrice
    : getDefaultEntryPrice(input, intent);
  const referencePrice = getReferencePrice(input, intent);
  const guardCap = Math.max(
    Math.round(MAX_POSITION_NOTIONAL * state.executionPolicy.maxSizeFraction),
    1,
  );
  const sizeRatio = orderSize / guardCap;
  const distanceBps = getDistanceBps(input, intent, safeEntryPrice);

  const sizePenalty = clamp((sizeRatio - 1) * 28, 0, 34);
  const pricePenalty =
    intent === "Exit"
      ? clamp(distanceBps * 0.12, 0, 10)
      : clamp(distanceBps * 0.34, 0, 26);
  const intentPenalty = getIntentPenalty(intent, state.riskLevel);
  const leveragePenalty =
    intent === "Exit" ? 0 : getLeveragePenalty(safeLeverage, state.riskLevel);
  const score = Math.round(
    clamp(
      state.trustScore -
        sizePenalty -
        pricePenalty -
        intentPenalty -
        leveragePenalty,
      0,
      100,
    ),
  );
  const riskLevel = getRiskLevel(score);
  const verdict = getVerdict(intent, score);
  const recommendedAction = getRecommendedAction(
    intent,
    score,
    guardCap,
    distanceBps,
  );
  const objections = buildObjections(
    intent,
    state,
    sizeRatio,
    distanceBps,
    guardCap,
    safeLeverage,
  );
  const evidence = buildEvidence(
    input,
    state,
    intent,
    orderSize,
    safeLeverage,
    leveragePenalty,
    safeEntryPrice,
    guardCap,
    sizeRatio,
    distanceBps,
    score,
  );

  return {
    intent,
    orderSize,
    leverage: safeLeverage,
    leveragePenalty,
    entryPrice: safeEntryPrice,
    referencePrice,
    marketPrice: input.price,
    guardCap,
    sizeRatio,
    distanceBps,
    score,
    riskLevel,
    verdict,
    recommendedAction,
    summary: buildSummary(intent, score, state, sizeRatio, distanceBps, safeLeverage),
    objections,
    evidence,
    lines: buildLines(
      intent,
      orderSize,
      safeLeverage,
      state,
      score,
      verdict,
      recommendedAction,
      objections,
    ),
  };
}
