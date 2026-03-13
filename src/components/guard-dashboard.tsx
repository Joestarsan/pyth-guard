"use client";

import Link from "next/link";
import { useState } from "react";

import { apiMarketProvider } from "@/lib/market-data/api-provider";
import { EvidenceCard } from "@/components/evidence-card";
import { TimelineStrip } from "@/components/timeline-strip";
import { TrustDial } from "@/components/trust-dial";
import { ModeNav } from "@/components/mode-nav";
import { useMarketStream } from "@/hooks/use-market-stream";
import { supportedAssets, SupportedAsset } from "@/lib/mock-market-state";

const quickActions = ["Long", "Short", "Swap", "Exit"];

export function GuardDashboard() {
  const [asset, setAsset] = useState<SupportedAsset>("BTC / USD");
  const { frameIndex, state, source, notice } = useMarketStream({
    asset,
    provider: apiMarketProvider,
  });

  if (state === null) {
    return null;
  }

  return (
    <>
      <ModeNav current="guard" />
      <section className="heroFrame">
      <header className="heroHeader">
        <div>
          <span className="topKicker">Pyth Guard</span>
          <h1>Is this market trustworthy enough to execute?</h1>
        </div>

        <div className="heroMeta">
          <span className="assetBadge">{state.asset}</span>
          <span className="assetBadge subtle">Session: {state.marketSession}</span>
          <span className={`assetBadge subtle source${source}`}>
            Source: {source === "pyth-pro" ? "Pyth Pro" : "Mock Fallback"}
          </span>
          <span className="assetBadge subtle">Frame: {frameIndex + 1}</span>
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
            <div className="assetSwitch">
              {supportedAssets.map((candidate) => (
                <button
                  key={candidate}
                  type="button"
                  className={`assetSwitchButton${candidate === asset ? " active" : ""}`}
                  onClick={() => setAsset(candidate)}
                >
                  {candidate}
                </button>
              ))}
            </div>
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

            {notice ? <p className="panelNotice">{notice}</p> : null}
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
          <div className="witnessPanelFooter">
            <div className="witnessStamp">OBJECTION READY</div>
            <Link href="/witness" className="modeLaunchLink">
              Enter Trial Mode
            </Link>
          </div>
        </article>
      </section>
      </section>
    </>
  );
}
