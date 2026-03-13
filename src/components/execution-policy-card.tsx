import { MarketState } from "@/lib/mock-market-state";

type ExecutionPolicyCardProps = {
  state: MarketState;
};

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

export function ExecutionPolicyCard({ state }: ExecutionPolicyCardProps) {
  const { executionPolicy } = state;

  return (
    <article className="policyCard">
      <div className="panelHeader">
        <span className="panelEyebrow">Execution Policy</span>
        <strong>What Guard Allows</strong>
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
    </article>
  );
}
