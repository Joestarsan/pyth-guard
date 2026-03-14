import { MarketInput, mockScenarioFrames } from "@/lib/mock-market-state";
import { MarketSource, MarketStreamStatus } from "@/lib/market-data/types";

export type WitnessRole = "Prosecutor" | "Defense" | "Judge" | "Guard";

export type WitnessLine = {
  role: WitnessRole;
  text: string;
};

export type WitnessCase = {
  id: string;
  title: string;
  subtitle: string;
  defendant: string;
  charge: string;
  frame: MarketInput;
  timeline: number[];
  verdict: string;
  recommendedAction: string;
  evidenceSummary: string[];
  lines: WitnessLine[];
  captureMeta?: {
    source: MarketSource;
    status: MarketStreamStatus;
    intent: string;
    orderSize: number;
    capturedAtIso: string;
  };
};

const disciplinedExitFrame: MarketInput = {
  ...mockScenarioFrames[2],
  price: 83390,
  confidence: 82,
  emaPrice: 83240,
  emaConfidence: 48,
  bestBidPrice: 83378,
  bestAskPrice: 83400,
  publisherCount: 22,
  baselinePublisherCount: 24,
  updateAgeMs: 430,
};

export const witnessCases: WitnessCase[] = [
  {
    id: "fomo-long",
    title: "The FOMO Long",
    subtitle: "Momentum was loud. Market quality was not.",
    defendant: "Aggressive Long Entry",
    charge: "Chasing price while execution trust was collapsing.",
    frame: mockScenarioFrames[4],
    timeline: [84, 82, 79, 76, 71, 63, 56, 49, 44, 41],
    verdict: "Reckless Entry",
    recommendedAction: "Wait or reduce size with a limit order.",
    evidenceSummary: [
      "Confidence widened before the move was complete.",
      "Spread deterioration made execution quality worse than the chart suggested.",
      "Publisher participation dropped while the trade looked strongest on price alone.",
    ],
    lines: [
      {
        role: "Prosecutor",
        text: "Price alone looked convincing, but confidence widened before the move settled. The market was already arguing with itself.",
      },
      {
        role: "Defense",
        text: "The candle still had strength, and the session remained open. A trader could read that as momentum continuation.",
      },
      {
        role: "Guard",
        text: "Pyth Guard disagrees. Spread expansion and publisher drop pushed execution trust below the safe threshold.",
      },
      {
        role: "Judge",
        text: "Verdict: the entry was technically possible, but the market quality evidence says it was poorly timed.",
      },
    ],
  },
  {
    id: "disciplined-exit",
    title: "The Disciplined Exit",
    subtitle: "Not every witness session ends in conviction.",
    defendant: "Controlled De-Risk",
    charge: "Exiting too early during a noisy regime shift.",
    frame: disciplinedExitFrame,
    timeline: [88, 87, 85, 81, 77, 72, 68, 65, 61, 58],
    verdict: "Defensible Decision",
    recommendedAction: "Reduce size and protect execution quality.",
    evidenceSummary: [
      "Confidence and spread both worsened before the broader market caught up.",
      "The trust engine moved from safe toward caution early enough to justify de-risking.",
      "The exit respected market quality rather than waiting for a more dramatic price confirmation.",
    ],
    lines: [
      {
        role: "Prosecutor",
        text: "Price had not fully broken yet. On the surface, this looked like premature fear.",
      },
      {
        role: "Defense",
        text: "Confidence and spread were both deteriorating. The defendant respected market quality before the crowd noticed it.",
      },
      {
        role: "Guard",
        text: "Pyth Guard confirms a caution state. The exit was not panic; it was disciplined de-risking under worsening conditions.",
      },
      {
        role: "Judge",
        text: "Verdict: prudent and defensible. The defendant acted on execution trust, not emotion.",
      },
    ],
  },
];
