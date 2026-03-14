import { MarketStreamStatus } from "@/lib/market-data/types";
import { MarketState } from "@/lib/mock-market-state";

type ExecutionPolicyCardProps = {
  state: MarketState;
  status: MarketStreamStatus;
  baselineSamples?: number;
  baselineTarget?: number;
  intent: string;
  orderSize: number;
};

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function getPolicyNotice(
  status: MarketStreamStatus,
  baselineSamples?: number,
  baselineTarget?: number,
) {
  if (status === "warming") {
    return `Baseline is still warming${
      baselineSamples && baselineTarget
        ? ` (${baselineSamples}/${baselineTarget})`
        : ""
    }. Prefer smaller sizing until the live regime stabilizes.`;
  }

  if (status === "fallback") {
    return "Policy is being derived from fallback scenario data, not a fully entitled live stream.";
  }

  return null;
}

export function ExecutionPolicyCard({
  state,
  status,
  baselineSamples,
  baselineTarget,
  intent,
  orderSize,
}: ExecutionPolicyCardProps) {
  const { executionPolicy } = state;
  const policyNotice = getPolicyNotice(status, baselineSamples, baselineTarget);
  const guardCap = Math.round(orderSize * executionPolicy.maxSizeFraction);

  return (
    <article className="policyCard">
      <div className="panelHeader">
        <span className="panelEyebrow">Execution Policy</span>
        <strong>What Guard Allows</strong>
      </div>

      <div className="policySummary">
        <span className="policyIntentBadge">{intent}</span>
        <span>Request {formatCurrency(orderSize)}</span>
        <span>Guard cap {formatCurrency(guardCap)}</span>
      </div>

      <div className="policyGrid">
        <div className="policyMetric">
          <span>Mode</span>
          <strong>{executionPolicy.executionMode}</strong>
        </div>
        <div className="policyMetric">
          <span>Market Order</span>
          <strong>{executionPolicy.marketOrderAllowed ? "Allowed" : "Blocked"}</strong>
        </div>
        <div className="policyMetric">
          <span>Max Size</span>
          <strong>{formatPercent(executionPolicy.maxSizeFraction)}</strong>
        </div>
        <div className="policyMetric">
          <span>Cooldown</span>
          <strong>{executionPolicy.cooldownSeconds}s</strong>
        </div>
      </div>

      {policyNotice ? (
        <p className={`policyNotice status${status}`}>{policyNotice}</p>
      ) : null}
    </article>
  );
}
