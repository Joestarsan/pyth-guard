import { MarketInput } from "@/lib/mock-market-state";

export type SubscriptionParams = {
  asset?: string;
  intervalMs?: number;
};

export type MarketUpdate = {
  frameIndex: number;
  input: MarketInput;
};

export type Unsubscribe = () => void;

export type MarketDataProvider = {
  subscribe: (
    params: SubscriptionParams,
    onUpdate: (update: MarketUpdate) => void,
  ) => Unsubscribe;
};
