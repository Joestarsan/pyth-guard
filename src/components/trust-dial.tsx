import { MarketState } from "@/lib/mock-market-state";

type TrustDialProps = {
  state: MarketState;
};

export function TrustDial({ state }: TrustDialProps) {
  const circumference = 2 * Math.PI * 120;
  const offset = circumference - (state.trustScore / 100) * circumference;

  return (
    <section className="trustDial">
      <div className="dialAura" />
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

      <div className="dialContent">
        <span className="dialEyebrow">Live Trust Verdict</span>
        <strong className="dialScore">{state.trustScore}</strong>
        <span className={`riskBadge risk${state.riskLevel}`}>{state.riskLevel}</span>
        <p className="dialRecommendation">{state.recommendation}</p>
        <p className="dialNarrative">{state.narrative}</p>
      </div>
    </section>
  );
}
