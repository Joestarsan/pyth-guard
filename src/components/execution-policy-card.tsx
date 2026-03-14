import { MarketStreamStatus } from "@/lib/market-data/types";
import { MarketState } from "@/lib/mock-market-state";
import {
  formatPrice,
  TradeAssessment,
} from "@/lib/trade-ticket";

type ExecutionPolicyCardProps = {
  state: MarketState;
  status: MarketStreamStatus;
  baselineSamples?: number;
  baselineTarget?: number;
  intent: string;
  orderSize: number;
  tradeAssessment: TradeAssessment;
};

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
  tradeAssessment,
}: ExecutionPolicyCardProps) {
  const { executionPolicy } = state;
  const policyNotice = getPolicyNotice(status, baselineSamples, baselineTarget);
  const guardCap = tradeAssessment.guardCap;
  const sizePercentOfCap = `${Math.round(tradeAssessment.sizeRatio * 100)}%`;

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
        <span>Ticket {tradeAssessment.score}</span>
      </div>

      <div className="policyGrid">
        <div className="policyMetric">
          <span>Entry</span>
          <strong>{formatPrice(tradeAssessment.entryPrice, state.asset)}</strong>
        </div>
        <div className="policyMetric">
          <span>Live Mark</span>
          <strong>{formatPrice(tradeAssessment.referencePrice, state.asset)}</strong>
        </div>
        <div className="policyMetric">
          <span>Size vs Cap</span>
          <strong>{sizePercentOfCap}</strong>
        </div>
        <div className="policyMetric">
          <span>Route</span>
          <strong>{executionPolicy.executionMode}</strong>
        </div>
      </div>

      <p className="policyRecommendation">{tradeAssessment.recommendedAction}</p>

      {policyNotice ? (
        <p className={`policyNotice status${status}`}>{policyNotice}</p>
      ) : null}
    </article>
  );
}
