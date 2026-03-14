"use client";

import Link from "next/link";
import { useState } from "react";

import { apiMarketProvider } from "@/lib/market-data/api-provider";
import { EvidenceCard } from "@/components/evidence-card";
import { ExecutionPolicyCard } from "@/components/execution-policy-card";
import { ModeNav } from "@/components/mode-nav";
import { PythBrand } from "@/components/pyth-brand";
import { TimelineStrip } from "@/components/timeline-strip";
import { TrustDial } from "@/components/trust-dial";
import { useMarketStream } from "@/hooks/use-market-stream";
import { supportedAssets, SupportedAsset } from "@/lib/mock-market-state";

const quickActions = ["Long", "Short", "Swap", "Exit"] as const;
const heroSignals = [
  "Confidence",
  "Spread",
  "Publisher Count",
  "Feed Freshness",
] as const;

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function formatCurrency(value: number) {
  return currencyFormatter.format(value);
}

export function GuardDashboard() {
  const [asset, setAsset] = useState<SupportedAsset>("BTC / USD");
  const [intent, setIntent] = useState<(typeof quickActions)[number]>("Long");
  const [orderSize, setOrderSize] = useState(15_000);
  const { frameIndex, state, status, notice, baselineSamples, baselineTarget } =
    useMarketStream({
      asset,
      provider: apiMarketProvider,
    });

  if (state === null) {
    return null;
  }

  const sourceLabel =
    status === "live"
      ? "Pyth Pro Live"
      : status === "warming"
        ? "Pyth Pro Warm-up"
        : "Mock Fallback";
  const contextLabel =
    status === "fallback"
      ? `Scenario: ${frameIndex + 1}`
      : baselineTarget
        ? `Baseline: ${
            status === "live" ? "Ready" : `${baselineSamples ?? 0}/${baselineTarget}`
          }`
        : undefined;
  const guardCap = Math.round(orderSize * state.executionPolicy.maxSizeFraction);

  return (
    <>
      <ModeNav current="guard" />
      <section className="heroFrame">
        <header className="heroHeader">
          <div>
            <div className="heroBrandRow">
              <PythBrand />
              <div className="heroSignalStrip" aria-label="Primary Pyth signals">
                {heroSignals.map((signal) => (
                  <span key={signal} className="heroSignalChip">
                    {signal}
                  </span>
                ))}
              </div>
            </div>
            <h1>Is this market trustworthy enough to execute?</h1>
            <p className="heroLead">
              A real-time execution trust layer that translates Pyth Pro market
              structure into an actionable verdict.
            </p>
          </div>

          <div className="heroMeta">
            <span className="assetBadge">{state.asset}</span>
            <span className="assetBadge subtle">Session: {state.marketSession}</span>
            <span className={`assetBadge subtle status${status}`}>
              Source: {sourceLabel}
            </span>
            {contextLabel ? (
              <span className={`assetBadge subtle status${status}`}>
                {contextLabel}
              </span>
            ) : null}
          </div>
        </header>

        <section className="mainGrid">
          <aside className="intentPanel">
            <div className="panelHeader">
              <span className="panelEyebrow">Trade Intent</span>
              <strong>{intent} Execution Console</strong>
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
              <div className="fieldValue">{formatCurrency(orderSize)}</div>
              <input
                type="range"
                min={2_000}
                max={50_000}
                step={1_000}
                value={orderSize}
                onChange={(event) => setOrderSize(Number(event.target.value))}
                className="sizeSlider"
              />
              <div className="fieldHint">
                Guard cap now: {formatCurrency(guardCap)}
              </div>
            </label>

            <div className="actionGrid">
              {quickActions.map((action) => (
                <button
                  key={action}
                  type="button"
                  className={`actionChip${action === intent ? " active" : ""}`}
                  onClick={() => setIntent(action)}
                  aria-pressed={action === intent}
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

          <TrustDial
            state={state}
            status={status}
            baselineSamples={baselineSamples}
            baselineTarget={baselineTarget}
          />

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
          <ExecutionPolicyCard
            state={state}
            status={status}
            baselineSamples={baselineSamples}
            baselineTarget={baselineTarget}
            intent={intent}
            orderSize={orderSize}
          />

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
