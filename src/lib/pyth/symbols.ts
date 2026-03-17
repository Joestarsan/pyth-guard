import type { Channel, SymbolResponse } from "@pythnetwork/pyth-lazer-sdk";

export type PythSymbolOption = {
  id: number;
  asset: string;
  symbol: string;
  name: string;
  description: string;
  assetType: string;
  minChannel: Channel;
  state: string;
  schedule: string;
};

export type MarketSelection = {
  asset: string;
  symbol: string;
  name: string;
  assetType: string;
  minChannel: Channel;
  schedule: string;
};

export const FEATURED_PYTH_SYMBOLS: PythSymbolOption[] = [
  {
    id: 1,
    asset: "BTC / USD",
    symbol: "Crypto.BTC/USD",
    name: "BTC/USD",
    description: "Bitcoin / US Dollar",
    assetType: "crypto",
    minChannel: "fixed_rate@200ms",
    state: "active",
    schedule: "24/7",
  },
  {
    id: 2,
    asset: "ETH / USD",
    symbol: "Crypto.ETH/USD",
    name: "ETH/USD",
    description: "Ether / US Dollar",
    assetType: "crypto",
    minChannel: "fixed_rate@200ms",
    state: "active",
    schedule: "24/7",
  },
  {
    id: 1398,
    asset: "SPY / USD",
    symbol: "Equity.US.SPY/USD",
    name: "SPY/USD",
    description: "SPDR S&P 500 ETF Trust / US Dollar",
    assetType: "equity",
    minChannel: "fixed_rate@200ms",
    state: "active",
    schedule: "0930-1600",
  },
];

export const DEFAULT_MARKET_SELECTION = toMarketSelection(FEATURED_PYTH_SYMBOLS[0]);

export function normalizeChannel(value: string | undefined): Channel {
  const normalized = value?.toLowerCase() ?? "";

  if (normalized.includes("real")) {
    return "real_time";
  }

  if (normalized.includes("50")) {
    return "fixed_rate@50ms";
  }

  return "fixed_rate@200ms";
}

export function formatChannelLabel(channel: Channel) {
  if (channel === "real_time") return "real time";
  if (channel === "fixed_rate@50ms") return "50ms";
  return "200ms";
}

export function buildAssetLabel(symbol: string, fallback?: string) {
  const pair = symbol.split(".").at(-1) ?? symbol;

  if (pair.includes("/")) {
    const [base, quote] = pair.split("/");
    if (base && quote) {
      return `${base} / ${quote}`;
    }
  }

  return fallback ?? symbol.replace(/\./g, " / ");
}

export function toPythSymbolOption(value: SymbolResponse): PythSymbolOption {
  return {
    id: value.pyth_lazer_id,
    asset: buildAssetLabel(value.symbol, value.name),
    symbol: value.symbol,
    name: value.name,
    description: value.description,
    assetType: value.asset_type,
    minChannel: normalizeChannel(value.min_channel),
    state: value.state,
    schedule: value.schedule,
  };
}

export function toMarketSelection(option: PythSymbolOption): MarketSelection {
  return {
    asset: option.asset,
    symbol: option.symbol,
    name: option.name,
    assetType: option.assetType,
    minChannel: option.minChannel,
    schedule: option.schedule,
  };
}

export function appendMarketSelection(
  search: URLSearchParams,
  selection: MarketSelection,
) {
  search.set("asset", selection.asset);
  search.set("symbol", selection.symbol);
  search.set("name", selection.name);
  search.set("assetType", selection.assetType);
  search.set("minChannel", selection.minChannel);
  search.set("schedule", selection.schedule);
}
