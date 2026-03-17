import { MarketDataProvider, SubscriptionParams } from "@/lib/market-data/types";
import { mockScenarioFrames } from "@/lib/mock-market-state";

export class MockScenarioProvider implements MarketDataProvider {
  subscribe(
    params: SubscriptionParams,
    onUpdate: Parameters<MarketDataProvider["subscribe"]>[1],
  ) {
    const frames = params.selection?.asset
      ? mockScenarioFrames.filter((frame) => frame.asset === params.selection?.asset)
      : mockScenarioFrames;

    const intervalMs = params.intervalMs ?? 1800;
    let frameIndex = 0;

    onUpdate({
      frameIndex,
      input: frames[frameIndex],
      source: "mock",
      status: "fallback",
      baselineSamples: 0,
      baselineTarget: 6,
      notice: "Using local scenario provider.",
    });

    const interval = window.setInterval(() => {
      frameIndex = (frameIndex + 1) % frames.length;
      onUpdate({
        frameIndex,
        input: frames[frameIndex],
        source: "mock",
        status: "fallback",
        baselineSamples: 0,
        baselineTarget: 6,
        notice: "Using local scenario provider.",
      });
    }, intervalMs);

    return () => window.clearInterval(interval);
  }
}

export const mockScenarioProvider = new MockScenarioProvider();
