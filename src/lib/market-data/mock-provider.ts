import { MarketDataProvider, SubscriptionParams } from "@/lib/market-data/types";
import { mockScenarioFrames } from "@/lib/mock-market-state";

export class MockScenarioProvider implements MarketDataProvider {
  subscribe(
    params: SubscriptionParams,
    onUpdate: (update: { frameIndex: number; input: (typeof mockScenarioFrames)[number] }) => void,
  ) {
    const frames = params.asset
      ? mockScenarioFrames.filter((frame) => frame.asset === params.asset)
      : mockScenarioFrames;

    const intervalMs = params.intervalMs ?? 1800;
    let frameIndex = 0;

    onUpdate({ frameIndex, input: frames[frameIndex] });

    const interval = window.setInterval(() => {
      frameIndex = (frameIndex + 1) % frames.length;
      onUpdate({ frameIndex, input: frames[frameIndex] });
    }, intervalMs);

    return () => window.clearInterval(interval);
  }
}

export const mockScenarioProvider = new MockScenarioProvider();
