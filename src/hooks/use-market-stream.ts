"use client";

import { useEffect, useState } from "react";

import { MarketDataProvider } from "@/lib/market-data/types";
import { MarketState } from "@/lib/mock-market-state";
import { computeMarketState } from "@/lib/trust-engine";

type UseMarketStreamOptions = {
  asset?: string;
  provider: MarketDataProvider;
  seedTimeline?: number[];
  intervalMs?: number;
};

export function useMarketStream({
  asset,
  provider,
  seedTimeline = [86, 84, 83, 82, 84, 86],
  intervalMs,
}: UseMarketStreamOptions) {
  const [frameIndex, setFrameIndex] = useState(0);
  const [state, setState] = useState<MarketState | null>(null);
  const [source, setSource] = useState<"pyth-pro" | "mock">("mock");
  const [notice, setNotice] = useState<string | undefined>();

  useEffect(() => {
    const unsubscribe = provider.subscribe(
      { asset, intervalMs },
      ({ frameIndex: nextFrameIndex, input, source: nextSource, notice: nextNotice }) => {
        setFrameIndex(nextFrameIndex);
        setSource(nextSource);
        setNotice(nextNotice);
        setState((current) => {
          const nextTimeline =
            current === null
              ? seedTimeline
              : [...current.timeline, current.trustScore].slice(-12);

          return computeMarketState(input, nextTimeline);
        });
      },
    );

    return unsubscribe;
  }, [asset, intervalMs, provider, seedTimeline]);

  return { frameIndex, state, source, notice };
}
