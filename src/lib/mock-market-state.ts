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

export type MarketInput = {
  asset: string;
  marketSession: "regular" | "preMarket" | "postMarket" | "overNight" | "closed";
  price: number;
  confidence: number;
  emaPrice: number;
  emaConfidence: number;
  bestBidPrice: number;
  bestAskPrice: number;
  publisherCount: number;
  baselinePublisherCount: number;
  baselineSpreadRatio: number;
  updateAgeMs: number;
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

export const supportedAssets = ["BTC / USD", "ETH / USD", "SPY / USD"] as const;
export type SupportedAsset = (typeof supportedAssets)[number];

export const mockScenarioFrames: MarketInput[] = [
  {
    asset: "BTC / USD",
    marketSession: "regular",
    price: 83240,
    confidence: 46,
    emaPrice: 83180,
    emaConfidence: 44,
    bestBidPrice: 83232,
    bestAskPrice: 83246,
    publisherCount: 24,
    baselinePublisherCount: 24,
    baselineSpreadRatio: 0.00016,
    updateAgeMs: 380,
  },
  {
    asset: "BTC / USD",
    marketSession: "regular",
    price: 83310,
    confidence: 63,
    emaPrice: 83205,
    emaConfidence: 45,
    bestBidPrice: 83300,
    bestAskPrice: 83318,
    publisherCount: 23,
    baselinePublisherCount: 24,
    baselineSpreadRatio: 0.00016,
    updateAgeMs: 410,
  },
  {
    asset: "BTC / USD",
    marketSession: "regular",
    price: 83390,
    confidence: 87,
    emaPrice: 83230,
    emaConfidence: 47,
    bestBidPrice: 83374,
    bestAskPrice: 83402,
    publisherCount: 21,
    baselinePublisherCount: 24,
    baselineSpreadRatio: 0.00016,
    updateAgeMs: 460,
  },
  {
    asset: "BTC / USD",
    marketSession: "regular",
    price: 83420,
    confidence: 121,
    emaPrice: 83244,
    emaConfidence: 50,
    bestBidPrice: 83392,
    bestAskPrice: 83438,
    publisherCount: 19,
    baselinePublisherCount: 24,
    baselineSpreadRatio: 0.00016,
    updateAgeMs: 520,
  },
  {
    asset: "BTC / USD",
    marketSession: "regular",
    price: 83435,
    confidence: 138,
    emaPrice: 83252,
    emaConfidence: 52,
    bestBidPrice: 83400,
    bestAskPrice: 83458,
    publisherCount: 17,
    baselinePublisherCount: 24,
    baselineSpreadRatio: 0.00016,
    updateAgeMs: 420,
  },
  {
    asset: "BTC / USD",
    marketSession: "regular",
    price: 83360,
    confidence: 95,
    emaPrice: 83270,
    emaConfidence: 50,
    bestBidPrice: 83342,
    bestAskPrice: 83376,
    publisherCount: 20,
    baselinePublisherCount: 24,
    baselineSpreadRatio: 0.00016,
    updateAgeMs: 390,
  },
];
