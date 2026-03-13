import { EvidenceCard } from "@/components/evidence-card";
import { TimelineStrip } from "@/components/timeline-strip";
import { TrustDial } from "@/components/trust-dial";
import { mockMarketState } from "@/lib/mock-market-state";

const quickActions = [
  "Long",
  "Short",
  "Swap",
  "Exit",
];

export default function HomePage() {
  return (
    <main className="pageShell">
      <div className="pageGlow pageGlowTop" />
      <div className="pageGlow pageGlowBottom" />

      <section className="heroFrame">
        <header className="heroHeader">
          <div>
            <span className="topKicker">Pyth Guard</span>
            <h1>Is this market trustworthy enough to execute?</h1>
          </div>

          <div className="heroMeta">
            <span className="assetBadge">{mockMarketState.asset}</span>
            <span className="assetBadge subtle">
              Session: {mockMarketState.marketSession}
            </span>
          </div>
        </header>

        <section className="mainGrid">
          <aside className="intentPanel">
            <div className="panelHeader">
              <span className="panelEyebrow">Trade Intent</span>
              <strong>Execution Console</strong>
            </div>

            <label className="field">
              <span>Asset</span>
              <div className="fieldValue">{mockMarketState.asset}</div>
            </label>

            <label className="field">
              <span>Order Size</span>
              <div className="fieldValue">$15,000</div>
            </label>

            <div className="actionGrid">
              {quickActions.map((action) => (
                <button
                  key={action}
                  type="button"
                  className={`actionChip${action === "Long" ? " active" : ""}`}
                >
                  {action}
                </button>
              ))}
            </div>

            <div className="flagStack">
              <span className="panelEyebrow">Active Flags</span>
              {mockMarketState.flags.map((flag) => (
                <div key={flag} className="flagBadge">
                  {flag}
                </div>
              ))}
            </div>
          </aside>

          <TrustDial state={mockMarketState} />

          <aside className="evidencePanel">
            <div className="panelHeader">
              <span className="panelEyebrow">Evidence Stack</span>
              <strong>What Pyth Sees</strong>
            </div>

            <div className="evidenceStack">
              {mockMarketState.evidence.map((item) => (
                <EvidenceCard key={item.label} item={item} />
              ))}
            </div>
          </aside>
        </section>

        <section className="lowerGrid">
          <article className="timelinePanel">
            <div className="panelHeader">
              <span className="panelEyebrow">Market Health Tape</span>
              <strong>Trust Degradation</strong>
            </div>
            <TimelineStrip values={mockMarketState.timeline} />
          </article>

          <article className="witnessPanel">
            <div className="panelHeader">
              <span className="panelEyebrow">Next Mode</span>
              <strong>Market Witness</strong>
            </div>
            <p>
              The same trust engine will replay bad trades as courtroom evidence.
              For the demo build, this panel becomes the dramatic forensic layer.
            </p>
            <div className="witnessStamp">OBJECTION READY</div>
          </article>
        </section>
      </section>
    </main>
  );
}
