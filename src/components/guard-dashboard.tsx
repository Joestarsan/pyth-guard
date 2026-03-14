"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { apiMarketProvider } from "@/lib/market-data/api-provider";
import { EvidenceCard } from "@/components/evidence-card";
import { ExecutionPolicyCard } from "@/components/execution-policy-card";
import { ModeNav } from "@/components/mode-nav";
import { PythBrand } from "@/components/pyth-brand";
import { TimelineStrip } from "@/components/timeline-strip";
import { TrialVerdictOverlay } from "@/components/trial-verdict-overlay";
import { TrustDial } from "@/components/trust-dial";
import { useMarketStream } from "@/hooks/use-market-stream";
import {
  buildCapturedWitnessCase,
  storeCapturedWitnessCase,
} from "@/lib/replay/captured-case";
import { supportedAssets, SupportedAsset } from "@/lib/mock-market-state";
import {
  assessTradeTicket,
  formatPrice,
  getDefaultEntryPrice,
  tradeIntents,
  TradeIntent,
} from "@/lib/trade-ticket";

const heroSignals = [
  "Live Ticket Score",
  "Position Admissibility",
  "Courtroom Trigger",
  "Execution Evidence",
] as const;

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function formatCurrency(value: number) {
  return currencyFormatter.format(value);
}

function formatEditablePrice(value: number) {
  return value.toFixed(2);
}

function getExhibitLabel(index: number) {
  return `Exhibit ${String.fromCharCode(65 + index)}`;
}

