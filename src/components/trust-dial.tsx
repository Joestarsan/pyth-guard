import { MarketStreamStatus } from "@/lib/market-data/types";
import { MarketState } from "@/lib/mock-market-state";

type TrustDialProps = {
  state: MarketState;
  status: MarketStreamStatus;
  baselineSamples?: number;
  baselineTarget?: number;
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
}: TrustDialProps) {
  const circumference = 2 * Math.PI * 120;
  const offset = circumference - (state.trustScore / 100) * circumference;
  const statusNote = getStatusNote(status, baselineSamples, baselineTarget);
  const spotlightMetrics = state.evidence.slice(0, 4);
  const eyebrow =
    status === "fallback"
      ? "Fallback Trust Verdict"
      : status === "warming"
        ? "Live Trust Warm-up"
        : "Live Trust Verdict";

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
              pathLength="1"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
            />
          </svg>
          <div className="dialCoreShell" aria-hidden="true" />

          <div className="dialContent">
            <span className="dialEyebrow">{eyebrow}</span>
            <strong className="dialScore">{state.trustScore}</strong>
            <span className={`riskBadge risk${state.riskLevel}`}>
              {state.riskLevel}
            </span>
            <p className="dialRecommendation">{state.recommendation}</p>
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
          <p className="dialNarrative">{state.narrative}</p>
          {statusNote ? (
            <p className={`dialStatusNote status${status}`}>{statusNote}</p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
