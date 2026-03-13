import { MarketInput } from "@/lib/mock-market-state";

export type SubscriptionParams = {
  asset?: string;
  intervalMs?: number;
};

export type MarketUpdate = {
  frameIndex: number;
  input: MarketInput;
  source: "pyth-pro" | "mock";
  notice?: string;
};

export type Unsubscribe = () => void;

export type MarketDataProvider = {
  subscribe: (
    params: SubscriptionParams,
    onUpdate: (update: MarketUpdate) => void,
  ) => Unsubscribe;
};
