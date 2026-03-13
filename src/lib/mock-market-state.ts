export type Recommendation =
  | "Market order acceptable"
  | "Reduce size"
  | "Prefer limit order"
  | "Wait"
  | "Avoid market order";

export type RiskLevel = "Safe" | "Caution" | "Unsafe";

export type EvidenceTrend = "supporting" | "damaging" | "neutral";

export type EvidenceItem = {
  label: string;
  value: string;
  delta: string;
  trend: EvidenceTrend;
  note: string;
};

export type MarketState = {
  asset: string;
  marketSession: string;
  trustScore: number;
  riskLevel: RiskLevel;
  recommendation: Recommendation;
  narrative: string;
  flags: string[];
  evidence: EvidenceItem[];
  timeline: number[];
};

export const mockMarketState: MarketState = {
  asset: "BTC / USD",
  marketSession: "regular",
  trustScore: 41,
  riskLevel: "Unsafe",
  recommendation: "Wait",
  narrative:
    "Confidence has widened faster than price, the spread is slipping, and publisher participation is thinning. This is not a clean execution window.",
  flags: ["Confidence Spike", "Liquidity Stress", "Publisher Drop"],
  evidence: [
    {
      label: "Confidence",
      value: "0.138%",
      delta: "+96% vs EMA",
      trend: "damaging",
      note: "Publishers are disagreeing materially more than usual.",
    },
    {
      label: "Spread",
      value: "19 bps",
      delta: "+82% vs baseline",
      trend: "damaging",
      note: "Execution quality is worsening in real time.",
    },
    {
      label: "Publisher Count",
      value: "17 / 24",
      delta: "-29% vs warmup",
      trend: "damaging",
      note: "The market picture is being built from fewer voices.",
    },
    {
      label: "Session",
      value: "regular",
      delta: "stable",
      trend: "supporting",
      note: "No extra session penalty right now.",
    },
    {
      label: "Feed Freshness",
      value: "420 ms",
      delta: "healthy",
      trend: "supporting",
      note: "This is live enough to trust the warning.",
    },
  ],
  timeline: [84, 82, 79, 77, 74, 71, 66, 58, 52, 47, 44, 41],
};
