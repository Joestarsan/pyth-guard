import { MarketStreamStatus } from "@/lib/market-data/types";
import { MarketState } from "@/lib/mock-market-state";
import {
  formatPrice,
  TradeAssessment,
} from "@/lib/trade-ticket";

type TrustDialProps = {
  state: MarketState;
  status: MarketStreamStatus;
  baselineSamples?: number;
  baselineTarget?: number;
  tradeAssessment: TradeAssessment;
};

function getStatusNote(
  status: MarketStreamStatus,
  baselineSamples?: number,
  baselineTarget?: number,
) {
  if (status === "warming") {
    const baselineLabel = baselineTarget
      ? `${baselineTarget}-sample baseline`
      : "live baseline";
    const progressLabel =
      baselineSamples && baselineTarget
        ? ` (${baselineSamples}/${baselineTarget})`
        : "";

    return `Live feed is active, but Guard is still calibrating its ${baselineLabel}${progressLabel}. Treat this verdict as provisional.`;
  }

  if (status === "fallback") {
    return "This verdict is running on fallback scenario data while live latest-price access is unavailable.";
  }

  return null;
}

export function TrustDial({
  state,
  status,
  baselineSamples,
  baselineTarget,
  tradeAssessment,
}: TrustDialProps) {
  const circumference = 2 * Math.PI * 120;
  const safeScore = Number.isFinite(tradeAssessment.score)
    ? Math.min(Math.max(tradeAssessment.score, 0), 100)
    : 0;
  const offset = circumference - (safeScore / 100) * circumference;
  const statusNote = getStatusNote(status, baselineSamples, baselineTarget);
  const spotlightMetrics = tradeAssessment.evidence.slice(0, 4);
  const eyebrow =
    status === "fallback"
      ? "Fallback Position Verdict"
      : status === "warming"
        ? "Live Position Warm-up"
        : "Live Position Verdict";

  return (
    <section className="trustDial">
      <div className="dialAura" />
      <div className="dialStage">
        <div className="dialCore">
          <svg className="dialSvg" viewBox="0 0 300 300" aria-hidden="true">
            <circle className="dialTrack" cx="150" cy="150" r="120" />
            <circle
              className="dialValue"
              cx="150"
              cy="150"
              r="120"
              strokeDasharray={`${circumference} ${circumference}`}
              strokeDashoffset={offset}
            />
          </svg>
          <div className="dialCoreShell" aria-hidden="true" />

          <div className="dialContent">
            <span className="dialEyebrow">{eyebrow}</span>
            <strong className="dialScore">{safeScore}</strong>
            <span className={`riskBadge risk${tradeAssessment.riskLevel}`}>
              {tradeAssessment.riskLevel}
            </span>
            <p className="dialRecommendation">{tradeAssessment.verdict}</p>
            <div className="dialMetaRow">
              <span className="dialMetaChip">Market trust {state.trustScore}</span>
              <span className="dialMetaChip">
                Entry {formatPrice(tradeAssessment.entryPrice, state.asset)}
              </span>
            </div>
          </div>
        </div>

        <div className="dialSignalGrid">
          {spotlightMetrics.map((item) => (
            <article key={item.label} className={`dialSignalCard trend${item.trend}`}>
              <span className="dialSignalLabel">{item.label}</span>
              <strong className="dialSignalValue">{item.value}</strong>
              <span className="dialSignalDelta">{item.delta}</span>
            </article>
          ))}
        </div>

        <div className="dialNarrativeBlock">
          <p className="dialNarrative">{tradeAssessment.summary}</p>
          {statusNote ? (
            <p className={`dialStatusNote status${status}`}>{statusNote}</p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
