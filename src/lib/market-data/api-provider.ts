import { MarketDataProvider, MarketUpdate, SubscriptionParams } from "@/lib/market-data/types";
import { appendMarketSelection, DEFAULT_MARKET_SELECTION } from "@/lib/pyth/symbols";

export class ApiMarketProvider implements MarketDataProvider {
  subscribe(
    params: SubscriptionParams,
    onUpdate: Parameters<MarketDataProvider["subscribe"]>[1],
  ) {
    const selection = params.selection ?? DEFAULT_MARKET_SELECTION;
    const intervalMs = params.intervalMs ?? 1800;
    let aborted = false;

    const fetchUpdate = async () => {
      try {
        const search = new URLSearchParams();
        appendMarketSelection(search, selection);
        const response = await fetch(`/api/live-market?${search.toString()}`, {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error(`Failed to load live market data (${response.status})`);
        }

        const payload = (await response.json()) as MarketUpdate;

        if (!aborted) {
          onUpdate(payload);
        }
      } catch (error) {
        if (!aborted) {
          console.error("Market Witness live route error:", error);
        }
      }
    };

    void fetchUpdate();
    const interval = window.setInterval(fetchUpdate, intervalMs);

    return () => {
      aborted = true;
      window.clearInterval(interval);
    };
  }
}

export const apiMarketProvider = new ApiMarketProvider();
