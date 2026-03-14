"use client";

import { useEffect, useState } from "react";

import {
  MarketDataProvider,
  MarketSource,
  MarketStreamStatus,
} from "@/lib/market-data/types";
import { MarketInput, MarketState } from "@/lib/mock-market-state";
import { computeMarketState } from "@/lib/trust-engine";

const DEFAULT_SEED_TIMELINE = [86, 84, 83, 82, 84, 86];

type UseMarketStreamOptions = {
  asset?: string;
  provider: MarketDataProvider;
  seedTimeline?: number[];
  intervalMs?: number;
};

export function useMarketStream({
  asset,
  provider,
  seedTimeline = DEFAULT_SEED_TIMELINE,
  intervalMs,
}: UseMarketStreamOptions) {
  const [frameIndex, setFrameIndex] = useState(0);
  const [input, setInput] = useState<MarketInput | null>(null);
  const [state, setState] = useState<MarketState | null>(null);
  const [source, setSource] = useState<MarketSource>("mock");
  const [status, setStatus] = useState<MarketStreamStatus>("warming");
  const [notice, setNotice] = useState<string | undefined>();
  const [baselineSamples, setBaselineSamples] = useState<number | undefined>();
  const [baselineTarget, setBaselineTarget] = useState<number | undefined>();

  useEffect(() => {
    setFrameIndex(0);
    setInput(null);
    setState(null);
    setSource("mock");
    setStatus("warming");
    setNotice(undefined);
    setBaselineSamples(undefined);
    setBaselineTarget(undefined);

    const unsubscribe = provider.subscribe(
      { asset, intervalMs },
      ({
        frameIndex: nextFrameIndex,
        input,
        source: nextSource,
        status: nextStatus,
        notice: nextNotice,
        baselineSamples: nextBaselineSamples,
        baselineTarget: nextBaselineTarget,
      }) => {
        setFrameIndex(nextFrameIndex);
        setInput(input);
        setSource(nextSource);
        setStatus(nextStatus);
        setNotice(nextNotice);
        setBaselineSamples(nextBaselineSamples);
        setBaselineTarget(nextBaselineTarget);
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

  return {
    frameIndex,
    input,
    state,
    source,
    status,
    notice,
    baselineSamples,
    baselineTarget,
  };
}
