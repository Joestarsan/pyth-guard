"use client";

import { useEffect, useState } from "react";

import { EvidenceCard } from "@/components/evidence-card";
import { TimelineStrip } from "@/components/timeline-strip";
import { TrustDial } from "@/components/trust-dial";
import { MarketState, mockScenarioFrames } from "@/lib/mock-market-state";
import { computeMarketState } from "@/lib/trust-engine";

const quickActions = ["Long", "Short", "Swap", "Exit"];

function buildInitialState() {
  const initialFrame = mockScenarioFrames[0];
  return computeMarketState(initialFrame, [86, 84, 83, 82, 84, 86]);
}

export function GuardDashboard() {
  const [frameIndex, setFrameIndex] = useState(0);
  const [state, setState] = useState<MarketState>(buildInitialState);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setFrameIndex((previous) => {
        const nextIndex = (previous + 1) % mockScenarioFrames.length;
        setState((current) => {
          const timeline = [...current.timeline, current.trustScore].slice(-12);
          return computeMarketState(mockScenarioFrames[nextIndex], timeline);
        });
        return nextIndex;
      });
    }, 1800);

    return () => window.clearInterval(interval);
  }, []);

  return (
    <section className="heroFrame">
      <header className="heroHeader">
        <div>
          <span className="topKicker">Pyth Guard</span>
          <h1>Is this market trustworthy enough to execute?</h1>
        </div>

        <div className="heroMeta">
          <span className="assetBadge">{state.asset}</span>
          <span className="assetBadge subtle">Session: {state.marketSession}</span>
          <span className="assetBadge subtle">Scenario frame: {frameIndex + 1}</span>
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
            <div className="fieldValue">{state.asset}</div>
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
            {state.flags.length > 0 ? (
              state.flags.map((flag) => (
                <div key={flag} className="flagBadge">
                  {flag}
                </div>
              ))
            ) : (
              <div className="flagBadge calm">Clean Conditions</div>
            )}
          </div>
        </aside>

        <TrustDial state={state} />

        <aside className="evidencePanel">
          <div className="panelHeader">
            <span className="panelEyebrow">Evidence Stack</span>
            <strong>What Pyth Sees</strong>
          </div>

          <div className="evidenceStack">
            {state.evidence.map((item) => (
              <EvidenceCard key={item.label} item={item} />
            ))}
          </div>
        </aside>
      </section>

      <section className="lowerGrid">
        <article className="timelinePanel">
          <div className="panelHeader">
            <span className="panelEyebrow">Market Health Tape</span>
            <strong>Trust Degradation Loop</strong>
          </div>
          <TimelineStrip values={state.timeline} />
        </article>

        <article className="witnessPanel">
          <div className="panelHeader">
            <span className="panelEyebrow">Next Mode</span>
            <strong>Market Witness</strong>
          </div>
          <p>
            The same trust engine will replay bad trades as courtroom evidence.
            For the demo build, this panel becomes the forensic confrontation layer.
          </p>
          <div className="witnessStamp">OBJECTION READY</div>
        </article>
      </section>
    </section>
  );
}
