import { MarketInput } from "@/lib/mock-market-state";
import { MarketSelection } from "@/lib/pyth/symbols";

export type SubscriptionParams = {
  selection?: MarketSelection;
  intervalMs?: number;
};

export type MarketSource = "pyth-pro" | "mock";

export type MarketStreamStatus = "live" | "warming" | "fallback";

export type MarketUpdate = {
  frameIndex: number;
  input: MarketInput;
  source: MarketSource;
  status: MarketStreamStatus;
  notice?: string;
  baselineSamples?: number;
  baselineTarget?: number;
  channel?: string;
};

export type Unsubscribe = () => void;

export type MarketDataProvider = {
  subscribe: (
    params: SubscriptionParams,
    onUpdate: (update: MarketUpdate) => void,
  ) => Unsubscribe;
};