export function GuardDashboard() {
  const [asset, setAsset] = useState<SupportedAsset>("BTC / USD");
  const [intent, setIntent] = useState<TradeIntent>("Long");
  const [orderSize, setOrderSize] = useState(15_000);
  const [entryPriceText, setEntryPriceText] = useState("");
  const [entryPriceTouched, setEntryPriceTouched] = useState(false);
  const [activeTrialCaseId, setActiveTrialCaseId] = useState<string | null>(null);
  const [isTrialOpen, setIsTrialOpen] = useState(false);
  const {
    frameIndex,
    input,
    state,
    source,
    status,
    notice,
    baselineSamples,
    baselineTarget,
  } = useMarketStream({
    asset,
    provider: apiMarketProvider,
  });

  useEffect(() => {
    setEntryPriceTouched(false);
    setEntryPriceText("");
  }, [asset]);

  useEffect(() => {
    if (!input || entryPriceTouched) {
      return;
    }

    setEntryPriceText(formatEditablePrice(getDefaultEntryPrice(input, intent)));
  }, [input, intent, entryPriceTouched]);

  if (state === null || input === null) {
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
  const parsedEntryPrice = Number(entryPriceText);
  const liveReferencePrice = getDefaultEntryPrice(input, intent);
  const effectiveEntryPrice =
    Number.isFinite(parsedEntryPrice) && parsedEntryPrice > 0
      ? parsedEntryPrice
      : liveReferencePrice;
  const tradeAssessment = assessTradeTicket({
    input,
    state,
    intent,
    orderSize,
    entryPrice: effectiveEntryPrice,
  });

  const guardCap = tradeAssessment.guardCap;
  const exhibitDeck = [...tradeAssessment.evidence, ...state.evidence.slice(0, 2)];
  const launchLabel =
    intent === "Exit" ? "Put Exit On Trial" : `Put ${intent} On Trial`;

  function launchTrial() {
    if (!input || !state) {
      return;
    }

    const capturedCase = buildCapturedWitnessCase({
      input,
      state,
      source,
      status,
      intent,
      tradeAssessment,
    });

    storeCapturedWitnessCase(window.localStorage, capturedCase);
    setActiveTrialCaseId(capturedCase.id);
    setIsTrialOpen(true);
  }

  function syncEntryToLive() {
    setEntryPriceTouched(false);
    setEntryPriceText(formatEditablePrice(liveReferencePrice));
  }

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
              Build a live ticket, put it on trial, and let Pyth Guard argue
              whether the position deserves to be admitted.
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
              <strong>{intent} Ticket Builder</strong>
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
              <span>Position Notional</span>
              <input
                type="number"
                min={2_000}
                max={50_000}
                step={1_000}
                value={orderSize}
                onChange={(event) =>
                  setOrderSize(
                    Math.min(
                      50_000,
                      Math.max(2_000, Number(event.target.value) || 2_000),
                    ),
                  )
                }
                className="ticketInput"
              />
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
              {tradeIntents.map((action) => (
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

            <label className="field">
              <span>Entry Price</span>
              <div className="fieldControlRow">
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={entryPriceText}
                  onChange={(event) => {
                    setEntryPriceTouched(true);
                    setEntryPriceText(event.target.value);
                  }}
                  className="ticketInput"
                />
                <button
                  type="button"
                  className="inlineActionButton"
                  onClick={syncEntryToLive}
                >
                  Use Live
                </button>
              </div>
              <div className="fieldHint">
                Live reference: {formatPrice(liveReferencePrice, asset)}
              </div>
            </label>

            <div className="flagStack">
              <span className="panelEyebrow">Court Objections</span>
              {tradeAssessment.objections.length > 0 ? (
                tradeAssessment.objections.slice(0, 3).map((item) => (
                  <div key={item} className="flagBadge narrative">
                    {item}
                  </div>
                ))
              ) : (
                <div className="flagBadge calm">Clean Conditions</div>
              )}

              {notice ? <p className="panelNotice">{notice}</p> : null}
            </div>

            <div className="trialLaunchCard">
              <span className="panelEyebrow">Court Trigger</span>
              <strong>{launchLabel}</strong>
              <p>
                Launch the verdict stage with live transcript, sound cue, and a
                witness dossier you can reopen later.
              </p>
              <button
                type="button"
                className="trialLaunchButton"
                onClick={launchTrial}
              >
                {launchLabel}
              </button>
            </div>
          </aside>

          <div className="stageColumn">
            <TrustDial
              state={state}
              status={status}
              baselineSamples={baselineSamples}
              baselineTarget={baselineTarget}
              tradeAssessment={tradeAssessment}
            />

            <section className="evidencePanel evidenceDeck">
              <div className="panelHeader">
                <span className="panelEyebrow">Exhibit Rail</span>
                <strong>Why This Ticket Is or Is Not Admissible</strong>
              </div>
              <p className="evidenceLead">
                The first exhibits belong to the ticket itself. The last ones are
                live Pyth market structure feeding the court.
              </p>

              <div className="evidenceStack evidenceRail">
                {exhibitDeck.map((item, index) => (
                  <EvidenceCard
                    key={`${item.label}-${index}`}
                    item={item}
                    eyebrow={getExhibitLabel(index)}
                  />
                ))}
              </div>
            </section>
          </div>
        </section>

        <section className="lowerGrid">
          <ExecutionPolicyCard
            state={state}
            status={status}
            baselineSamples={baselineSamples}
            baselineTarget={baselineTarget}
            intent={intent}
            orderSize={orderSize}
            tradeAssessment={tradeAssessment}
          />

          <article className="witnessPanel">
            <div className="panelHeader">
              <span className="panelEyebrow">Next Mode</span>
              <strong>Market Witness</strong>
            </div>
            <p>
              Every hearing is stored as a dossier. Open the full courtroom if
              you want the replay layer and captured case rail.
            </p>
            <div className="witnessPanelFooter">
              <div className="witnessStamp">
                {tradeAssessment.verdict.toUpperCase()}
              </div>
              <button
                type="button"
                className="modeActionButton"
                onClick={launchTrial}
              >
                {launchLabel}
              </button>
              <Link href="/witness" className="modeLaunchLink">
                Enter Trial Mode
              </Link>
            </div>
          </article>

          <article className="timelinePanel">
            <div className="panelHeader">
              <span className="panelEyebrow">Market Health Tape</span>
              <strong>Trust Degradation Loop</strong>
            </div>
            <TimelineStrip values={state.timeline} />
          </article>
        </section>
      </section>

      {isTrialOpen && activeTrialCaseId ? (
        <TrialVerdictOverlay
          caseId={activeTrialCaseId}
          source={source}
          status={status}
          notice={notice}
          tradeAssessment={tradeAssessment}
          onClose={() => setIsTrialOpen(false)}
        />
      ) : null}
    </>
  );
}
