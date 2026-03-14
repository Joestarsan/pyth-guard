"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

import { EvidenceCard } from "@/components/evidence-card";
import { PythBrand } from "@/components/pyth-brand";
import { TimelineStrip } from "@/components/timeline-strip";
import {
  clearCapturedWitnessCases,
  readCapturedWitnessCases,
} from "@/lib/replay/captured-case";
import { WitnessCase, witnessCases } from "@/lib/replay/witness-cases";
import { computeMarketState } from "@/lib/trust-engine";

function getWitnessExhibitLabel(index: number) {
  return `Case Exhibit ${index + 1}`;
}

export function WitnessBoard() {
  const searchParams = useSearchParams();
  const [capturedCases, setCapturedCases] = useState<WitnessCase[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState(witnessCases[0].id);
  const requestedCaseId = searchParams.get("case");
  const caseDocket = [...capturedCases, ...witnessCases];
  const selectedCase =
    caseDocket.find((item) => item.id === selectedCaseId) ?? caseDocket[0];
  const caseState = computeMarketState(selectedCase.frame, selectedCase.timeline);

  useEffect(() => {
    setCapturedCases(readCapturedWitnessCases(window.localStorage));
  }, []);

  useEffect(() => {
    const availableCaseIds = new Set(caseDocket.map((item) => item.id));

    if (
      requestedCaseId &&
      availableCaseIds.has(requestedCaseId)
    ) {
      setSelectedCaseId(requestedCaseId);
      return;
    }

    if (!availableCaseIds.has(selectedCaseId)) {
      setSelectedCaseId(caseDocket[0].id);
    }
  }, [requestedCaseId, capturedCases, selectedCaseId]);

  function clearCapturedDocket() {
    clearCapturedWitnessCases(window.localStorage);
    setCapturedCases([]);

    if (selectedCase.captureMeta) {
      setSelectedCaseId(witnessCases[0].id);
    }
  }

  return (
    <section className="witnessShell">
      <header className="witnessHero">
        <div>
          <div className="heroBrandRow">
            <PythBrand />
            <div className="heroSignalStrip" aria-label="Trial context">
              <span className="heroSignalChip">Forensic Replay</span>
              <span className="heroSignalChip">Execution Evidence</span>
              <span className="heroSignalChip">Courtroom Mode</span>
            </div>
          </div>
          <span className="topKicker">Market Witness</span>
          <h1>Put the trade on trial.</h1>
          <p className="witnessHeroCopy">
            The same trust engine that protects execution in live mode becomes
            forensic evidence after the fact.
          </p>
        </div>

        <div className="heroMeta">
          <span className="assetBadge">{selectedCase.defendant}</span>
          <span className="assetBadge subtle">{selectedCase.charge}</span>
          {selectedCase.captureMeta ? (
            <span className={`assetBadge subtle status${selectedCase.captureMeta.status}`}>
              Captured: {selectedCase.captureMeta.source === "pyth-pro" ? "Pyth Pro" : "Fallback"}
            </span>
          ) : null}
        </div>
      </header>

      <section className="witnessLayout">
        <aside className="caseRail">
          <div className="panelHeader">
            <span className="panelEyebrow">Cases</span>
            <strong>Trial Docket</strong>
          </div>

          {capturedCases.length > 0 ? (
            <div className="caseRailTools">
              <span className="caseCountTag">
                Captured dossiers: {capturedCases.length}
              </span>
              <button
                type="button"
                className="modeActionButton subtle"
                onClick={clearCapturedDocket}
              >
                Clear Captures
              </button>
            </div>
          ) : null}

          <div className="caseList">
            {caseDocket.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`caseCard${item.id === selectedCase.id ? " active" : ""}`}
                onClick={() => setSelectedCaseId(item.id)}
              >
                <span className="caseTitle">{item.title}</span>
                <span className="caseSubtitle">{item.subtitle}</span>
                {item.captureMeta ? (
                  <span className="caseMetaTag">
                    {item.captureMeta.intent} {item.frame.asset}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        </aside>

        <section className="witnessStage">
          <div className="witnessStageTop">
            <div className="verdictPanel">
              <span className="panelEyebrow">Verdict</span>
              <strong className="verdictWord">{selectedCase.verdict}</strong>
              <p className="verdictCopy">
                Recommended alternative: {selectedCase.recommendedAction}
              </p>
            </div>

            <div className="witnessScorePanel">
              <span className="panelEyebrow">Trust At Entry</span>
              <strong className="witnessScore">{caseState.trustScore}</strong>
              <span className={`riskBadge risk${caseState.riskLevel}`}>
                {caseState.riskLevel}
              </span>
            </div>
          </div>

          <div className="reasoningPanel">
            <div className="panelHeader">
              <span className="panelEyebrow">Reasoning Stack</span>
              <strong>Why the verdict landed this way</strong>
            </div>

            <div className="reasoningList">
              {selectedCase.evidenceSummary.map((item) => (
                <div key={item} className="reasoningItem">
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="transcriptPanel">
            <div className="panelHeader">
              <span className="panelEyebrow">Transcript</span>
              <strong>{selectedCase.title}</strong>
            </div>

            <div className="transcriptList">
              {selectedCase.lines.map((line, index) => (
                <article
                  key={`${line.role}-${index}`}
                  className={`transcriptLine role${line.role}`}
                >
                  <span className="transcriptRole">{line.role}</span>
                  <p>{line.text}</p>
                </article>
              ))}
            </div>
          </div>

          <div className="witnessTimelinePanel">
            <div className="panelHeader">
              <span className="panelEyebrow">Trust Collapse Replay</span>
              <strong>Entry Conditions</strong>
            </div>
            <TimelineStrip values={caseState.timeline} />
          </div>

          <div className="witnessExhibitPanel">
            <div className="panelHeader">
              <span className="panelEyebrow">Exhibits</span>
              <strong>Pyth Evidence</strong>
            </div>
            <div className="witnessSealRow">
              <p className="witnessExhibitCopy">
                These exhibits reconstruct the market quality that existed at
                the moment the trade was taken.
              </p>
              <div className="witnessStamp objection">OBJECTION</div>
            </div>

            <div className="evidenceStack evidenceRail">
              {caseState.evidence.map((item, index) => (
                <EvidenceCard
                  key={item.label}
                  item={item}
                  eyebrow={getWitnessExhibitLabel(index)}
                />
              ))}
            </div>
          </div>
        </section>
      </section>
    </section>
  );
}
